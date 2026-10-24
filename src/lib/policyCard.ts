/**
 * The policy card is the ONLY source of facts the agent may state.
 * Everything here is FICTIONAL. "Sahayak Finance" is not a real lender and
 * "Ramesh Patil" is not a real borrower. See docs/POLICY_CARD.md.
 */

export interface PolicyCard {
  lender: string;
  fictionalNotice: string;
  borrowerName: string;
  /** Short form the agent may use, e.g. "Ramesh ji". */
  borrowerShortName: string;
  productLabel: string;
  emiAmountInr: number;
  /** ISO date the instalment is due. */
  dueDate: string;
  /** Simulated date on which the reminder call happens. */
  callDate: string;
  /** Latest date a promise-to-pay may be accepted without a human (inclusive). */
  promiseWindowEnd: string;
  lateChargeInr: number;
  paymentMethods: string[];
  lateFaqAnswer: string;
  changeDateFaqAnswer: string;
  /** Allowed outbound calling window, local time, 24h. */
  callingHours: { start: string; end: string };
  /** The three FAQs the agent is allowed to answer. */
  allowedFaqs: ('how_to_pay' | 'late_payment' | 'change_date')[];
}

export const POLICY_CARD: PolicyCard = {
  lender: 'Sahayak Finance',
  fictionalNotice: 'Sahayak Finance is a fictional lender created for this project. No real company, loan or person is represented.',
  borrowerName: 'Ramesh Patil',
  borrowerShortName: 'Ramesh ji',
  productLabel: 'personal loan',
  emiAmountInr: 4250,
  dueDate: '2026-11-05',
  callDate: '2026-11-02',
  promiseWindowEnd: '2026-11-10',
  lateChargeInr: 350,
  paymentMethods: [
    'Sahayak Finance app → "Pay EMI"',
    'UPI payment link sent by SMS from Sahayak Finance',
    'Any Sahayak Finance branch',
  ],
  lateFaqAnswer:
    'If the EMI is not paid by the due date, a late payment charge of ₹350 applies (as per the loan agreement). For anything else about charges, a team member will call back.',
  changeDateFaqAnswer:
    'The EMI date cannot be changed on this call. A team member will call back to discuss it.',
  callingHours: { start: '08:00', end: '19:00' },
  allowedFaqs: ['how_to_pay', 'late_payment', 'change_date'],
};

export interface CardDate {
  day: number;
  month: number; // 1-12
  year: number;
}

export function parseIso(iso: string): CardDate {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function toIso(d: CardDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** Numbers (by kind) that appear on the card and may be spoken. */
export interface AllowedFacts {
  amounts: number[];
  dates: CardDate[];
  /** Bare numbers that are fine anywhere (years, day-of-month on the card, the month). */
  bare: number[];
}

export function allowedFactsFromCard(card: PolicyCard, extraDates: string[] = []): AllowedFacts {
  const due = parseIso(card.dueDate);
  const end = parseIso(card.promiseWindowEnd);
  const extra = extraDates.map(parseIso);
  const dates = [due, end, ...extra];
  const bare = new Set<number>([card.emiAmountInr, card.lateChargeInr, due.year]);
  for (const d of dates) {
    bare.add(d.day);
    bare.add(d.month);
    bare.add(d.year);
  }
  return {
    amounts: [card.emiAmountInr, card.lateChargeInr],
    dates,
    bare: [...bare],
  };
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatCardDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.day} ${MONTHS_EN[d.month - 1]} ${d.year}`;
}

export function formatInr(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}

/** Is a time "HH:MM" inside the allowed calling window? */
export function withinCallingHours(card: PolicyCard, hhmm: string): boolean {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const t = toMin(hhmm);
  return t >= toMin(card.callingHours.start) && t <= toMin(card.callingHours.end);
}

export function cardAsPromptText(card: PolicyCard): string {
  return [
    `Lender: ${card.lender} (fictional)`,
    `Borrower name (for identity check only): ${card.borrowerName}`,
    `Product: ${card.productLabel}`,
    `EMI amount due: ${formatInr(card.emiAmountInr)} (${card.emiAmountInr} rupees)`,
    `Due date: ${formatCardDate(card.dueDate)}`,
    `Today (call date): ${formatCardDate(card.callDate)}`,
    `A promise-to-pay may be accepted only for a date from ${formatCardDate(card.callDate)} to ${formatCardDate(card.promiseWindowEnd)} inclusive.`,
    `FAQ 1, how to pay: ${card.paymentMethods.join('; ')}.`,
    `FAQ 2, what happens if paid late: ${card.lateFaqAnswer}`,
    `FAQ 3, how to change the EMI date: ${card.changeDateFaqAnswer} (this means HANDOFF)`,
  ].join('\n');
}
