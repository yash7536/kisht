/**
 * Code-side handoff detector. This is a BACKSTOP: the model is asked to hand off on its own;
 * if it does not, and this detector fires on the borrower's turn, code forces the handoff and
 * logs a "missed handoff (caught by backstop)" against the model.
 *
 * Honesty note: these patterns were written alongside the scripted scenarios, so their recall on
 * scripted data is optimistic. Recall on real callers is unknown until docs/REAL_USER_TEST.md is run.
 */

export type HandoffReason =
  | 'abuse'
  | 'bereavement'
  | 'legal_complaint'
  | 'wrong_number'
  | 'third_party'
  | 'hardship'
  | 'dispute'
  | 'interest_rate'
  | 'fee_waiver'
  | 'other_loan'
  | 'date_change'
  | 'date_outside_window'
  | 'human_requested'
  | 'stop_calling'
  | 'callback_requested'
  | 'unclear_identity'
  | 'guard_block'
  | 'unsupported_language';

export const HANDOFF_REASONS: HandoffReason[] = [
  'abuse', 'bereavement', 'legal_complaint', 'wrong_number', 'third_party', 'hardship', 'dispute', 'interest_rate',
  'fee_waiver', 'other_loan', 'date_change', 'date_outside_window', 'human_requested', 'stop_calling', 'callback_requested',
  'unclear_identity', 'guard_block', 'unsupported_language',
];

export const HANDOFF_LABELS: Record<HandoffReason, string> = {
  abuse: 'Abusive caller',
  bereavement: 'Borrower deceased / bereavement',
  legal_complaint: 'Complaint, legal or regulator mention',
  wrong_number: 'Wrong number',
  third_party: 'Someone else answered',
  hardship: 'Financial or medical hardship',
  dispute: 'Disputes amount or loan',
  interest_rate: 'Asks about interest rate',
  fee_waiver: 'Asks to waive a charge',
  other_loan: "Asks about someone else's loan",
  date_change: 'Wants to change EMI date',
  date_outside_window: 'Promise date outside allowed window',
  human_requested: 'Asks for a human',
  stop_calling: 'Asks not to be called',
  callback_requested: 'Asks to be called later',
  unclear_identity: 'Identity not confirmed',
  guard_block: 'Guard blocked the model twice',
  unsupported_language: 'Language not supported',
};

