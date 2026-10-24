import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectHandoff } from '../src/lib/handoff';
import { POLICY_CARD } from '../src/lib/policyCard';
import { parsePromiseDate, validatePromise } from '../src/lib/promiseDate';
import { countBy, parseScenariosJsonl, validateScenario } from '../src/lib/scenarios';

const raw = readFileSync(join(__dirname, '..', 'data', 'scenarios.jsonl'), 'utf8');
const { scenarios, errors } = parseScenariosJsonl(raw);

describe('scenario set schema', () => {
  it('parses with no schema errors', () => {
    expect(errors).toEqual([]);
  });
  it('has at least 80 scenarios across all four languages', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(80);
    const byLang = countBy(scenarios, (s) => s.language);
    for (const l of ['hinglish', 'english', 'marathi_english', 'hindi_deva']) expect(byLang[l]).toBeGreaterThan(0);
  });
  it('covers every required persona and disruption', () => {
    const personas = countBy(scenarios, (s) => s.persona);
    for (const p of ['cooperative', 'busy', 'angry', 'confused_elderly', 'wrong_number', 'family_member', 'hardship', 'dispute', 'asks_interest_rate', 'asks_fee_waiver', 'abusive']) expect(personas[p]).toBeGreaterThan(0);
    const dis = countBy(scenarios, (s) => s.disruptions);
    for (const d of ['interruption', 'self_correction', 'noise', 'off_script']) expect(dis[d]).toBeGreaterThan(0);
  });
  it('is honestly labelled: AI-drafted and not yet reviewed', () => {
    expect(scenarios.every((s) => s.provenance === 'drafted_with_ai_assistance')).toBe(true);
  });
  it('validator rejects bad rows', () => {
    expect(validateScenario({ id: 'X1' }).length).toBeGreaterThan(0);
    expect(validateScenario({ ...scenarios[0], expected: { outcome: 'promise' } })).toContain('promise needs promiseDate');
  });
});

describe('scenario expectations agree with the deterministic parsers', () => {
  // Note: this checks internal consistency of data vs code. Because the detector was written
  // alongside these scenarios, passing here says nothing about recall on real callers.
  it.each(scenarios.filter((s) => s.expected.outcome === 'promise').map((s) => [s.id, s] as const))('%s promise date is what the parser reads', (_id, s) => {
    const withDate = s.turns.map((t) => parsePromiseDate(t.text, POLICY_CARD)).filter((p) => p.date);
    const last = withDate[withDate.length - 1];
    expect(last?.date).toBe((s.expected as { promiseDate: string }).promiseDate);
    expect(validatePromise(last!.date, POLICY_CARD)).toBe('ok');
    for (const t of s.turns) expect(detectHandoff(t.text)).toEqual([]);
  });

  it.each(scenarios.filter((s) => s.expected.outcome === 'handoff').map((s) => [s.id, s] as const))('%s handoff trigger is detectable', (_id, s) => {
    const reason = (s.expected as { handoffReason: string }).handoffReason;
    if (reason === 'date_outside_window') {
      const any = s.turns.some((t) => validatePromise(parsePromiseDate(t.text, POLICY_CARD).date, POLICY_CARD) === 'outside_window');
      expect(any).toBe(true);
    } else {
      const reasons = s.turns.flatMap((t) => detectHandoff(t.text).map((h) => h.reason));
      expect(reasons).toContain(reason);
    }
  });
});
