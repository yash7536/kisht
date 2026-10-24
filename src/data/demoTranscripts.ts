/**
 * HAND-WRITTEN EXAMPLES — NOT MODEL OUTPUT.
 * Written by hand to show how the guards behave without an API key. The guards, parsers and
 * state machine run for real on these drafts; the agent text itself is invented for the demo.
 * Some drafts are deliberately bad so the guards have something to catch.
 */

import type { Proposal } from '../lib/agent';
import type { Lang } from '../lib/language';

export interface DemoTurn {
  borrower: string;
  interrupt?: boolean;
  /** One or two drafts; the second is used only if the guard blocks the first. */
  drafts: Proposal[];
}

export interface DemoTranscript {
  id: string;
  title: string;
  lang: Lang;
  shows: string;
  turns: DemoTurn[];
}

export const DEMO_TRANSCRIPTS: DemoTranscript[] = [
  {
    id: 'demo-1',
    title: 'Hinglish, self-correction (8 → 10)',
    lang: 'hinglish',
    shows: 'Identity check, amount from card, promise parsed by code after the borrower corrects themselves.',
    turns: [
      {
        borrower: 'Haan ji, Ramesh bol raha hoon.',
        drafts: [{ reply: 'Dhanyavaad Ramesh ji. Aapki EMI ₹4,250 hai jo 5 November ko due hai. Aap kab tak payment kar payenge?', intent: 'identity_confirmed', next_state: 'PROMISE', language: 'hinglish' }],
      },
      {
        borrower: '8 ko... nahi nahi 10 ko de dunga.',
        drafts: [{ reply: 'Theek hai Ramesh ji, maine 10 November note kar liya hai. Dhanyavaad, aapka din shubh ho.', intent: 'promise_given', next_state: 'CLOSE', promise_date: '2026-11-10', language: 'hinglish' }],
      },
    ],
  },
  {
    id: 'demo-2',
    title: 'Marathi-English, invented grace period blocked',
    lang: 'marathi_english',
    shows: 'First draft invents "3 divas grace period" (not on the card); the number guard blocks it and the retry is used.',
    turns: [
      {
        borrower: 'Ho, mi Ramesh bolto aahe.',
        drafts: [{ reply: 'Dhanyavaad Ramesh ji. Tumcha EMI ₹4,250 aahe, 5 November la due aahe. Tumhi kadhi bharu shakal?', intent: 'identity_confirmed', next_state: 'PROMISE', language: 'marathi_english' }],
      },
      {
        borrower: 'Ushir zala tar kay hota?',
        drafts: [
          { reply: 'Kahi kalji karu naka, 3 divas grace period aahe, tyanantar ₹350 charge lagto.', intent: 'faq_late_payment', next_state: 'FAQ', language: 'marathi_english' },
          { reply: 'Due date nantar bharla tar ₹350 late payment charge lagto. Tumhi kadhi bharu shakal?', intent: 'faq_late_payment', next_state: 'FAQ', language: 'marathi_english' },
        ],
      },
      {
        borrower: 'Bara, 8 tarkhela bharto.',
        drafts: [{ reply: 'Dhanyavaad, 8 November note kela aahe. Shubh divas.', intent: 'promise_given', next_state: 'CLOSE', promise_date: '2026-11-08', language: 'marathi_english' }],
      },
    ],
  },
  {
    id: 'demo-3',
    title: 'Hinglish, dispute missed by draft → backstop handoff',
    lang: 'hinglish',
    shows: 'Borrower disputes the amount; the hand-written draft ignores it and pushes for a date. The code backstop forces a handoff.',
    turns: [
      {
        borrower: 'Haan main hoon.',
        drafts: [{ reply: 'Dhanyavaad Ramesh ji. Aapki EMI ₹4,250 hai, 5 November tak due hai. Kab tak payment karenge?', intent: 'identity_confirmed', next_state: 'PROMISE', language: 'hinglish' }],
      },
      {
        borrower: 'Ruko, yeh amount galat hai, meri EMI itni nahi hai.',
        interrupt: true,
        drafts: [{ reply: 'Ramesh ji, amount sahi hai. Kripya bataiye aap kab payment karenge?', intent: 'other', next_state: 'PROMISE', language: 'hinglish' }],
      },
    ],
  },
];
