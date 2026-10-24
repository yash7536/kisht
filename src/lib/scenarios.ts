/** Scenario schema + validator (no external deps). Used by the app and by tests. */

import { HANDOFF_REASONS, type HandoffReason } from './handoff';
import type { Lang } from './language';

export const LANGUAGES: Lang[] = ['hinglish', 'english', 'marathi_english', 'hindi_deva'];

export const PERSONAS = [
  'cooperative', 'busy', 'angry', 'confused_elderly', 'wrong_number', 'family_member', 'hardship', 'dispute',
  'asks_interest_rate', 'asks_fee_waiver', 'abusive', 'already_paid', 'faq_seeker', 'date_change',
] as const;
export type Persona = (typeof PERSONAS)[number];

export const DISRUPTIONS = ['clean', 'interruption', 'self_correction', 'noise', 'off_script'] as const;
export type Disruption = (typeof DISRUPTIONS)[number];

export const MUST_NOT = [
  'invented_number', 'threat', 'disclose_before_identity', 'accept_out_of_window_date', 'discuss_other_loan',
  'answer_rate_question', 'promise_waiver', 'ask_sensitive_data', 'disclose_to_third_party', 'english_only_reply', 'repeat_after_interrupt',
] as const;
export type MustNot = (typeof MUST_NOT)[number];

export interface ScenarioTurn {
  text: string;
  /** Borrower starts speaking while the agent is still talking (barge-in). */
  interrupt?: boolean;
}

export type Expected =
  | { outcome: 'promise'; promiseDate: string }
  | { outcome: 'handoff'; handoffReason: HandoffReason }
  | { outcome: 'closed'; closeReason: 'already_paid' | 'no_promise' };

export interface Scenario {
  id: string;
  title: string;
  language: Lang;
  persona: Persona;
  disruptions: Disruption[];
  turns: ScenarioTurn[];
  expected: Expected;
  mustNotHappen: MustNot[];
  notes?: string;
  provenance: 'drafted_with_ai_assistance';
  reviewed: boolean;
}

export function validateScenario(s: unknown): string[] {
  const e: string[] = [];
  const o = s as Record<string, any>;
  if (!o || typeof o !== 'object') return ['not an object'];
  if (typeof o.id !== 'string' || !/^S\d{3}$/.test(o.id)) e.push(`bad id ${o.id}`);
  if (typeof o.title !== 'string' || !o.title) e.push('missing title');
  if (!LANGUAGES.includes(o.language)) e.push(`bad language ${o.language}`);
  if (!(PERSONAS as readonly string[]).includes(o.persona)) e.push(`bad persona ${o.persona}`);
  if (!Array.isArray(o.disruptions) || !o.disruptions.length || o.disruptions.some((d: string) => !(DISRUPTIONS as readonly string[]).includes(d))) e.push('bad disruptions');
  if (!Array.isArray(o.turns) || o.turns.length < 1 || o.turns.some((t: any) => typeof t?.text !== 'string' || !t.text.trim())) e.push('bad turns');
  const x = o.expected;
  if (!x || !['promise', 'handoff', 'closed'].includes(x.outcome)) e.push('bad expected.outcome');
  else if (x.outcome === 'promise' && !/^\d{4}-\d{2}-\d{2}$/.test(x.promiseDate ?? '')) e.push('promise needs promiseDate');
  else if (x.outcome === 'handoff' && !HANDOFF_REASONS.includes(x.handoffReason)) e.push(`bad handoffReason ${x.handoffReason}`);
  else if (x.outcome === 'closed' && !['already_paid', 'no_promise'].includes(x.closeReason)) e.push('bad closeReason');
  if (!Array.isArray(o.mustNotHappen) || o.mustNotHappen.some((m: string) => !(MUST_NOT as readonly string[]).includes(m))) e.push('bad mustNotHappen');
  if (o.provenance !== 'drafted_with_ai_assistance') e.push('provenance must be drafted_with_ai_assistance');
  if (typeof o.reviewed !== 'boolean') e.push('reviewed must be boolean');
  if (o.turns?.some((t: any) => t.interrupt) && !o.disruptions?.includes('interruption')) e.push('interrupt turn without interruption disruption');
  return e;
}

export function parseScenariosJsonl(raw: string): { scenarios: Scenario[]; errors: string[] } {
  const scenarios: Scenario[] = [];
  const errors: string[] = [];
  raw.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const obj = JSON.parse(line);
      const errs = validateScenario(obj);
      if (errs.length) errors.push(`line ${i + 1} (${obj.id ?? '?'}): ${errs.join('; ')}`);
      else scenarios.push(obj as Scenario);
    } catch (err) {
      errors.push(`line ${i + 1}: invalid JSON (${(err as Error).message})`);
    }
  });
  const ids = new Set<string>();
  for (const s of scenarios) {
    if (ids.has(s.id)) errors.push(`duplicate id ${s.id}`);
    ids.add(s.id);
  }
  return { scenarios, errors };
}

export function countBy<T>(items: T[], key: (t: T) => string | string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    for (const kk of Array.isArray(k) ? k : [k]) out[kk] = (out[kk] ?? 0) + 1;
  }
  return out;
}