/** Patterns are matched against lower-cased text. Order = priority. */
const RULES: [HandoffReason, RegExp[]][] = [
  ['abuse', [
    /\[abuse\]|\[gaali\]|\[abusive language\]/,
    /\b(bakwas|bakwaas)\s+(band|mat)|\bchup\s+(kar|karo|baith)|\bbewakoof|\bidiot|\bshut up|\bnalayak|\bharami|\bgadh(a|e)\b|\bstupid\b|\bmurkh|\bbaklya|\bbakwas kar/,
    /बकवास बंद|चुप कर|बेवकूफ|नालायक|गधे/,
  ]],
  ['bereavement', [
    /guzar\s+gaye|guzar\s+gay|passed\s+away|expire\s+ho\s+gaye|nahi\s+rahe|dead\b|maut\s+ho|gele\s+te|vaarle|वारले|गुजर गए|नहीं रहे|देहांत/,
  ]],
  ['legal_complaint', [
    /\bcomplaint\b|\bpolice\b|\blawyer\b|\bvakeel|\bvakil|\bcourt\b|\bombudsman|\brbi\s+(ko|la|me|mein)|\bconsumer\s+forum|\bsue\b|शिकायत|तक्रार|पुलिस|वकील/,
  ]],
  ['wrong_number', [
    /wrong\s+number|rong\s+number|galat\s+number|chukicha\s+number|chukicha\s+no|yahan\s+koi\s+\w+\s+nahi|koi\s+ramesh\s+nahi|no\s+ramesh|don'?t\s+know\s+(any\s+)?ramesh|ramesh\s+(naam\s+ka\s+)?koi\s+nahi|ithe\s+koni\s+ramesh|गलत नंबर|चुकीचा नंबर|कोई रमेश नहीं|इथे कोणी/,
  ]],
  ['third_party', [
    /main\s+(unki|unka|unke|inki|inka)\s+(wife|patni|beti|beta|bhai|behen|mother|maa|mummy|papa|father|bahu)/,
    /\b(i am|i'm|this is)\s+(his|their)\s+(wife|son|daughter|brother|sister|mother|father)/,
    /\b(wo|woh|vo|ve|papa|pati|husband|bhaiya|sahab)\s+(ghar\s+pe|ghar\s+par|abhi)\s+nahi/,
    /\bhe\s+is\s+(not\s+(home|here|available)|out|at\s+work)/,
    /mi\s+(tyanchi|tyancha|tyanchya)\s+(bayko|mulgi|mulga|aai|bhau|baba)|te\s+ghari\s+nahi(t|yet)?|ghari\s+nahit/,
    /मैं उनकी (पत्नी|बेटी|माँ|मां|बहू)|मैं उनका (बेटा|भाई)|वो घर पर नहीं|ते घरी नाहीत|मी त्यांची/,
  ]],
  ['hardship', [
    /(job|naukri|nokri|naukari|kaam)\s+(chali|chala|gayi|gaya|chhoot|chhut|geli|gela|lost)|lost\s+my\s+job|laid\s+off|nokri\s+geli/,
    /\bhospital|\bbimaar|\bbimar|\bsurgery|\boperation\b|\baccident|\bmedical\b|\bdavakhan|\bdawakhana|admit\s+(hai|hain|ahe|aahe)/,
    // Deliberately NOT matching "5 tak nahi de paunga" or "can't pay on the 5th": those are usually
    // a self-correction towards a later date, handled by the promise parser and window check.
    /paise\s+(hi\s+)?nahi\s+(hai|hain|hote|ahet|aahet)|paisa\s+nahi\s+hai|bilkul\s+nahi\s+de\s+paunga|can'?t\s+afford|cannot\s+pay\s+at\s+all|can'?t\s+pay\s+at\s+all|unable\s+to\s+pay\s+(anything|at\s+all)|paise\s+nahit|ghar\s+chalana\s+mushkil/,
    /पैसे नहीं|नौकरी चली|अस्पताल|बीमार|नोकरी गेली|पैसे नाहीत|दवाखान्यात/,
  ]],
  ['dispute', [
    /galat\s+(amount|hai|charge|emi|lag)|amount\s+galat|wrong\s+amount|amount\s+is\s+wrong|not\s+my\s+loan|maine\s+(koi\s+)?loan\s+(liya\s+hi\s+nahi|nahi\s+liya)|loan\s+(liya\s+hi|ghetla\s+ch)\s+nahi|already\s+closed|loan\s+(band|close)\s+(kar\s+diya|ho\s+gaya|zala|jhala)|\bfraud\b|\bdispute|chukicha\s+amount|amount\s+chukicha|itna\s+kaise|itke\s+kase|why\s+so\s+much/,
    /गलत (राशि|अमाउंट|है)|लोन लिया ही नहीं|चुकीची रक्कम|धोखा/,
  ]],
  ['interest_rate', [
    /\binterest\b|\bbyaj|\bbyaaj|\bvyaj|\bvyaaj|\brate\s+(kya|kitna|kiti|kay|of)|kitna\s+rate|\broi\b|\bapr\b|ब्याज|व्याज/,
  ]],
  ['fee_waiver', [
    /\b(waive|waiver)\b/,
    /(charge|fee|penalty|late\s*fee|fine|dand)\s*(\w+\s+){0,3}(maaf|maf|hata|hatao|kam\s+kar|nako|cancel|remove)/,
    /(maaf|maf|hata|hatao|remove|cancel)\s+(kar|karo|kijiye|kara|kar\s+do)?\s*(\w+\s+){0,2}(charge|fee|penalty|fine)/,
    /शुल्क माफ|चार्ज माफ|दंड माफ/,
  ]],
  ['other_loan', [
    /(bhai|papa|wife|mummy|mother|father|dost|friend|beta|bete|behen|sister|brother|bayko|baba|aai|bhau)\s*(ka|ki|ke|cha|chi|che|'s)?\s+loan/,
    /(dusre|dusra|other|doosre)\s+loan/,
  ]],
  ['date_change', [
    /date\s+(change|badal|shift|aage)|change\s+(the\s+|my\s+)?(emi\s+)?date|tareekh\s+badal|tarikh\s+badal|tarikh\s+(aage|change)|emi\s+date\s+(badal|change|shift)|tarakh\s+badla|date\s+badla|तारीख बदल|तारीख बदला/,
  ]],
  ['human_requested', [
    /insaan\s+se|kisi\s+(aadmi|insaan|banda|person)|real\s+person|human\b|agent\s+se\s+baat|manager\s+se|customer\s+care\s+se|officer\s+se|manasashi|manus\s+(dya|de)|माणसाशी|इंसान से|किसी व्यक्ति/,
  ]],
  ['stop_calling', [
    /call\s+mat\s+kar|phone\s+mat\s+kar|don'?t\s+call|stop\s+calling|phone\s+karu\s+naka|call\s+karu\s+naka|दोबारा फोन मत|फोन मत करना|फोन करू नका/,
  ]],
  ['callback_requested', [
    /baad\s+mein\s+(call|phone)|baad\s+me\s+(call|phone)|call\s+back|call\s+me\s+later|nantar\s+(call|phone)|thodya\s+vela(ne|nantar)|shaam\s+ko\s+(call|phone)|बाद में (कॉल|फोन)|नंतर (कॉल|फोन)/,
  ]],
];

export interface HandoffHit {
  reason: HandoffReason;
  matched: string;
}

export function detectHandoff(text: string): HandoffHit[] {
  const t = text.toLowerCase();
  const hits: HandoffHit[] = [];
  for (const [reason, res] of RULES) {
    for (const re of res) {
      const m = t.match(re);
      if (m) {
        hits.push({ reason, matched: m[0] });
        break;
      }
    }
  }
  return hits;
}

export function primaryHandoff(text: string): HandoffHit | null {
  const hits = detectHandoff(text);
  return hits.length ? hits[0] : null;
}

const ALREADY_PAID = [
  /already\s+paid|pay\s+kar\s+(diya|di|chuka)|payment\s+(kar\s+)?(diya|ho\s+gaya|ho\s+gayi|kela|zala|jhala|done)|bhar\s+(diya|di|chuka)|bharle|bharla|bharli|jama\s+kar\s+(diya|di)|paid\s+it|have\s+paid|i\s+paid|भर दिया|जमा कर दिया|भरले|पेमेंट कर दिया|पेमेंट झाले/,
];

export function detectAlreadyPaid(text: string): boolean {
  const t = text.toLowerCase();
  return ALREADY_PAID.some((re) => re.test(t));
}
