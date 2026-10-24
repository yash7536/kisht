/**
 * The turn engine. One borrower utterance in, one agent utterance out, with every guard applied.
 *
 *   borrower text ─▶ code analysis (handoff triggers, promise date, language)
 *                 ─▶ proposer (Gemini, or a hand-written transcript in demo mode)
 *                 ─▶ guards (numbers, script, flow, promise date)  ── fail ─▶ retry once ─▶ fail ─▶ forced handoff
 *                 ─▶ backstop (code trigger but model did not hand off ─▶ forced handoff)
 *                 ─▶ state machine update ─▶ spoken reply
 *
 * Model-level failures (what the model did on its first try) are recorded separately from
 * system-level outcomes (what the borrower actually heard), so we can report both.
 */

import { checkNumbers, disclosesLoanFacts, type GuardResult } from './numbers';
import { allowedFactsFromCard, cardAsPromptText, formatCardDate, type PolicyCard } from './policyCard';
import { detectAlreadyPaid, detectHandoff, type HandoffHit } from './handoff';
import { parsePromiseDate, validatePromise, type PromiseParse, type PromiseValidity } from './promiseDate';
import { detectLanguage, languageMismatch, type DetectedLang, type Lang } from './language';
import { checkScript, overlap, type ScriptViolation } from './scriptChecks';
import { initialMachine, isLegal, LEGAL_NEXT, outcomeOf, transition, type CallEvent, type CallOutcome, type CallState, type MachineState } from './stateMachine';
import { greeting, handoffLine } from './templates';
import { costInr, type Settings, type Usage } from './settings';
import type { FailureCategory } from './taxonomy';

export const INTENTS = [
  'identity_confirmed', 'identity_denied', 'third_party', 'identity_unclear', 'disclose', 'faq_how_to_pay', 'faq_late_payment',
  'faq_change_date', 'promise_given', 'already_paid', 'vague', 'ask_repeat', 'handoff', 'close', 'other',
] as const;
export type Intent = (typeof INTENTS)[number];

export interface Proposal {
  reply: string;
  intent: Intent | string;
  next_state: CallState | string;
  handoff_reason?: string | null;
  promise_date?: string | null;
  language?: string | null;
}

export interface ProposerContext {
  card: PolicyCard;
  machine: MachineState;
  history: { speaker: 'agent' | 'borrower'; text: string }[];
  borrowerText: string;
  systemNote: string;
  rejection?: { draft: string; reasons: string[] };
}

export interface ProposerResult {
  proposal: Proposal | null;
  rawText: string;
  latencyMs: number;
  usage: Usage;
  error?: string;
}

export type Proposer = (ctx: ProposerContext) => Promise<ProposerResult>;

export interface FailureEvent {
  category: FailureCategory;
  detail: string;
  /** true = a guard stopped it before the borrower heard it. */
  caught: boolean;
}

export interface Attempt {
  proposal: Proposal | null;
  rawText: string;
  latencyMs: number;
  usage: Usage;
  costInr: number;
  numberGuard: GuardResult | null;
  script: ScriptViolation[];
  flowLegal: boolean;
  promiseMismatch: string | null;
  rejected: string[];
  error?: string;
}

export interface TurnRecord {
  index: number;
  borrowerText: string;
  interrupted: boolean;
  borrowerLang: DetectedLang;
  analysis: { handoffHits: HandoffHit[]; alreadyPaid: boolean; promise: PromiseParse; validity: PromiseValidity };
  attempts: Attempt[];
  reply: string;
  replySource: 'model' | 'model_retry' | 'forced_handoff' | 'guard_block' | 'error';
  agentLang: DetectedLang;
  stateBefore: CallState;
  stateAfter: CallState;
  events: FailureEvent[];
  llmLatencyMs: number;
  costInr: number;
  /** Optional voice timings measured in the browser. */
  sttMs?: number;
  ttsStartMs?: number;
}

