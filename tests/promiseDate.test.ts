import { describe, expect, it } from 'vitest';
import { parsePromiseDate, validatePromise } from '../src/lib/promiseDate';
import { POLICY_CARD } from '../src/lib/policyCard';

const d = (t: string) => parsePromiseDate(t, POLICY_CARD).date;

describe('promise-date parser', () => {
  it('reads plain dates in all four languages', () => {
    expect(d('Main 8 tareekh ko kar dunga')).toBe('2026-11-08');
    expect(d("I'll pay on 5 November")).toBe('2026-11-05');
    expect(d('Mi 8 tarkhela bharto')).toBe('2026-11-08');
    expect(d('आठ तारीख को भर दूँगा')).toBe('2026-11-08');
    expect(d('6 नवंबर को कर दूँगा')).toBe('2026-11-06');
  });

  it('handles self-corrections: last un-retracted date wins', () => {
    const r = parsePromiseDate('8 ko... nahi nahi 10 ko de dunga', POLICY_CARD);
    expect(r.date).toBe('2026-11-10');
    expect(r.corrected).toBe(true);
    expect(r.candidates.map((c) => c.retracted)).toEqual([true, false]);
    expect(d('5 tareekh tak nahi ho payega, 7 ko kar dunga')).toBe('2026-11-07');
    expect(d("I'll do it on the 6th — no wait, the 9th")).toBe('2026-11-09');
    expect(d('6 tarkhela... nahi nahi, 9 tarkhela bharin')).toBe('2026-11-09');
    expect(d('आठ को... नहीं नहीं, दस को दूँगा')).toBe('2026-11-10');
    expect(d('Main 6 ko, matlab 9 ko kar dunga')).toBe('2026-11-09');
  });

  it('treats a refused date as no promise', () => {
    expect(d('9 ko nahi ho payega')).toBeNull();
  });

  it('does not treat "koi problem nahi" as a retraction', () => {
    expect(d('8 ko de dunga, koi problem nahi')).toBe('2026-11-08');
    expect(d('Udya bharto mi, kahi tension nako')).toBe('2026-11-03');
  });

  it('resolves relative days and weekdays from the call date (Mon 2 Nov 2026)', () => {
    expect(d('kal kar dunga')).toBe('2026-11-03');
    expect(d('parson tak')).toBe('2026-11-04');
    expect(d('I will pay tomorrow')).toBe('2026-11-03');
    expect(d('shukravar ko')).toBe('2026-11-06');
    expect(d('on Monday')).toBe('2026-11-09');
  });

  it('does not read "kal ... kar diya" (yesterday, already paid) as a promise', () => {
    expect(d('Maine kal hi app se pay kar diya hai')).toBeNull();
    expect(d('मैंने कल ही जमा कर दिया है')).toBeNull();
  });

  it('flags vague answers', () => {
    const r = parsePromiseDate('Salary aane pe kar dunga', POLICY_CARD);
    expect(r.date).toBeNull();
    expect(r.vague).toBe(true);
  });

  it('validates against the window', () => {
    expect(validatePromise('2026-11-10', POLICY_CARD)).toBe('ok');
    expect(validatePromise('2026-11-02', POLICY_CARD)).toBe('ok');
    expect(validatePromise('2026-11-15', POLICY_CARD)).toBe('outside_window');
    expect(validatePromise('2026-11-01', POLICY_CARD)).toBe('in_past');
    expect(validatePromise(null, POLICY_CARD)).toBe('none');
    // A bare day earlier than today rolls to next month and is therefore outside the window.
    expect(validatePromise(d('1 tareekh ko'), POLICY_CARD)).toBe('outside_window');
  });
});
