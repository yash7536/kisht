import { describe, expect, it } from 'vitest';
import { runTurn, startCall, type Proposal } from '../src/lib/agent';
import { cohensKappa, sampleIds } from '../src/lib/kappa';
import { gradeCall, summarize } from '../src/lib/metrics';
import { POLICY_CARD } from '../src/lib/policyCard';
import { scriptedProposer } from '../src/lib/proposers';
import { DEFAULT_SETTINGS } from '../src/lib/settings';
import type { Scenario } from '../src/lib/scenarios';

const settings = { ...DEFAULT_SETTINGS };
const p = (reply: string, next_state: string, intent = 'other', extra: Partial<Proposal> = {}): Proposal => ({ reply, next_state, intent, ...extra });

describe('turn engine guards (hand-written drafts, real guards)', () => {
  it('blocks an invented number, retries, and accepts a clean retry', async () => {
    const s = startCall(POLICY_CARD, settings, 'hinglish', 'demo');
    const prop = scriptedProposer([
      p('Dhanyavaad Ramesh ji. Aapki EMI ₹4,500 hai, 5 November tak.', 'PROMISE', 'identity_confirmed'),
      p('Dhanyavaad Ramesh ji. Aapki EMI ₹4,250 hai, 5 November tak due hai. Aap kab tak payment karenge?', 'PROMISE', 'identity_confirmed'),
    ]);
    const t = await runTurn(s, 'Haan ji, Ramesh bol raha hoon.', prop);
    expect(t.attempts).toHaveLength(2);
    expect(t.attempts[0].numberGuard?.ok).toBe(false);
    expect(t.replySource).toBe('model_retry');
    expect(t.events.map((e) => e.category)).toContain('invented_number');
    expect(s.record.machine.state).toBe('PROMISE');
  });

  it('forces a handoff when both drafts invent numbers (guard_block)', async () => {
    const s = startCall(POLICY_CARD, settings, 'hinglish', 'demo');
    const prop = scriptedProposer([p('Interest rate 18% hai.', 'PROMISE'), p('Rate 16% hai.', 'PROMISE')]);
    const t = await runTurn(s, 'Haan main hoon.', prop);
    expect(t.replySource).toBe('guard_block');
    expect(s.record.outcome).toEqual({ type: 'handoff', reason: 'guard_block' });
    expect(t.reply).not.toMatch(/\d/);
  });

  it('backstop forces a handoff the model missed', async () => {
    const s = startCall(POLICY_CARD, settings, 'hinglish', 'demo');
    await runTurn(s, 'Haan main hoon.', scriptedProposer([p('Ramesh ji, aapki EMI ₹4,250 hai, 5 November tak. Kab tak karenge?', 'PROMISE', 'identity_confirmed')]));
    const t = await runTurn(s, 'Yeh amount galat hai.', scriptedProposer([p('Koi baat nahi, aap kab payment karenge?', 'PROMISE')]));
    expect(t.replySource).toBe('forced_handoff');
    expect(t.events.find((e) => e.category === 'missed_handoff')).toBeTruthy();
    expect(s.record.outcome).toEqual({ type: 'handoff', reason: 'dispute' });
  });

  it('flags disclosure before identity', async () => {
    const s = startCall(POLICY_CARD, settings, 'hinglish', 'demo');
    const t = await runTurn(s, 'Main unki wife bol rahi hoon.', scriptedProposer([p('Unki EMI ₹4,250 hai, bata dijiye.', 'HANDOFF', 'third_party'), p('Koi baat nahi, hamari team sampark karegi.', 'HANDOFF', 'third_party')]));
    expect(t.attempts[0].script.map((v) => v.type)).toContain('disclosure_before_identity');
    expect(t.replySource).toBe('model_retry');
  });

  it('records the code-parsed promise date, and grades the call', async () => {
    const s = startCall(POLICY_CARD, settings, 'hinglish', 'demo');
    await runTurn(s, 'Haan ji.', scriptedProposer([p('Ramesh ji, aapki EMI ₹4,250 hai, 5 November tak. Kab tak karenge?', 'PROMISE', 'identity_confirmed')]));
    await runTurn(s, '8 ko... nahi nahi 10 ko de dunga.', scriptedProposer([p('Theek hai, 10 November note kar liya. Dhanyavaad.', 'CLOSE', 'promise_given', { promise_date: '2026-11-10' })]));
    expect(s.record.outcome).toEqual({ type: 'promise', date: '2026-11-10' });
    const sc: Scenario = { id: 'S999', title: 't', language: 'hinglish', persona: 'cooperative', disruptions: ['self_correction'], turns: [], expected: { outcome: 'promise', promiseDate: '2026-11-10' }, mustNotHappen: ['invented_number'], provenance: 'drafted_with_ai_assistance', reviewed: false };
    const g = gradeCall(s.record, sc);
    expect(g.taskComplete).toBe(true);
    expect(g.pass).toBe(true);
    const sum = summarize([g], 1);
    expect(sum.taskCompletion).toBe(1);
    expect(sum.passHatK).toBe(1);
  });

  it('summary of zero runs is all null (no fake numbers)', () => {
    const s = summarize([], 3);
    expect(s.taskCompletion).toBeNull();
    expect(s.p95LatencyMs).toBeNull();
    expect(s.costPerResolvedCallInr).toBeNull();
  });
});

describe('agreement statistics', () => {
  it('computes Cohen kappa', () => {
    const a = [true, true, false, false, true, false, true, true, false, true];
    const b = [true, false, false, false, true, false, true, true, true, true];
    const r = cohensKappa(a, b);
    expect(r.agreement).toBeCloseTo(0.8);
    expect(r.kappa).toBeCloseTo(0.5833, 3);
  });
  it('samples deterministically', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `c${i}`);
    expect(sampleIds(ids, 0.25)).toEqual(sampleIds(ids, 0.25));
    expect(sampleIds(ids, 0.25)).toHaveLength(10);
  });
});
