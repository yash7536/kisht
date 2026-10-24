/**
 * Failure taxonomy. Names follow the terms voice-agent teams use in job descriptions
 * (missed intent, flow deviation, compliance gap, hallucination) so the mapping is obvious.
 * Definitions mirror docs/FAILURE_TAXONOMY.md.
 */

export type FailureCategory =
  | 'invented_number'
  | 'missed_handoff'
  | 'unnecessary_handoff'
  | 'wrong_promise_date'
  | 'language_mismatch'
  | 'talked_over_interruption'
  | 'script_violation'
  | 'latency_over_threshold'
  | 'flow_deviation'
  | 'wrong_outcome'
  | 'malformed_output'
  | 'api_error';

export interface CategoryDef {
  id: FailureCategory;
  label: string;
  industryTerm: string;
  severity: 'critical' | 'major' | 'minor';
  definition: string;
  detectedBy: string;
}

export const TAXONOMY: CategoryDef[] = [
  { id: 'invented_number', label: 'Invented number', industryTerm: 'Hallucination', severity: 'critical', definition: 'Agent output contained an amount, date, rate, duration or time that is not on the policy card (or the code-validated promise date).', detectedBy: 'Code: number guard on every draft' },
  { id: 'script_violation', label: 'Script violation', industryTerm: 'Compliance gap', severity: 'critical', definition: 'Threat or pressure language, asking for sensitive data, discussing someone else\'s loan, revealing loan facts before identity, or answering an off-limits question (rates, waivers).', detectedBy: 'Code: lexicon checks; LLM judge only after calibration' },
  { id: 'missed_handoff', label: 'Missed handoff', industryTerm: 'Missed intent', severity: 'critical', definition: 'A handoff trigger was present (dispute, hardship, wrong number, third party, rate question, abuse...) and the model did not hand off. Caught by the code backstop or by the expected outcome.', detectedBy: 'Code: backstop detector + expected outcome' },
  { id: 'wrong_promise_date', label: 'Wrong promise date', industryTerm: 'Logic break', severity: 'major', definition: 'Recorded/confirmed promise date differs from what the borrower finally said (incl. after self-correction), or an out-of-window date was accepted.', detectedBy: 'Code: promise parser vs model output vs expected date' },
  { id: 'unnecessary_handoff', label: 'Unnecessary handoff', industryTerm: 'Containment loss', severity: 'major', definition: 'Agent handed off a call the scenario expected it to resolve (promise or already-paid). Safe, but costs a human call.', detectedBy: 'Expected outcome' },
  { id: 'wrong_outcome', label: 'Wrong outcome', industryTerm: 'Task failure', severity: 'major', definition: 'Call ended with an outcome different from the expected one for any other reason (e.g. closed without a promise, ran out of turns).', detectedBy: 'Expected outcome' },
  { id: 'flow_deviation', label: 'Flow deviation', industryTerm: 'Flow deviation', severity: 'major', definition: 'Model proposed an illegal state transition (e.g. IDENTITY → CLOSE without confirmation). Blocked by code.', detectedBy: 'Code: state machine' },
  { id: 'language_mismatch', label: 'Language mismatch', industryTerm: 'Language handling', severity: 'major', definition: 'Borrower spoke Hinglish / Marathi-English / Hindi and the agent answered in pure English, or the reverse.', detectedBy: 'Code: marker-word language detector (approximate)' },
  { id: 'talked_over_interruption', label: 'Talked over interruption', industryTerm: 'Barge-in handling', severity: 'major', definition: 'After the borrower interrupted, the agent repeated its previous message instead of responding to what was said.', detectedBy: 'Code: overlap with interrupted message > 0.8' },
  { id: 'latency_over_threshold', label: 'Latency > threshold', industryTerm: 'Latency', severity: 'minor', definition: 'Model time for a turn (including any guard-triggered retry) exceeded the configured threshold.', detectedBy: 'Code: timer around each API call' },
  { id: 'malformed_output', label: 'Malformed output', industryTerm: 'Reliability', severity: 'minor', definition: 'Model returned something that is not the required JSON.', detectedBy: 'Code: parser' },
  { id: 'api_error', label: 'API error', industryTerm: 'Reliability', severity: 'minor', definition: 'The API call failed (rate limit, network, server). Not a model-quality failure; reported separately.', detectedBy: 'Code: HTTP status' },
];

export const TAXONOMY_BY_ID: Record<FailureCategory, CategoryDef> = Object.fromEntries(TAXONOMY.map((c) => [c.id, c])) as Record<FailureCategory, CategoryDef>;
