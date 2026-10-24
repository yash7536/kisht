/**
 * Conversation state machine. Lives in code, not in the prompt: the model PROPOSES the next state,
 * code ACCEPTS it only if the transition is legal. An illegal proposal is a "flow deviation".
 *
 *   IDENTITY ──confirmed──▶ DISCLOSE ──▶ PROMISE ──valid date──▶ CLOSE ──▶ ENDED
 *      │                       │  ▲         │  ▲
 *      │                       ▼  │         ▼  │
 *      │                       FAQ ─────────┘  (how to pay / late charge; date change → HANDOFF)
 *      └──wrong number / third party / unclear×2 / any trigger──▶ HANDOFF ──▶ ENDED
 */

export type CallState = 'GREETING' | 'IDENTITY' | 'DISCLOSE' | 'FAQ' | 'PROMISE' | 'CLOSE' | 'HANDOFF' | 'ENDED';

export const CALL_STATES: CallState[] = ['GREETING', 'IDENTITY', 'DISCLOSE', 'FAQ', 'PROMISE', 'CLOSE', 'HANDOFF', 'ENDED'];

export type CallEvent =
  | 'GREETED'
  | 'IDENTITY_CONFIRMED'
  | 'IDENTITY_DENIED'
  | 'THIRD_PARTY'
  | 'IDENTITY_UNCLEAR'
  | 'DISCLOSED'
  | 'FAQ_ASKED'
  | 'FAQ_ANSWERED'
  | 'PROMISE_VALID'
  | 'PROMISE_INVALID'
  | 'PROMISE_VAGUE'
  | 'ALREADY_PAID'
  | 'HANDOFF_TRIGGER'
  | 'MAX_RETRIES'
  | 'CLOSED';

/** Legal next states from each state (used to validate the model's proposal). */
export const LEGAL_NEXT: Record<CallState, CallState[]> = {
  GREETING: ['IDENTITY'],
  IDENTITY: ['IDENTITY', 'DISCLOSE', 'PROMISE', 'FAQ', 'CLOSE', 'HANDOFF'],
  DISCLOSE: ['DISCLOSE', 'FAQ', 'PROMISE', 'CLOSE', 'HANDOFF'],
  FAQ: ['FAQ', 'PROMISE', 'DISCLOSE', 'CLOSE', 'HANDOFF'],
  PROMISE: ['PROMISE', 'FAQ', 'CLOSE', 'HANDOFF'],
  CLOSE: ['ENDED', 'CLOSE'],
  HANDOFF: ['ENDED'],
  ENDED: [],
};

export function isLegal(from: CallState, to: CallState): boolean {
  return LEGAL_NEXT[from].includes(to);
}

export interface MachineState {
  state: CallState;
  identityConfirmed: boolean;
  identityRetries: number;
  promiseRetries: number;
  promiseDate: string | null;
  alreadyPaid: boolean;
  handoffReason: string | null;
}

export const MAX_IDENTITY_RETRIES = 2;
export const MAX_PROMISE_RETRIES = 2;

export function initialMachine(): MachineState {
  return { state: 'GREETING', identityConfirmed: false, identityRetries: 0, promiseRetries: 0, promiseDate: null, alreadyPaid: false, handoffReason: null };
}

/**
 * Deterministic transition function. `payload` carries the promise date or handoff reason.
 * Unknown (state, event) pairs leave the state unchanged and return ok=false.
 */
export function transition(m: MachineState, ev: CallEvent, payload: { date?: string; reason?: string } = {}): { next: MachineState; ok: boolean } {
  const s = { ...m };
  const fail = { next: m, ok: false };
  if (m.state === 'ENDED') return fail;

  if (ev === 'HANDOFF_TRIGGER') {
    if (m.state === 'CLOSE') return fail;
    s.state = 'HANDOFF';
    s.handoffReason = payload.reason ?? 'unspecified';
    return { next: s, ok: true };
  }

  switch (m.state) {
    case 'GREETING':
      if (ev === 'GREETED') { s.state = 'IDENTITY'; return { next: s, ok: true }; }
      return fail;
    case 'IDENTITY':
      if (ev === 'IDENTITY_CONFIRMED') { s.state = 'DISCLOSE'; s.identityConfirmed = true; return { next: s, ok: true }; }
      if (ev === 'IDENTITY_DENIED') { s.state = 'HANDOFF'; s.handoffReason = 'wrong_number'; return { next: s, ok: true }; }
      if (ev === 'THIRD_PARTY') { s.state = 'HANDOFF'; s.handoffReason = 'third_party'; return { next: s, ok: true }; }
      if (ev === 'IDENTITY_UNCLEAR') {
        s.identityRetries++;
        if (s.identityRetries >= MAX_IDENTITY_RETRIES) { s.state = 'HANDOFF'; s.handoffReason = 'unclear_identity'; }
        return { next: s, ok: true };
      }
      return fail;
    case 'DISCLOSE':
    case 'FAQ':
    case 'PROMISE':
      if (ev === 'DISCLOSED') { s.state = 'PROMISE'; return { next: s, ok: true }; }
      if (ev === 'FAQ_ASKED') { s.state = 'FAQ'; return { next: s, ok: true }; }
      if (ev === 'FAQ_ANSWERED') { s.state = 'PROMISE'; return { next: s, ok: true }; }
      if (ev === 'PROMISE_VALID') {
        if (!payload.date) return fail;
        s.state = 'CLOSE'; s.promiseDate = payload.date; return { next: s, ok: true };
      }
      if (ev === 'PROMISE_INVALID') { s.state = 'HANDOFF'; s.handoffReason = 'date_outside_window'; return { next: s, ok: true }; }
      if (ev === 'PROMISE_VAGUE') {
        // Count vague answers; closing after MAX_PROMISE_RETRIES is the model's call (MAX_RETRIES event).
        s.promiseRetries++;
        s.state = 'PROMISE';
        return { next: s, ok: true };
      }
      if (ev === 'ALREADY_PAID') { s.state = 'CLOSE'; s.alreadyPaid = true; return { next: s, ok: true }; }
      if (ev === 'MAX_RETRIES') { s.state = 'CLOSE'; return { next: s, ok: true }; }
      return fail;
    case 'CLOSE':
      if (ev === 'CLOSED') { s.state = 'ENDED'; return { next: s, ok: true }; }
      return fail;
    case 'HANDOFF':
      if (ev === 'CLOSED') { s.state = 'ENDED'; return { next: s, ok: true }; }
      return fail;
  }
  return fail;
}

export type CallOutcome =
  | { type: 'promise'; date: string }
  | { type: 'handoff'; reason: string }
  | { type: 'closed'; reason: 'already_paid' | 'no_promise' }
  | { type: 'incomplete' };

export function outcomeOf(m: MachineState): CallOutcome {
  if (m.handoffReason) return { type: 'handoff', reason: m.handoffReason };
  if (m.promiseDate) return { type: 'promise', date: m.promiseDate };
  if (m.state === 'CLOSE' || m.state === 'ENDED') return { type: 'closed', reason: m.alreadyPaid ? 'already_paid' : 'no_promise' };
  return { type: 'incomplete' };
}
