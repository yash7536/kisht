/**
 * Fixed lines the MODEL never writes: the opening (must disclose it is automated, must not reveal
 * loan facts before identity) and the code-forced handoff / guard-block lines (must not contain
 * any loan facts, because the person on the line may not be the borrower).
 */

import type { DetectedLang, Lang } from './language';
import type { PolicyCard } from './policyCard';

export function greeting(lang: Lang, card: PolicyCard): string {
  switch (lang) {
    case 'english':
      return `Hello, this is an automated assistant calling from ${card.lender}. Am I speaking with ${card.borrowerName}?`;
    case 'marathi_english':
      return `Namaskar, mi ${card.lender} kadun automated assistant boltey. Mi ${card.borrowerName} yanchyashi bolte aahe ka?`;
    case 'hindi_deva':
      return `नमस्ते, मैं सहायक फाइनेंस की ओर से एक ऑटोमेटेड असिस्टेंट बोल रही हूँ। क्या मेरी बात रमेश पाटिल जी से हो रही है?`;
    default:
      return `Namaste, main ${card.lender} ki taraf se ek automated assistant bol rahi hoon. Kya meri baat ${card.borrowerName} ji se ho rahi hai?`;
  }
}

export function handoffLine(lang: DetectedLang): string {
  switch (lang) {
    case 'english':
      return 'I understand. A member of our team will get in touch with you about this. Thank you for your time.';
    case 'marathi_english':
      return 'Samajla. Yasathi aamchya team madhla ek vyakti tumhala sampark karel. Dhanyavaad.';
    case 'hindi_deva':
      return 'मैं समझ गई। इसके लिए हमारी टीम के एक सदस्य आपसे संपर्क करेंगे। धन्यवाद।';
    default:
      return 'Main samajh gayi. Iske liye hamari team ke ek vyakti aapse sampark karenge. Dhanyavaad.';
  }
}

/** Shown when the call is attempted outside the card's calling hours. */
export function outsideHoursNotice(card: PolicyCard): string {
  return `Calls are only placed between ${card.callingHours.start} and ${card.callingHours.end} (see docs/POLICY_CARD.md, RBI conduct rules).`;
}
