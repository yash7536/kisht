import { describe, expect, it } from 'vitest';
import { checkNumbers, evalNumberWords, extractMentions, normWord } from '../src/lib/numbers';
import { allowedFactsFromCard, POLICY_CARD } from '../src/lib/policyCard';

const allowed = allowedFactsFromCard(POLICY_CARD);
const amounts = (t: string) => extractMentions(t).filter((m) => m.kind === 'amount').map((m) => m.value);
const dates = (t: string) => extractMentions(t).filter((m) => m.kind === 'date').map((m) => [m.value, m.month]);

describe('number extraction', () => {
  it('reads Hinglish word numerals as an amount', () => {
    expect(amounts('Aapki EMI chaar hazaar do sau pachaas rupaye hai')).toEqual([4250]);
    expect(amounts('chaar hazaar do sau pachaas')).toEqual([4250]);
  });
  it('evaluates fractions and multipliers', () => {
    expect(evalNumberWords(['sadhe', 'char', 'hajar'].map(normWord))?.value).toBe(4500);
    expect(evalNumberWords(['dhai', 'hajar'].map(normWord))?.value).toBe(2500);
    expect(evalNumberWords(['ek', 'lakh', 'bis', 'hajar'].map(normWord))?.value).toBe(120000);
  });
  it('reads ₹ with Indian commas, Rs., and plain digits', () => {
    expect(amounts('Amount ₹4,250 hai')).toEqual([4250]);
    expect(amounts('Rs. 4,250 due')).toEqual([4250]);
    expect(amounts('4250 rupaye')).toEqual([4250]);
    expect(extractMentions('EMI 4250 hai')[0]).toMatchObject({ kind: 'number', value: 4250 });
  });
  it('reads Devanagari numerals and words', () => {
    expect(amounts('₹४,२५०')).toEqual([4250]);
    expect(amounts('चार हज़ार दो सौ पचास रुपये')).toEqual([4250]);
  });
  it('reads dates: 5 Nov, November 5, 5th November, paanch tareekh, 8 ko', () => {
    expect(dates('due date 5 Nov hai')).toEqual([[5, 11]]);
    expect(dates('November 5 tak')).toEqual([[5, 11]]);
    expect(dates('by the 5th of November')).toEqual([[5, 11]]);
    expect(dates('paanch tareekh ko')).toEqual([[5, undefined]]);
    expect(dates('8 ko de dunga')).toEqual([[8, undefined]]);
    expect(dates('5/11/2026')).toEqual([[5, 11]]);
    expect(dates('पाँच तारीख')).toEqual([[5, undefined]]);
    expect(dates('8 tarkhela bharto')).toEqual([[8, undefined]]);
  });
  it('propagates a date marker across "ya": aath ya das tareekh', () => {
    expect(dates('aath ya das tareekh')).toEqual([[8, undefined], [10, undefined]]);
  });
  it('ignores word numerals used as ordinary words', () => {
    expect(extractMentions('de do na, ek baar aapke saath baat karni hai')).toEqual([]);
    expect(extractMentions('one second please, she will pay')).toEqual([]);
    expect(extractMentions('mai 8 ko dunga')[0]).toMatchObject({ kind: 'date', value: 8, month: undefined });
  });
});

describe('number guard against the policy card', () => {
  it('allows card facts in any surface form', () => {
    expect(checkNumbers('Ramesh ji, aapki EMI ₹4,250 hai, due date 5 November 2026.', allowed).ok).toBe(true);
    expect(checkNumbers('Aapki kisht chaar hazaar do sau pachaas rupaye ki hai, paanch tareekh tak.', allowed).ok).toBe(true);
    expect(checkNumbers('Late hone par ₹350 charge lagega.', allowed).ok).toBe(true);
    expect(checkNumbers('आपकी EMI ₹४,२५० है, ५ नवंबर तक।', allowed).ok).toBe(true);
  });
  it('blocks invented amounts, rates, durations and dates', () => {
    const r1 = checkNumbers('Aapki EMI ₹4,500 hai.', allowed);
    expect(r1.ok).toBe(false);
    expect(r1.violations[0].mention.value).toBe(4500);
    expect(checkNumbers('Interest rate 18% hai.', allowed).ok).toBe(false);
    expect(checkNumbers('Aapke paas 3 din ka grace period hai.', allowed).ok).toBe(false);
    expect(checkNumbers('Aap 12 November tak de sakte hain.', allowed).ok).toBe(false);
    expect(checkNumbers('Late fee paanch sau rupaye hai.', allowed).ok).toBe(false);
    expect(checkNumbers('Call 1800 123 4567 for help.', allowed).ok).toBe(false);
  });
  it('allows a promise date only once code has validated it', () => {
    expect(checkNumbers('Theek hai, 8 November ko note kar liya.', allowed).ok).toBe(false);
    const withPromise = allowedFactsFromCard(POLICY_CARD, ['2026-11-08']);
    expect(checkNumbers('Theek hai, 8 November ko note kar liya.', withPromise).ok).toBe(true);
    expect(checkNumbers('Theek hai, aath tareekh ko note kar liya.', withPromise).ok).toBe(true);
  });
});