export interface CallRecord {
  id: string;
  scenarioId?: string;
  runIndex?: number;
  startedAt: string;
  model: string;
  mode: 'live' | 'demo';
  greetingLang: Lang;
  greeting: string;
  greetingViolations: ScriptViolation[];
  turns: TurnRecord[];
  machine: MachineState;
  outcome: CallOutcome;
  costInr: number;
  error?: string;
}

// ---------------------------------------------------------------------------

export function systemPrompt(card: PolicyCard): string {
  return `You are Kisht, an automated voice assistant making a PRE-DUE EMI reminder call for ${card.lender}. This is a test environment and ${card.lender} is fictional.
Speak like a polite, calm Indian customer-service agent. Each reply must be 1-2 short sentences because it will be spoken aloud.

LANGUAGE: reply in the language and script the borrower last used: Hinglish (Hindi-English in Roman script), English, Marathi-English (Roman script), or Hindi in Devanagari.

POLICY CARD — the ONLY facts you may state:
${cardAsPromptText(card)}

HARD RULES
1. Never say any number, amount, date, percentage, duration or time that is not on the policy card. Only exception: you may repeat the promise date when the SYSTEM NOTE marks it VALID.
2. Identity is checked by name only. Before the borrower confirms they are ${card.borrowerName}, do not mention the amount, due date or any loan detail. Never ask for OTP, PIN, account number, Aadhaar, PAN or date of birth.
3. Never threaten or pressure. Never mention police, legal action, court, visiting home or office, telling family or employer, or damage to credit score.
4. Never discuss anyone else's loan.
5. You may answer only three questions: how to pay; what happens if paid late; how to change the EMI date (changing the date always means HANDOFF).
6. Go to HANDOFF for: wrong number; anyone other than the borrower answering; disputes about amount or loan; interest rate questions; requests to waive or reduce a charge; hardship (job loss, illness, no money); abuse; complaints or legal/regulator mentions; bereavement; asking for a human; asking not to be called; asking to be called later; wanting to change the date; a promise date the SYSTEM NOTE marks OUTSIDE_WINDOW; or anything not covered here. In a handoff reply say a team member will contact them, and do not repeat any loan detail.
7. If the audio was unclear (e.g. [inaudible], [noise]) ask them to repeat; do not guess.
8. If the borrower interrupted you, respond to what they just said; do not repeat your previous message.

FLOW: IDENTITY → DISCLOSE → (FAQ) → PROMISE → CLOSE, or HANDOFF from any state.
- IDENTITY: when the borrower confirms they are ${card.borrowerName}, set next_state to PROMISE and in the same reply state the EMI amount and due date and ask by when they will pay.
- PROMISE: the system parses the date the borrower gives. If the SYSTEM NOTE says VALID, confirm that date and close politely (next_state CLOSE, intent promise_given, promise_date = that date). If they say they already paid, thank them and close (intent already_paid). If vague, ask once more for a specific date; after two vague answers close politely.
- FAQ answers return to PROMISE.

OUTPUT: a JSON object with keys reply, intent, next_state, handoff_reason, promise_date, language.
intent is one of: ${INTENTS.join(', ')}.
next_state must be one of the legal next states listed in the SYSTEM NOTE.`;
}

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    intent: { type: 'STRING', enum: [...INTENTS] },
    next_state: { type: 'STRING', enum: ['IDENTITY', 'DISCLOSE', 'FAQ', 'PROMISE', 'CLOSE', 'HANDOFF'] },
    handoff_reason: { type: 'STRING', nullable: true },
    promise_date: { type: 'STRING', nullable: true },
    language: { type: 'STRING', enum: ['hinglish', 'english', 'marathi_english', 'hindi_deva'] },
  },
  required: ['reply', 'intent', 'next_state'],
};

function systemNote(m: MachineState, promise: PromiseParse, validity: PromiseValidity, interrupted: boolean): string {
  const parts = [
    `current_state=${m.state}`,
    `identity_confirmed=${m.identityConfirmed}`,
    `legal_next_states=${LEGAL_NEXT[m.state].filter((s) => s !== 'ENDED' && s !== 'GREETING').join('|')}`,
  ];
  if (promise.date) parts.push(`borrower_promise_date=${promise.date} (${formatCardDate(promise.date)}) ${validity === 'ok' ? 'VALID' : validity.toUpperCase()}`);
  else if (promise.vague) parts.push('borrower_promise_date=VAGUE');
  if (interrupted) parts.push('borrower_interrupted_you=true');
  return `[SYSTEM NOTE, not spoken by the borrower: ${parts.join('; ')}]`;
}

