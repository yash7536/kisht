/**
 * Parse the promise-to-pay date out of a borrower utterance, including self-corrections:
 *   "8 ko... nahi nahi 10 ko de dunga"  -> 10th
 *   "9 ko nahi ho payega"              -> no date (the 9th was refused)
 *   "kal kar dunga"                     -> call date + 1
 * The code (not the model) is the source of truth for the promise date.
 */

import { extractMentions, normWord, tokenize } from './numbers';
import { parseIso, toIso, type PolicyCard } from './policyCard';

export interface PromiseParse {
  /** ISO date, or null when no concrete date was given. */
  date: string | null;
  /** The text fragment the date came from. */
  raw: string | null;
  /** True when the borrower named more than one date (self-correction). */
  corrected: boolean;
  /** True when the borrower gave a vague time ("salary aane pe", "next week"). */
  vague: boolean;
  /** All candidate dates in order, with whether each was retracted. */
  candidates: { date: string; raw: string; retracted: boolean }[];
}

export type PromiseValidity = 'ok' | 'in_past' | 'outside_window' | 'none';

// Only strong negations. "na" / "no" are left out: "8 ko de dunga na?" is not a retraction.
const NEGATIONS = new Set(['nahi', 'nahin', 'nai', 'not', 'cant', 'cannot', 'nako', 'nahiye', 'jamnar', 'नहीं', 'नही', 'नाही', 'नको'].map(normWord));
/** "koi problem nahi", "no tension" style negations do not retract a date. */
const NEG_BEFORE_IGNORE = new Set(['koi', 'kuch', 'kahi', 'काही', 'कोई'].map(normWord));
const NEG_AFTER_IGNORE = new Set(['problem', 'tension', 'chinta', 'issue', 'dikkat', 'फिकर', 'चिंता', 'दिक्कत'].map(normWord));

const RELATIVE: [string[], number][] = [
  [['aaj', 'today', 'aj', 'आज'], 0],
  [['kal', 'tomorrow', 'udya', 'udyaa', 'कल', 'उद्या'], 1],
  [['parson', 'parso', 'parva', 'परसों', 'परवा'], 2],
];
const RELATIVE_MAP = new Map<string, number>();
for (const [ws, off] of RELATIVE) for (const w of ws) RELATIVE_MAP.set(normWord(w), off);

const WEEKDAYS: [string[], number][] = [
  [['sunday', 'ravivar', 'itvaar', 'रविवार'], 0],
  [['monday', 'somvar', 'somvaar', 'सोमवार'], 1],
  [['tuesday', 'mangalvar', 'mangalvaar', 'मंगलवार', 'मंगळवार'], 2],
  [['wednesday', 'budhvar', 'budhvaar', 'बुधवार'], 3],
  [['thursday', 'guruvar', 'guruvaar', 'veervaar', 'गुरुवार'], 4],
  [['friday', 'shukravar', 'shukravaar', 'शुक्रवार'], 5],
  [['saturday', 'shanivar', 'shanivaar', 'शनिवार'], 6],
];
const WEEKDAY_MAP = new Map<string, number>();
for (const [ws, d] of WEEKDAYS) for (const w of ws) WEEKDAY_MAP.set(normWord(w), d);

const VAGUE_PATTERNS = [
  /salary\s+(aane|aayegi|ayegi|milne|aali|yeil)/i,
  /pagar\s+(aala|zala|jhala|yeil|aalyavar)/i,
  /jab\s+paise/i,
  /paise\s+(aane|aate|aayenge)/i,
  /next\s+week|agle\s+hafte|pudhchya\s+athavad|pudhcya/i,
  /\bjaldi\b|\bsoon\b|\blater\b|dekhta\s+hoon|dekhte\s+hain|baghto|baghte/i,
  /mahine\s+ke\s+(end|aakhir)|end\s+of\s+(the\s+)?month/i,
  /वेतन|तनख्वाह|जब पैसे|अगले हफ्ते|पगार/,
];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function resolveDayOfMonth(day: number, month: number | undefined, year: number | undefined, callDate: string): string {
  const call = parseIso(callDate);
  if (month !== undefined) {
    let y = year ?? call.year;
    if (year === undefined && (month < call.month || (month === call.month && day < call.day))) y += 1;
    return toIso({ day, month, year: y });
  }
  // Bare day: this month if not yet passed, otherwise next month.
  if (day >= call.day) return toIso({ day, month: call.month, year: call.year });
  const m = call.month === 12 ? 1 : call.month + 1;
  const y = call.month === 12 ? call.year + 1 : call.year;
  return toIso({ day, month: m, year: y });
}

