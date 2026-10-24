import { describe, expect, it } from 'vitest';
import { initialMachine, isLegal, outcomeOf, transition, MAX_IDENTITY_RETRIES, type MachineState } from '../src/lib/stateMachine';

function run(events: Parameters<typeof transition>[1][], payloads: Record<number, { date?: string; reason?: string }> = {}): MachineState {
  let m = initialMachine();
  events.forEach((e, i) => {
    m = transition(m, e, payloads[i]).next;
  });
  return m;
}

describe('state machine', () => {
  it('happy path: greeting → identity → disclose → promise → close → ended', () => {
    const m = run(['GREETED', 'IDENTITY_CONFIRMED', 'DISCLOSED', 'PROMISE_VALID', 'CLOSED'], { 3: { date: '2026-11-08' } });
    expect(m.state).toBe('ENDED');
    expect(m.identityConfirmed).toBe(true);
    expect(outcomeOf(m)).toEqual({ type: 'promise', date: '2026-11-08' });
  });

  it('FAQ detour returns to PROMISE', () => {
    let m = run(['GREETED', 'IDENTITY_CONFIRMED', 'DISCLOSED', 'FAQ_ASKED']);
    expect(m.state).toBe('FAQ');
    m = transition(m, 'FAQ_ANSWERED').next;
    expect(m.state).toBe('PROMISE');
  });

  it('wrong number and third party go straight to HANDOFF', () => {
    expect(run(['GREETED', 'IDENTITY_DENIED']).handoffReason).toBe('wrong_number');
    expect(run(['GREETED', 'THIRD_PARTY']).handoffReason).toBe('third_party');
  });

  it('unclear identity hands off after max retries', () => {
    const evs = ['GREETED', ...Array(MAX_IDENTITY_RETRIES).fill('IDENTITY_UNCLEAR')] as Parameters<typeof transition>[1][];
    const m = run(evs);
    expect(m.state).toBe('HANDOFF');
    expect(m.handoffReason).toBe('unclear_identity');
  });

  it('out-of-window promise hands off; valid promise needs a date', () => {
    expect(run(['GREETED', 'IDENTITY_CONFIRMED', 'DISCLOSED', 'PROMISE_INVALID']).handoffReason).toBe('date_outside_window');
    const m = run(['GREETED', 'IDENTITY_CONFIRMED', 'DISCLOSED']);
    expect(transition(m, 'PROMISE_VALID').ok).toBe(false);
  });

  it('cannot disclose or promise before identity is confirmed', () => {
    const m = run(['GREETED']);
    expect(transition(m, 'DISCLOSED').ok).toBe(false);
    expect(transition(m, 'PROMISE_VALID', { date: '2026-11-08' }).ok).toBe(false);
  });

  it('handoff from any active state; nothing after ENDED', () => {
    for (const evs of [['GREETED'], ['GREETED', 'IDENTITY_CONFIRMED'], ['GREETED', 'IDENTITY_CONFIRMED', 'DISCLOSED', 'FAQ_ASKED']] as Parameters<typeof transition>[1][][]) {
      const m = transition(run(evs), 'HANDOFF_TRIGGER', { reason: 'dispute' }).next;
      expect(m.state).toBe('HANDOFF');
    }
    const ended = run(['GREETED', 'HANDOFF_TRIGGER', 'CLOSED']);
    expect(ended.state).toBe('ENDED');
    expect(transition(ended, 'IDENTITY_CONFIRMED').ok).toBe(false);
  });

  it('already paid closes without a promise', () => {
    const m = run(['GREETED', 'IDENTITY_CONFIRMED', 'DISCLOSED', 'ALREADY_PAID', 'CLOSED']);
    expect(outcomeOf(m)).toEqual({ type: 'closed', reason: 'already_paid' });
  });

  it('legal-transition table rejects skipping steps', () => {
    expect(isLegal('GREETING', 'CLOSE')).toBe(false);
    expect(isLegal('HANDOFF', 'PROMISE')).toBe(false);
    expect(isLegal('PROMISE', 'HANDOFF')).toBe(true);
  });
});
