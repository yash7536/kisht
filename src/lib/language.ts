/**
 * Cheap, explainable language-family detector for code-mixed text. Marker-word counting, not ML.
 * Used for (a) choosing the TTS voice and (b) flagging language mismatch between borrower and agent.
 */

export type Lang = 'hinglish' | 'english' | 'marathi_english' | 'hindi_deva';
export type DetectedLang = Lang | 'unknown';

export const LANG_LABELS: Record<Lang, string> = {
  hinglish: 'Hinglish',
  english: 'English',
  marathi_english: 'Marathi-English',
  hindi_deva: 'Hindi (Devanagari)',
};

const MARATHI = new Set('ahe aahe ahet aahet mi mala tumhi tumcha tumchi tumhala kadhi karto karte karin bharto bharte bharin bharen pahije nako naka mhanje aata udya parva tarkhela zala jhala kela kara nantar hoy barobar kay kasa kashi ka ithe tithe sanga sangto deto dein deil paise ghari bagha baghto thik ahe aho re ani pan na'.split(' '));
const HINDI = new Set('hai hain nahi nahin kya main mein hoon hu karunga karungi dunga dungi kal ji haan han theek thik abhi baad paisa mera meri aap aapka kaun bol raha rahi tha thi ko se ka ki ke kar diya hoga hogi bhai yaar acha accha arre matlab dekho'.split(' '));
const ENGLISH = new Set('the is will pay i you my please yes no can what when okay ok thanks thank sorry speaking this that sure date amount call later'.split(' '));
const MARATHI_DEVA = /आहे|नाही|मी |तुम्ही|करतो|भरतो|पाहिजे|नको|म्हणजे|उद्या|झाले|केले/;

export function detectLanguage(text: string): DetectedLang {
  const clean = text.replace(/\[[^\]]*\]/g, ' ');
  const deva = (clean.match(/[ऀ-ॿ]/g) || []).length;
  const latin = (clean.match(/[a-zA-Z]/g) || []).length;
  if (deva > 0 && deva >= latin) return MARATHI_DEVA.test(clean) ? 'marathi_english' : 'hindi_deva';
  const words = clean.toLowerCase().match(/[a-z']+/g) || [];
  let mr = 0, hi = 0, en = 0;
  for (const w of words) {
    if (MARATHI.has(w)) mr++;
    if (HINDI.has(w)) hi++;
    if (ENGLISH.has(w)) en++;
  }
  if (mr + hi + en < 2) return 'unknown';
  if (mr >= 2 && mr >= hi * 0.6) return 'marathi_english';
  if (hi >= 2 || hi > en * 0.5) return 'hinglish';
  return 'english';
}

export type MismatchSeverity = 'none' | 'soft' | 'hard';

/**
 * hard: borrower speaks an Indian language and agent replies in pure English, or vice versa.
 * soft: right family but wrong variety (Marathi-English borrower answered in Hinglish, Devanagari answered in Roman).
 */
export function languageMismatch(borrower: DetectedLang, agent: DetectedLang): MismatchSeverity {
  if (borrower === 'unknown' || agent === 'unknown' || borrower === agent) return 'none';
  const indic = (l: Lang) => l !== 'english';
  if (borrower === 'english' && indic(agent)) return agent === 'hinglish' ? 'soft' : 'hard';
  if (indic(borrower) && agent === 'english') return 'hard';
  return 'soft';
}

export function speechLangFor(lang: DetectedLang): string {
  return lang === 'english' ? 'en-IN' : lang === 'marathi_english' ? 'mr-IN' : 'hi-IN';
}
