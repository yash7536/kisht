import { describe, expect, it } from 'vitest';
import { detectAlreadyPaid, primaryHandoff } from '../src/lib/handoff';

const reason = (t: string) => primaryHandoff(t)?.reason ?? null;

describe('handoff detector (backstop)', () => {
  it.each([
    ['Yahan koi Ramesh nahi rehta, wrong number hai', 'wrong_number'],
    ['Ithe koni Ramesh nahi, chukicha number aahe', 'wrong_number'],
    ['यह गलत नंबर है', 'wrong_number'],
    ['Main unki wife bol rahi hoon', 'third_party'],
    ["I'm his daughter, he is not home", 'third_party'],
    ['Mi tyanchi bayko boltey', 'third_party'],
    ['Meri naukri chali gayi hai', 'hardship'],
    ['Mazi nokri geli aahe', 'hardship'],
    ['मेरी नौकरी चली गई है', 'hardship'],
    ['Yeh amount galat hai', 'dispute'],
    ['Interest rate kitna hai?', 'interest_rate'],
    ['Vyaj kiti lagta?', 'interest_rate'],
    ['ब्याज कितना है', 'interest_rate'],
    ['Late fee maaf kar doge?', 'fee_waiver'],
    ['Can you waive the late fee?', 'fee_waiver'],
    ['Bakwas band karo [abuse]', 'abuse'],
    ['EMI date change ho sakti hai?', 'date_change'],
    ['Can I change my EMI date?', 'date_change'],
    ['Mujhe kisi insaan se baat karni hai', 'human_requested'],
    ['Baad mein call karo', 'callback_requested'],
    ['Nantar call kara', 'callback_requested'],
    ['I will file a complaint with the ombudsman', 'legal_complaint'],
    ['Mere bhai ka loan bhi hai kya?', 'other_loan'],
    ['Woh pichle hafte guzar gaye', 'bereavement'],
  ])('%s → %s', (text, expected) => {
    expect(reason(text)).toBe(expected);
  });

  it.each([
    'Haan ji, Ramesh bol raha hoon.',
    '8 ko... nahi nahi 10 ko de dunga.',
    '5 tareekh tak nahi ho payega, 7 ko kar dunga.',
    "I'll do it on the 6th — no wait, the 9th.",
    'Maaf kijiye, phir se boliye?',
    'Udya bharto mi, kahi tension nako.',
    'Kaise bharun? App nahi aata.',
  ])('does not fire on ordinary turn: %s', (text) => {
    expect(reason(text)).toBeNull();
  });

  it('detects already-paid without treating it as a handoff', () => {
    expect(detectAlreadyPaid('Maine kal hi app se pay kar diya hai')).toBe(true);
    expect(detectAlreadyPaid('Mi kal ch bharle')).toBe(true);
    expect(detectAlreadyPaid('मैंने कल ही जमा कर दिया है')).toBe(true);
    expect(detectAlreadyPaid('9 tareekh ko beta jama kar dega')).toBe(false);
    expect(reason('Maine kal hi app se pay kar diya hai')).toBeNull();
  });
});
