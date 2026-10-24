import { describe, expect, it } from 'vitest';
import { DEMO_TRANSCRIPTS } from '../src/data/demoTranscripts';
import { runTurn, startCall } from '../src/lib/agent';
import { POLICY_CARD } from '../src/lib/policyCard';
import { scriptedProposer } from '../src/lib/proposers';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

async function play(id: string) {
  const d = DEMO_TRANSCRIPTS.find((x) => x.id === id)!;
  const s = startCall(POLICY_CARD, DEFAULT_SETTINGS, d.lang, 'demo');
  for (const t of d.turns) await runTurn(s, t.borrower, scriptedProposer(t.drafts), { interrupted: !!t.interrupt });
  return s.record;
}

describe('hand-written demo transcripts run through the real guards', () => {
  it('demo-1: self-correction recorded as 10 Nov', async () => {
    const r = await play('demo-1');
    expect(r.outcome).toEqual({ type: 'promise', date: '2026-11-10' });
    expect(r.turns.flatMap((t) => t.events)).toEqual([]);
  });
  it('demo-2: invented "3 divas" is blocked, retry used', async () => {
    const r = await play('demo-2');
    expect(r.turns[1].attempts[0].numberGuard?.ok).toBe(false);
    expect(r.turns[1].replySource).toBe('model_retry');
    expect(r.outcome).toEqual({ type: 'promise', date: '2026-11-08' });
  });
  it('demo-3: missed dispute handoff is forced by the backstop', async () => {
    const r = await play('demo-3');
    expect(r.turns[1].replySource).toBe('forced_handoff');
    expect(r.outcome).toEqual({ type: 'handoff', reason: 'dispute' });
  });
  it('greetings disclose that the call is automated and carry no loan facts', async () => {
    for (const d of DEMO_TRANSCRIPTS) {
      const s = startCall(POLICY_CARD, DEFAULT_SETTINGS, d.lang, 'demo');
      expect(s.record.greetingViolations).toEqual([]);
    }
    for (const lang of ['hinglish', 'english', 'marathi_english', 'hindi_deva'] as const) {
      expect(startCall(POLICY_CARD, DEFAULT_SETTINGS, lang, 'demo').record.greetingViolations).toEqual([]);
    }
  });
});