export function parsePromiseDate(text: string, card: Pick<PolicyCard, 'callDate'>): PromiseParse {
  const toks = tokenize(text);
  type Cand = { index: number; date: string; raw: string };
  const cands: Cand[] = [];

  for (const m of extractMentions(text)) {
    if (m.kind !== 'date') continue;
    if (m.value < 1 || m.value > 31) continue;
    cands.push({ index: m.index, date: resolveDayOfMonth(m.value, m.month, m.year, card.callDate), raw: m.raw });
  }
  toks.forEach((t, i) => {
    if (t.kind !== 'word') return;
    if (RELATIVE_MAP.has(t.n)) {
      // "kal" followed by a past-tense verb ("kal kar diya") is yesterday, not a promise.
      const nextFew = toks.slice(i + 1, i + 7).map((x) => x.n).join(' ');
      if (/(diya|di|kiya|bhara|bharle|bharla|kela|paid|ho gaya|ho gaye|zala|jhala)\b|दिया|दी|किया|भरले|भरला|केले|झाले/.test(nextFew)) return;
      cands.push({ index: i, date: addDays(card.callDate, RELATIVE_MAP.get(t.n)!), raw: t.raw });
    } else if (WEEKDAY_MAP.has(t.n)) {
      const target = WEEKDAY_MAP.get(t.n)!;
      const cur = new Date(card.callDate + 'T00:00:00Z').getUTCDay();
      let diff = (target - cur + 7) % 7;
      if (diff === 0) diff = 7;
      cands.push({ index: i, date: addDays(card.callDate, diff), raw: t.raw });
    }
  });
  cands.sort((a, b) => a.index - b.index);

  // A candidate is retracted if a negation follows it before the next candidate.
  const negIdx = toks
    .map((t, i) => {
      if (t.kind !== 'word' || !NEGATIONS.has(t.n)) return -1;
      if (toks[i - 1] && NEG_BEFORE_IGNORE.has(toks[i - 1].n)) return -1;
      if (toks[i - 1] && NEG_AFTER_IGNORE.has(toks[i - 1].n)) return -1; // "problem nahi"
      if (toks[i + 1] && NEG_AFTER_IGNORE.has(toks[i + 1].n)) return -1;
      return i;
    })
    .filter((i) => i >= 0);
  const withRetraction = cands.map((c, k) => {
    const nextIdx = k + 1 < cands.length ? cands[k + 1].index : Infinity;
    const retracted = negIdx.some((ni) => ni > c.index && ni < nextIdx && ni - c.index <= 6);
    return { ...c, retracted };
  });

  const live = withRetraction.filter((c) => !c.retracted);
  const chosen = live.length ? live[live.length - 1] : null;
  const vague = !chosen && VAGUE_PATTERNS.some((re) => re.test(text));

  return {
    date: chosen ? chosen.date : null,
    raw: chosen ? chosen.raw : null,
    corrected: cands.length > 1,
    vague,
    candidates: withRetraction.map(({ date, raw, retracted }) => ({ date, raw, retracted })),
  };
}

export function validatePromise(date: string | null, card: Pick<PolicyCard, 'callDate' | 'promiseWindowEnd'>): PromiseValidity {
  if (!date) return 'none';
  if (date < card.callDate) return 'in_past';
  if (date > card.promiseWindowEnd) return 'outside_window';
  return 'ok';
}
