/**
 * Number and date extraction for Hinglish, Marathi-English, English and Hindi (Devanagari).
 *
 * Used for two things:
 *  1. The number guard: every amount / date / number the AGENT says must exist on the policy card.
 *  2. The promise-date parser: read the date the BORROWER promises.
 *
 * Word numerals ("do", "ek", "saath") are also ordinary words in Hindi ("de do", "ek baar", "ke saath"),
 * so a word numeral only counts when it sits next to a unit marker (hazaar, rupaye, tareekh, a month
 * name, %, ...). Digits always count. This is a deliberate precision/recall trade-off; see
 * docs/DECISIONS.md.
 */

import type { AllowedFacts } from './policyCard';

export type MentionKind = 'amount' | 'date' | 'percent' | 'duration' | 'time' | 'number';

export interface Mention {
  kind: MentionKind;
  value: number;
  /** For dates: month 1-12 when stated. */
  month?: number;
  year?: number;
  raw: string;
  /** Index of the first token of the phrase (for ordering). */
  index: number;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

export function devanagariDigitsToAscii(s: string): string {
  return s.replace(/[०-९]/g, (c) => String(DEVANAGARI_DIGITS.indexOf(c)));
}

/** Normalise one word: lowercase, collapse repeated letters, z→j, strip Devanagari nukta. */
export function normWord(w: string): string {
  let s = w.toLowerCase().normalize('NFC');
  s = s.replace(/़/g, ''); // nukta
  s = s.replace(/ँ/g, 'ं'); // chandrabindu -> anusvara
  s = s.replace(/['’]/g, '');
  s = s.replace(/z/g, 'j');
  s = s.replace(/([a-z])\1+/g, '$1');
  return s;
}

function buildMap(entries: [number, string[]][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const [v, words] of entries) for (const w of words) m.set(normWord(w), v);
  return m;
}

// Units (values below 100) in romanised Hindi, Marathi, English and Devanagari.
const UNIT_WORDS = buildMap([
  [1, ['ek', 'eik', 'one', 'एक']],
  [2, ['do', 'don', 'two', 'दो', 'दोन']],
  [3, ['teen', 'tin', 'three', 'तीन']],
  [4, ['chaar', 'char', 'four', 'चार']],
  [5, ['paanch', 'panch', 'paach', 'five', 'पांच', 'पाँच', 'पाच']],
  [6, ['chhe', 'che', 'chhah', 'chah', 'saha', 'six', 'छह', 'छः', 'छे', 'सहा']],
  [7, ['saat', 'seven', 'सात']],
  [8, ['aath', 'aat', 'eight', 'आठ']],
  [9, ['nau', 'nao', 'nine', 'नौ', 'नऊ']],
  [10, ['das', 'dus', 'daha', 'ten', 'दस', 'दहा']],
  [11, ['gyarah', 'gyaarah', 'gyara', 'akra', 'eleven', 'ग्यारह', 'अकरा']],
  [12, ['baarah', 'barah', 'bara', 'twelve', 'बारह', 'बारा']],
  [13, ['terah', 'tera', 'thirteen', 'तेरह', 'तेरा']],
  [14, ['chaudah', 'chauda', 'fourteen', 'चौदह', 'चौदा']],
  [15, ['pandrah', 'pandra', 'pandhra', 'fifteen', 'पंद्रह', 'पंधरा']],
  [16, ['solah', 'sola', 'sixteen', 'सोलह', 'सोळा']],
  [17, ['satrah', 'satra', 'seventeen', 'सत्रह', 'सतरा']],
  [18, ['athaarah', 'atharah', 'athra', 'attharah', 'eighteen', 'अठारह', 'अठरा']],
  [19, ['unnees', 'unnis', 'unees', 'ekonis', 'nineteen', 'उन्नीस', 'एकोणीस']],
  [20, ['bees', 'bis', 'vees', 'vis', 'twenty', 'बीस', 'वीस']],
  [21, ['ikkees', 'ikkis', 'ekvis', 'इक्कीस', 'एकवीस']],
  [22, ['baaees', 'bais', 'baais', 'bavis', 'बाईस', 'बावीस']],
  [23, ['teyees', 'teis', 'tevis', 'तेईस', 'तेवीस']],
  [24, ['chaubees', 'chaubis', 'chobis', 'chovis', 'चौबीस', 'चोवीस']],
  [25, ['pachchees', 'pachees', 'pachis', 'pacchis', 'panchvis', 'पच्चीस', 'पंचवीस']],
  [26, ['chhabbees', 'chhabbis', 'chabbis', 'savvis', 'छब्बीस', 'सव्वीस']],
  [27, ['sattaees', 'sattais', 'sattavis', 'सत्ताईस', 'सत्तावीस']],
  [28, ['athaaees', 'athais', 'atthais', 'atthavis', 'अट्ठाईस', 'अठ्ठावीस']],
  [29, ['untees', 'untis', 'ekonatis', 'उनतीस', 'एकोणतीस']],
  [30, ['tees', 'tis', 'thirty', 'तीस']],
  [31, ['ikattees', 'ikattis', 'iktees', 'ekatis', 'इकतीस', 'एकतीस']],
  [35, ['paintees', 'pentis', 'पैंतीस', 'पस्तीस']],
  [40, ['chaalees', 'chalis', 'forty', 'चालीस', 'चाळीस']],
  [45, ['paintaalees', 'pentalis', 'पैंतालीस', 'पंचेचाळीस']],
  [50, ['pachaas', 'pachas', 'pannas', 'fifty', 'पचास', 'पन्नास']],
  [55, ['pachpan', 'पचपन']],
  [60, ['saath', 'sixty', 'साठ']],
  [70, ['sattar', 'seventy', 'सत्तर']],
  [75, ['pachhattar', 'pachattar', 'पचहत्तर', 'पंच्याहत्तर']],
  [80, ['assi', 'aishi', 'eighty', 'अस्सी', 'ऐंशी']],
  [90, ['nabbe', 'navvad', 'ninety', 'नब्बे', 'नव्वद']],
  [99, ['ninyaanve', 'ninyanve', 'निन्यानवे']],
]);

const MULTIPLIERS = buildMap([
  [100, ['sau', 'hundred', 'she', 'सौ', 'शे']],
  [1000, ['hajaar', 'hajar', 'hazaar', 'hazar', 'thousand', 'हजार', 'हज़ार']],
  [100000, ['lakh', 'lac', 'laakh', 'lakhs', 'लाख']],
  [10000000, ['crore', 'karod', 'करोड़', 'कोटी']],
]);

/** Words that only act as numbers after a unit ("don she" = 200), never at the start ("she will pay"). */
const LEADING_FORBIDDEN = new Set(['she', 'शे'].map(normWord));

/** Standalone words that are a full number by themselves. */
const STANDALONE = buildMap([[100, ['shambhar', 'शंभर']]]);

/** Fraction modifiers: value is applied to the following unit/multiplier. */
const FRACTIONS = buildMap([
  [1.5, ['dedh', 'derh', 'दीड', 'डेढ़', 'डेढ']],
  [2.5, ['dhai', 'dhaai', 'adhai', 'adich', 'अडीच', 'ढाई']],
]);
const SAADHE = new Set(['sadhe', 'sade', 'साढे', 'साडे'].map(normWord));
const SAVA = new Set(['sava', 'savva', 'सवा', 'सव्वा'].map(normWord));
const PAUNE = new Set(['paune', 'pone', 'पौने', 'पावणे'].map(normWord));

const ORDINALS = buildMap([
  [1, ['first', 'pehli', 'pehla']],
  [2, ['second', 'dusri']],
  [3, ['third', 'teesri']],
  [4, ['fourth', 'chauthi']],
  [5, ['fifth', 'paanchvi', 'panchvi', 'panchve', 'paanchve', 'पांचवीं', 'पाचवी']],
  [6, ['sixth', 'chhathi']],
  [7, ['seventh', 'saatvi']],
  [8, ['eighth', 'aathvi', 'आठवीं']],
  [9, ['ninth', 'nauvi']],
  [10, ['tenth', 'dasvi', 'दसवीं']],
  [12, ['twelfth']],
  [15, ['fifteenth']],
  [20, ['twentieth']],
]);

export const MONTHS = buildMap([
  [1, ['jan', 'january', 'janvari', 'जनवरी', 'जानेवारी']],
  [2, ['feb', 'february', 'farvari', 'फरवरी', 'फेब्रुवारी']],
  [3, ['march', 'मार्च']],
  [4, ['apr', 'april', 'अप्रैल', 'एप्रिल']],
  // 'mai' is deliberately excluded: in romanised Hindi it usually means "I" (main).
  [5, ['may', 'मई']],
  [6, ['jun', 'june', 'joon', 'जून']],
  [7, ['jul', 'july', 'julai', 'जुलाई', 'जुलै']],
  [8, ['aug', 'august', 'agast', 'अगस्त', 'ऑगस्ट']],
  [9, ['sep', 'sept', 'september', 'sitambar', 'सितंबर', 'सप्टेंबर']],
  [10, ['oct', 'october', 'aktubar', 'अक्टूबर', 'ऑक्टोबर']],
  [11, ['nov', 'november', 'navambar', 'navamber', 'नवंबर', 'नवम्बर', 'नोव्हेंबर']],
  [12, ['dec', 'december', 'disambar', 'दिसंबर', 'डिसेंबर']],
]);

const set = (ws: string[]) => new Set(ws.map(normWord));
const AMOUNT_AFTER = set(['rupaye', 'rupaiye', 'rupay', 'rupaya', 'rupees', 'rupee', 'rs', 'inr', 'rupe', 'rupye', 'रुपये', 'रुपए', 'रुपया', 'रुपयांचा', 'रुपयांची']);
const AMOUNT_BEFORE = set(['₹', 'rs', 'inr']);
const DATE_AFTER = set(['tareekh', 'tarikh', 'tarik', 'tarakh', 'tarkh', 'tarkhe', 'tarkhela', 'tarakhela', 'tarkhepasun', 'date', 'तारीख', 'तारीखको', 'तारखेला', 'तारीख़', 'तारखेपर्यंत']);
const PERCENT = set(['%', 'percent', 'pratishat', 'takke', 'takka', 'प्रतिशत', 'टक्के']);
const DURATION = set(['din', 'days', 'day', 'divas', 'hafte', 'hafta', 'weeks', 'week', 'mahine', 'mahina', 'months', 'month', 'saal', 'years', 'minute', 'minutes', 'min', 'ghante', 'ghanta', 'hours', 'दिन', 'दिवस', 'महीने', 'महिने', 'साल', 'मिनट']);
const TIME_AFTER = set(['baje', 'vajta', 'vajata', 'am', 'pm', 'oclock', 'बजे', 'वाजता']);
const FILLERS = set(['ki', 'ko', 'ke', 'of', 'the', 'tak', 'la', 'pe', 'par', 'se', 'paryant', 'तक', 'को', 'की']);
const CONNECTORS = set(['ya', 'or', 'aur', 'and', 'kiwa', 'kinva', 'kimva', 'va', 'किंवा', 'या', 'और', 'to', 'se']);
const KO = set(['ko', 'को', 'la', 'ला']);

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

interface Tok {
  raw: string;
  n: string; // normalised
  kind: 'digit' | 'word' | 'sym' | 'slashdate' | 'clock';
  num?: number; // for digit tokens
  ordinalSuffix?: boolean;
  d?: number; m?: number; y?: number; // slashdate
}

const TOKEN_RE = /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?!\d)|(\d{1,2}):(\d{2})(?!\d)|₹|%|\d+(?:,\d+)*(?:\.\d+)?(?:st|nd|rd|th)?|[\p{L}\p{M}']+/gu;

export function tokenize(text: string): Tok[] {
  const src = devanagariDigitsToAscii(text);
  const out: Tok[] = [];
  for (const m of src.matchAll(TOKEN_RE)) {
    const raw = m[0];
    if (m[1] !== undefined) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      // Only treat as a date when it looks like one.
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        let y = m[3] ? Number(m[3]) : undefined;
        if (y !== undefined && y < 100) y += 2000;
        out.push({ raw, n: raw, kind: 'slashdate', d, m: mo, y });
        continue;
      }
      // Otherwise fall through as plain digits.
      out.push({ raw: m[1], n: m[1], kind: 'digit', num: Number(m[1]) });
      out.push({ raw: m[2], n: m[2], kind: 'digit', num: Number(m[2]) });
      if (m[3]) out.push({ raw: m[3], n: m[3], kind: 'digit', num: Number(m[3]) });
      continue;
    }
    if (m[4] !== undefined) {
      out.push({ raw, n: raw, kind: 'clock', num: Number(m[4]) });
      continue;
    }
    if (raw === '₹' || raw === '%') {
      out.push({ raw, n: raw, kind: 'sym' });
      continue;
    }
    if (/^\d/.test(raw)) {
      const ord = /(st|nd|rd|th)$/.test(raw);
      const num = Number(raw.replace(/(st|nd|rd|th)$/, '').replace(/,/g, ''));
      out.push({ raw, n: raw, kind: 'digit', num, ordinalSuffix: ord });
      continue;
    }
    out.push({ raw, n: normWord(raw), kind: 'word' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Word-numeral evaluation
// ---------------------------------------------------------------------------

function isNumberWord(n: string): boolean {
  return UNIT_WORDS.has(n) || MULTIPLIERS.has(n) || FRACTIONS.has(n) || SAADHE.has(n) || SAVA.has(n) || PAUNE.has(n) || STANDALONE.has(n);
}

/**
 * Evaluate a run of number words, e.g. ["chaar","hajar","do","sau","pachas"] -> 4250,
 * ["sadhe","char","hajar"] -> 4500, ["dhai","hajar"] -> 2500.
 */
export function evalNumberWords(words: string[]): { value: number; hasMultiplier: boolean } | null {
  let total = 0;
  let current = 0;
  let pendingAdj = 0; // +0.5 saadhe, +0.25 sava, -0.25 paune
  let hasMultiplier = false;
  let any = false;
  for (const w of words) {
    if (UNIT_WORDS.has(w)) {
      current += UNIT_WORDS.get(w)! + pendingAdj;
      pendingAdj = 0;
      any = true;
    } else if (FRACTIONS.has(w)) {
      current += FRACTIONS.get(w)!;
      any = true;
    } else if (STANDALONE.has(w)) {
      current += STANDALONE.get(w)!;
      any = true;
    } else if (SAADHE.has(w)) pendingAdj = 0.5;
    else if (SAVA.has(w)) pendingAdj = 0.25;
    else if (PAUNE.has(w)) pendingAdj = -0.25;
    else if (MULTIPLIERS.has(w)) {
      const mult = MULTIPLIERS.get(w)!;
      hasMultiplier = true;
      any = true;
      if (mult === 100) {
        current = (current || 1) * 100;
      } else {
        total += (current || 1) * mult;
        current = 0;
      }
    } else return null;
  }
  if (!any) return null;
  return { value: Math.round((total + current) * 100) / 100, hasMultiplier };
}

// ---------------------------------------------------------------------------
// Mention extraction
// ---------------------------------------------------------------------------

interface Phrase {
  start: number;
  end: number; // exclusive
  value: number;
  fromWords: boolean;
  hasMultiplier: boolean;
  ordinal: boolean;
  slash?: { d: number; m: number; y?: number };
  clock?: boolean;
}

function findPhrases(toks: Tok[]): Phrase[] {
  const phrases: Phrase[] = [];
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (t.kind === 'slashdate') {
      phrases.push({ start: i, end: i + 1, value: t.d!, fromWords: false, hasMultiplier: false, ordinal: false, slash: { d: t.d!, m: t.m!, y: t.y } });
      i++;
      continue;
    }
    if (t.kind === 'clock') {
      phrases.push({ start: i, end: i + 1, value: t.num!, fromWords: false, hasMultiplier: false, ordinal: false, clock: true });
      i++;
      continue;
    }
    if (t.kind === 'digit') {
      // digits optionally followed by a multiplier word ("4 hajar", "2.5 lakh")
      let value = t.num!;
      let end = i + 1;
      let hasMultiplier = false;
      if (end < toks.length && toks[end].kind === 'word' && MULTIPLIERS.has(toks[end].n)) {
        value = value * MULTIPLIERS.get(toks[end].n)!;
        hasMultiplier = true;
        end++;
      }
      phrases.push({ start: i, end, value, fromWords: false, hasMultiplier, ordinal: !!t.ordinalSuffix });
      i = end;
      continue;
    }
    if (t.kind === 'word' && ORDINALS.has(t.n)) {
      phrases.push({ start: i, end: i + 1, value: ORDINALS.get(t.n)!, fromWords: true, hasMultiplier: false, ordinal: true });
      i++;
      continue;
    }
    if (t.kind === 'word' && isNumberWord(t.n) && !LEADING_FORBIDDEN.has(t.n)) {
      let j = i;
      const words: string[] = [];
      while (j < toks.length && toks[j].kind === 'word' && isNumberWord(toks[j].n)) {
        words.push(toks[j].n);
        j++;
      }
      const ev = evalNumberWords(words);
      if (ev) phrases.push({ start: i, end: j, value: ev.value, fromWords: true, hasMultiplier: ev.hasMultiplier, ordinal: false });
      i = Math.max(j, i + 1);
      continue;
    }
    i++;
  }
  return phrases;
}

function nextMeaningful(toks: Tok[], idx: number): { tok: Tok | undefined; skipped: Tok | undefined } {
  const t = toks[idx];
  if (t && t.kind === 'word' && FILLERS.has(t.n) && !KO.has(t.n)) return { tok: toks[idx + 1], skipped: t };
  return { tok: t, skipped: undefined };
}

export function extractMentions(text: string): Mention[] {
  const toks = tokenize(text);
  const phrases = findPhrases(toks);
  const raw = (p: Phrase) => toks.slice(p.start, p.end).map((t) => t.raw).join(' ');
  const mentions: (Mention | null)[] = [];

  for (const p of phrases) {
    if (p.slash) {
      mentions.push({ kind: 'date', value: p.slash.d, month: p.slash.m, year: p.slash.y, raw: raw(p), index: p.start });
      continue;
    }
    if (p.clock) {
      mentions.push({ kind: 'time', value: p.value, raw: raw(p), index: p.start });
      continue;
    }
    const prev = toks[p.start - 1];
    const prev2 = toks[p.start - 2];
    const after = toks[p.end];
    const { tok: next } = nextMeaningful(toks, p.end);

    let kind: MentionKind | null = null;
    let month: number | undefined;
    let year: number | undefined;

    const isAmountPrefix = (t?: Tok) => !!t && ((t.kind === 'sym' && t.raw === '₹') || (t.kind === 'word' && AMOUNT_BEFORE.has(t.n)));

    if (isAmountPrefix(prev)) kind = 'amount';
    else if (after && ((after.kind === 'sym' && after.raw === '%') || (after.kind === 'word' && PERCENT.has(after.n)))) kind = 'percent';
    else if (next && next.kind === 'word' && AMOUNT_AFTER.has(next.n)) kind = 'amount';
    else if (next && next.kind === 'word' && MONTHS.has(next.n)) {
      kind = 'date';
      month = MONTHS.get(next.n);
      const yTok = toks[toks.indexOf(next) + 1];
      if (yTok && yTok.kind === 'digit' && yTok.num! >= 2000 && yTok.num! < 2100) year = yTok.num;
    } else if (prev && prev.kind === 'word' && MONTHS.has(prev.n) && p.value >= 1 && p.value <= 31 && !p.hasMultiplier) {
      kind = 'date';
      month = MONTHS.get(prev.n);
    } else if (prev2 && prev2.kind === 'word' && MONTHS.has(prev2.n) && prev && prev.kind === 'word' && FILLERS.has(prev.n) && p.value <= 31) {
      kind = 'date';
      month = MONTHS.get(prev2.n);
    } else if (next && next.kind === 'word' && DATE_AFTER.has(next.n)) kind = 'date';
    else if (after && after.kind === 'word' && KO.has(after.n) && p.value >= 1 && p.value <= 31 && !p.hasMultiplier) kind = 'date';
    else if (next && next.kind === 'word' && DURATION.has(next.n)) kind = 'duration';
    else if (next && next.kind === 'word' && TIME_AFTER.has(next.n)) kind = 'time';
    else if (p.hasMultiplier) kind = 'amount';
    else if (p.ordinal && !p.fromWords && p.value <= 31) kind = 'date';
    else if (!p.fromWords) kind = 'number';

    // Year directly after a "5 Nov" style date was consumed as part of the date.
    if (kind === 'number' && p.value >= 2000 && p.value < 2100) {
      const m2 = mentions[mentions.length - 1];
      if (m2 && m2.kind === 'date' && m2.year === p.value) {
        mentions.push(null);
        continue;
      }
    }

    mentions.push(kind ? { kind, value: p.value, month, year, raw: raw(p), index: p.start } : null);
  }

  // Connector propagation: "aath ya das tareekh" -> both are dates.
  for (let k = phrases.length - 2; k >= 0; k--) {
    if (mentions[k]) continue;
    const a = phrases[k];
    const b = phrases[k + 1];
    const between = toks.slice(a.end, b.start);
    const mb = mentions[k + 1];
    if (mb && between.length === 1 && between[0].kind === 'word' && CONNECTORS.has(between[0].n)) {
      mentions[k] = { kind: mb.kind, value: a.value, month: mb.month, year: mb.year, raw: raw(a), index: a.start };
    }
  }

  return mentions.filter((m): m is Mention => m !== null);
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

export interface GuardViolation {
  mention: Mention;
  reason: string;
}

export interface GuardResult {
  ok: boolean;
  mentions: Mention[];
  violations: GuardViolation[];
}

/** Check that every number in `text` is on the card (or is an explicitly allowed extra date). */
export function checkNumbers(text: string, allowed: AllowedFacts): GuardResult {
  const mentions = extractMentions(text);
  const violations: GuardViolation[] = [];
  for (const m of mentions) {
    switch (m.kind) {
      case 'amount':
        if (!allowed.amounts.includes(m.value)) violations.push({ mention: m, reason: `amount ${m.value} is not on the policy card` });
        break;
      case 'date': {
        const match = allowed.dates.some((d) => d.day === m.value && (m.month === undefined || m.month === d.month) && (m.year === undefined || m.year === d.year));
        if (!match) violations.push({ mention: m, reason: `date ${m.value}${m.month ? '/' + m.month : ''} is not on the policy card or the validated promise` });
        break;
      }
      case 'percent':
        violations.push({ mention: m, reason: `percentage ${m.value}% — the card has no rates; rate questions must be handed off` });
        break;
      case 'duration':
        violations.push({ mention: m, reason: `duration "${m.raw}" is not on the policy card` });
        break;
      case 'time':
        violations.push({ mention: m, reason: `time "${m.raw}" is not on the policy card` });
        break;
      case 'number':
        if (!allowed.bare.includes(m.value)) violations.push({ mention: m, reason: `number ${m.value} is not on the policy card` });
        break;
    }
  }
  return { ok: violations.length === 0, mentions, violations };
}

/** Does the text disclose the EMI amount or due date? (used to block disclosure before identity) */
export function disclosesLoanFacts(text: string): boolean {
  return extractMentions(text).some((m) => m.kind === 'amount' || m.kind === 'date');
}