// ---------------------------------------------------------------------------

export interface CallSession {
  card: PolicyCard;
  settings: Settings;
  record: CallRecord;
  history: { speaker: 'agent' | 'borrower'; text: string }[];
  lastAgentFull: string;
}

let idCounter = 0;
export function newId(prefix = 'call'): string {
  idCounter++;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function startCall(card: PolicyCard, settings: Settings, lang: Lang, mode: 'live' | 'demo', meta: { scenarioId?: string; runIndex?: number } = {}): CallSession {
  const g = greeting(lang, card);
  let machine = initialMachine();
  machine = transition(machine, 'GREETED').next;
  const greetingViolations = checkScript(g, { identityConfirmed: false, disclosesFacts: disclosesLoanFacts(g), isGreeting: true });
  const record: CallRecord = {
    id: newId(meta.scenarioId ?? 'call'),
    scenarioId: meta.scenarioId,
    runIndex: meta.runIndex,
    startedAt: new Date().toISOString(),
    model: mode === 'demo' ? 'hand-written (demo)' : settings.model,
    mode,
    greetingLang: lang,
    greeting: g,
    greetingViolations,
    turns: [],
    machine,
    outcome: outcomeOf(machine),
    costInr: 0,
  };
  return { card, settings, record, history: [{ speaker: 'agent', text: g }], lastAgentFull: g };
}

function truncateForInterrupt(text: string): string {
  const words = text.split(/\s+/);
  const keep = Math.max(3, Math.floor(words.length * 0.45));
  return words.slice(0, keep).join(' ') + ' — [borrower interrupted here]';
}

/** Map the model's proposed state change onto state-machine events (possibly two, e.g. confirm + close). */
export function eventsFor(from: CallState, to: CallState, p: Proposal, validity: PromiseValidity): CallEvent[] {
  if (to === 'HANDOFF') return ['HANDOFF_TRIGGER'];
  if (from === 'IDENTITY') {
    if (to === 'IDENTITY') return ['IDENTITY_UNCLEAR'];
    const rest = eventFor('DISCLOSE', to, p, validity);
    return rest ? ['IDENTITY_CONFIRMED', rest] : ['IDENTITY_CONFIRMED'];
  }
  const e = eventFor(from, to, p, validity);
  return e ? [e] : [];
}

function eventFor(from: CallState, to: CallState, p: Proposal, validity: PromiseValidity): CallEvent | null {
  if (to === 'FAQ') return 'FAQ_ASKED';
  if (to === 'CLOSE') {
    if (p.intent === 'already_paid') return 'ALREADY_PAID';
    if (validity === 'ok' && (p.intent === 'promise_given' || p.promise_date)) return 'PROMISE_VALID';
    return 'MAX_RETRIES';
  }
  if (to === 'PROMISE') {
    if (from === 'FAQ') return 'FAQ_ANSWERED';
    if (from === 'DISCLOSE') return 'DISCLOSED';
    if (p.intent === 'vague') return 'PROMISE_VAGUE';
    return null; // stays in PROMISE (e.g. ask_repeat)
  }
  if (to === 'DISCLOSE') return null;
  return null;
}

/** Process one borrower turn. Mutates the session. */
export async function runTurn(session: CallSession, borrowerText: string, proposer: Proposer, opts: { interrupted?: boolean; sttMs?: number } = {}): Promise<TurnRecord> {
  const { card, settings, record } = session;
  const machine = record.machine;
  const interrupted = !!opts.interrupted;

  if (interrupted && session.history.length && session.history[session.history.length - 1].speaker === 'agent') {
    session.history[session.history.length - 1] = { speaker: 'agent', text: truncateForInterrupt(session.lastAgentFull) };
  }

  const borrowerLang = detectLanguage(borrowerText);
  const handoffHits = detectHandoff(borrowerText);
  const alreadyPaid = detectAlreadyPaid(borrowerText);
  const promise = parsePromiseDate(borrowerText, card);
  const validity = validatePromise(promise.date, card);
  const note = systemNote(machine, promise, validity, interrupted);

  const allowed = allowedFactsFromCard(card, validity === 'ok' && promise.date ? [promise.date] : []);
  const attempts: Attempt[] = [];
  const events: FailureEvent[] = [];
  let accepted: Proposal | null = null;
  let replySource: TurnRecord['replySource'] = 'model';
  let rejection: ProposerContext['rejection'];

  for (let a = 0; a < 2 && !accepted; a++) {
    const res = await proposer({ card, machine, history: session.history, borrowerText, systemNote: note, rejection });
    const att: Attempt = {
      proposal: res.proposal,
      rawText: res.rawText,
      latencyMs: res.latencyMs,
      usage: res.usage,
      costInr: costInr(res.usage, settings),
      numberGuard: null,
      script: [],
      flowLegal: true,
      promiseMismatch: null,
      rejected: [],
      error: res.error,
    };
    attempts.push(att);
    if (res.error && !res.proposal) {
      att.rejected.push(`api error: ${res.error}`);
      if (a === 0) events.push({ category: 'api_error', detail: res.error, caught: true });
      break;
    }
    const p = res.proposal;
    if (!p || typeof p.reply !== 'string' || !p.reply.trim()) {
      att.rejected.push('malformed output (not valid JSON with a reply)');
      events.push({ category: 'malformed_output', detail: res.rawText.slice(0, 160), caught: true });
      rejection = { draft: res.rawText.slice(0, 400), reasons: att.rejected };
      continue;
    }
    const to = String(p.next_state) as CallState;
    att.flowLegal = isLegal(machine.state, to) && to !== 'ENDED';
    if (!att.flowLegal) att.rejected.push(`illegal transition ${machine.state} → ${p.next_state}`);

    const idConfirmedAfter = machine.identityConfirmed || (machine.state === 'IDENTITY' && ['DISCLOSE', 'PROMISE', 'FAQ'].includes(to));
    // Handoff replies must not carry loan facts at all.
    att.numberGuard = checkNumbers(p.reply, allowed);
    if (!att.numberGuard.ok) att.rejected.push(...att.numberGuard.violations.map((v) => v.reason));
    att.script = checkScript(p.reply, { identityConfirmed: idConfirmedAfter, disclosesFacts: disclosesLoanFacts(p.reply) });
    if (att.script.length) att.rejected.push(...att.script.map((v) => `script: ${v.type} ("${v.matched}")`));

    if (to === 'CLOSE' && (p.intent === 'promise_given' || p.promise_date)) {
      if (validity !== 'ok') att.promiseMismatch = `model closed with a promise but code parsed ${promise.date ?? 'no date'} (${validity})`;
      else if (p.promise_date && p.promise_date !== promise.date) att.promiseMismatch = `model promise_date ${p.promise_date} ≠ code-parsed ${promise.date}`;
    }
    if (att.promiseMismatch) att.rejected.push(att.promiseMismatch);

    // Model-level failure events (first attempt and retry both counted; caught because we block them).
    if (att.numberGuard && !att.numberGuard.ok) events.push({ category: 'invented_number', detail: att.numberGuard.violations.map((v) => v.reason).join('; '), caught: true });
    if (att.script.length) events.push({ category: 'script_violation', detail: att.script.map((v) => v.type).join(', '), caught: true });
    if (!att.flowLegal) events.push({ category: 'flow_deviation', detail: `${machine.state} → ${p.next_state}`, caught: true });
    if (att.promiseMismatch) events.push({ category: 'wrong_promise_date', detail: att.promiseMismatch, caught: true });

    if (att.rejected.length === 0) {
      accepted = p;
      replySource = a === 0 ? 'model' : 'model_retry';
    } else {
      rejection = { draft: p.reply, reasons: att.rejected };
    }
  }

  let reply: string;
  let next = machine;
  const forceHandoff = (reason: string, source: TurnRecord['replySource']) => {
    reply = handoffLine(borrowerLang === 'unknown' ? record.greetingLang : borrowerLang);
    next = transition(machine, 'HANDOFF_TRIGGER', { reason }).next;
    replySource = source;
  };

  if (!accepted) {
    const apiFailed = attempts.some((x) => x.error && !x.proposal);
    forceHandoff(apiFailed ? 'api_error' : 'guard_block', apiFailed ? 'error' : 'guard_block');
  } else {
    const to = String(accepted.next_state) as CallState;
    reply = accepted.reply;
    // Backstop 1: code saw a handoff trigger, model did not hand off.
    if (handoffHits.length && to !== 'HANDOFF') {
      events.push({ category: 'missed_handoff', detail: `code detected "${handoffHits[0].matched}" (${handoffHits[0].reason}); model chose ${to}`, caught: true });
      forceHandoff(handoffHits[0].reason, 'forced_handoff');
    } else if (validity === 'outside_window' && to !== 'HANDOFF' && to !== 'PROMISE') {
      // Backstop 2: out-of-window promise must go to a human (re-asking in PROMISE is acceptable).
      events.push({ category: 'wrong_promise_date', detail: `promise ${promise.date} outside window; model chose ${to}`, caught: true });
      forceHandoff('date_outside_window', 'forced_handoff');
    } else {
      for (const ev of eventsFor(machine.state, to, accepted, validity)) {
        const payload = ev === 'PROMISE_VALID' ? { date: promise.date ?? undefined } : ev === 'HANDOFF_TRIGGER' ? { reason: accepted.handoff_reason || handoffHits[0]?.reason || 'model_initiated' } : {};
        const t = transition(next, ev, payload);
        if (t.ok) next = t.next;
      }
      if (to === 'HANDOFF' && validity === 'outside_window' && !accepted.handoff_reason) next = { ...next, handoffReason: 'date_outside_window' };
    }
  }

  // Calls end after CLOSE or HANDOFF lines are spoken.
  if (next.state === 'CLOSE' || next.state === 'HANDOFF') {
    const t = transition(next, 'CLOSED');
    if (t.ok) next = t.next;
  }

  const agentLang = detectLanguage(reply!);
  const mm = languageMismatch(borrowerLang, agentLang);
  if (mm === 'hard') events.push({ category: 'language_mismatch', detail: `borrower ${borrowerLang}, agent ${agentLang}`, caught: false });

  if (interrupted && overlap(reply!, session.lastAgentFull) > 0.8 && reply!.split(/\s+/).length >= 6) {
    events.push({ category: 'talked_over_interruption', detail: 'reply repeats the interrupted message instead of responding', caught: false });
  }

  const llmLatencyMs = attempts.reduce((s, a) => s + a.latencyMs, 0);
  if (record.mode === 'live' && llmLatencyMs > settings.latencyThresholdMs) {
    events.push({ category: 'latency_over_threshold', detail: `${Math.round(llmLatencyMs)} ms > ${settings.latencyThresholdMs} ms`, caught: false });
  }
  const turnCost = attempts.reduce((s, a) => s + a.costInr, 0);

  const turn: TurnRecord = {
    index: record.turns.length,
    borrowerText,
    interrupted,
    borrowerLang,
    analysis: { handoffHits, alreadyPaid, promise, validity },
    attempts,
    reply: reply!,
    replySource,
    agentLang,
    stateBefore: machine.state,
    stateAfter: next.state,
    events,
    llmLatencyMs,
    costInr: turnCost,
    sttMs: opts.sttMs,
  };
  record.turns.push(turn);
  record.machine = next;
  record.outcome = outcomeOf(next);
  record.costInr += turnCost;
  session.history.push({ speaker: 'borrower', text: borrowerText }, { speaker: 'agent', text: reply! });
  session.lastAgentFull = reply!;
  return turn;
}

export function isEnded(session: CallSession): boolean {
  return session.record.machine.state === 'ENDED';
}
