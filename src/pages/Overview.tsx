import { NotRun, Panel, TargetTiles, inr } from '../components/ui';
import { useDecision } from '../hooks';
import { TARGETS } from '../lib/decision';
import { LANG_LABELS } from '../lib/language';
import { formatCardDate, formatInr, POLICY_CARD } from '../lib/policyCard';
import { countBy } from '../lib/scenarios';
import { useStore } from '../store';

export function DecisionBox() {
  const { decision } = useDecision();
  return (
    <div className={`decision ${decision.tone === 'block' ? '' : 'neutral'}`}>
      <div className="spread">
        <span className="label">Launch decision</span>
        <span className={`chip ${decision.tone === 'block' ? 'fail' : 'notrun'}`}>{decision.tone === 'block' ? 'Blocked' : 'Pending'}</span>
      </div>
      <div className="decision-head">{decision.headline}</div>
      <ul>{decision.reasons.slice(0, 6).map((r) => <li key={r}>{r}</li>)}</ul>
      {decision.languageNotes.length > 0 && <div className="small fail-text">{decision.languageNotes.join(' · ')}</div>}
      <div className="small muted">Computed from this browser's eval results. The app never declares "Go" by itself: that needs human review and the real-user test.</div>
    </div>
  );
}

export default function Overview() {
  const { scenarios, settings, activeRun } = useStore();
  const { summary, evidence } = useDecision();
  const byLang = countBy(scenarios, (s) => s.language);
  const byOutcome = countBy(scenarios, (s) => s.expected.outcome);

  return (
    <div className="stack">
      <div className="grid-2">
        <div className="page-head">
          <span className="label">AI PM project · evaluation and launch decision</span>
          <h1>Should a Hinglish / Marathi-English voice agent make pre-due EMI reminder calls for a lender?</h1>
          <p className="lede">
            Kisht is a voice agent for one narrow job: a polite reminder call before an EMI is due. The interesting work is not the agent but the evidence:
            {' '}{scenarios.length} scripted borrower scenarios run against the live model, human labelling, a failure taxonomy, and a launch memo that can say no.
          </p>
          <div className="notice honest small">
            {POLICY_CARD.fictionalNotice} Scenarios were drafted with AI assistance and must be reviewed by Vishnu Yash Pandey before any result is published ({evidence.scenariosReviewed}/{evidence.scenariosTotal} reviewed). Every number on this site comes from a run in your browser, or says “not run yet”.
          </div>
        </div>
        <DecisionBox />
      </div>

      <section className="stack-sm">
        <div className="spread">
          <span className="label">Launch gates vs target {activeRun ? `· active run ${activeRun.id}` : ''}</span>
          {summary ? <span className="small muted num">{summary.runs} calls · k={summary.k} · {inr(summary.costPerResolvedCallInr)} per resolved call (est.)</span> : <NotRun />}
        </div>
        <TargetTiles targets={TARGETS} summary={summary} latencyThresholdMs={settings.latencyThresholdMs} />
      </section>

      <div className="grid-2">
        <Panel title="Boundary policy · what the agent may and may not do" right={<span className="small muted">Sources: docs/POLICY_CARD.md</span>}>
          <div className="policy-cols">
            <div className="panel panel-pad policy-col permit">
              <div className="spread" style={{ marginBottom: 10 }}><span className="label">Permitted</span><span className="chip ok">Card only</span></div>
              <ul>
                <li><span className="mark">✓</span><span><b>Say it is automated</b> and from {POLICY_CARD.lender}, in a fixed greeting.</span></li>
                <li><span className="mark">✓</span><span><b>Verify by name only</b> before any loan detail.</span></li>
                <li><span className="mark">✓</span><span><b>State {formatInr(POLICY_CARD.emiAmountInr)} due {formatCardDate(POLICY_CARD.dueDate)}</b>, exactly as on the card.</span></li>
                <li><span className="mark">✓</span><span><b>Answer 3 FAQs</b>: how to pay, late charge ({formatInr(POLICY_CARD.lateChargeInr)}), date change → human.</span></li>
                <li><span className="mark">✓</span><span><b>Capture a promise</b> up to {formatCardDate(POLICY_CARD.promiseWindowEnd)}, parsed and validated in code.</span></li>
                <li><span className="mark">✓</span><span><b>Hand off</b> anything else to a human.</span></li>
              </ul>
            </div>
            <div className="panel panel-pad policy-col prohibit">
              <div className="spread" style={{ marginBottom: 10 }}><span className="label fail-text">Prohibited</span><span className="chip fail">Blocked in code</span></div>
              <ul>
                <li><span className="mark">✕</span><span><b>Any number not on the card</b>: rates, waivers, grace days, other dates.</span></li>
                <li><span className="mark">✕</span><span><b>Threats or pressure</b>: police, legal action, visits, telling family, credit-score scares.</span></li>
                <li><span className="mark">✕</span><span><b>Disclosure to anyone else</b>: wrong number, spouse, child.</span></li>
                <li><span className="mark">✕</span><span><b>Asking for OTP, PIN, Aadhaar, PAN</b>, account numbers.</span></li>
                <li><span className="mark">✕</span><span><b>Other people's loans.</b></span></li>
                <li><span className="mark">✕</span><span><b>Calling outside {POLICY_CARD.callingHours.start}–{POLICY_CARD.callingHours.end}</b> (RBI recovery-agent conduct, 2022).</span></li>
              </ul>
            </div>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Evidence status">
            <dl className="kv">
              <dt>Scripted eval</dt><dd>{summary ? `${summary.runs} calls run (${summary.scenarios} scenarios × k=${summary.k})` : <NotRun />}</dd>
              <dt>Scenario review</dt><dd>{evidence.scenariosReviewed}/{evidence.scenariosTotal} reviewed by Vishnu</dd>
              <dt>Human labels</dt><dd>{evidence.labelledCalls ? `${evidence.labelledCalls} calls double-labelled` : <NotRun />}</dd>
              <dt>LLM judge</dt><dd>{evidence.judgeCalibrated ? 'Calibrated' : <NotRun what="Not calibrated" />}</dd>
              <dt>Real-user test</dt><dd><NotRun /> <span className="small muted">15–20 people, ~60 calls. Protocol in docs/REAL_USER_TEST.md</span></dd>
              <dt>Human-cost baseline</dt><dd><NotRun what="Not collected" /> <span className="small muted">from a practitioner interview</span></dd>
            </dl>
          </Panel>
          <Panel title="Scenario coverage (data, not results)">
            <dl className="kv">
              {Object.entries(byLang).flatMap(([k, v]) => [<dt key={k}>{LANG_LABELS[k as keyof typeof LANG_LABELS]}</dt>, <dd key={k + 'v'} className="num">{v}</dd>])}
              <dt>Expected</dt><dd className="num">promise {byOutcome.promise ?? 0} · handoff {byOutcome.handoff ?? 0} · closed {byOutcome.closed ?? 0}</dd>
            </dl>
          </Panel>
        </div>
      </div>

      <Panel title="Why AI here, and where AI is the risk">
        <div className="grid-halves">
          <div>
            <h3>Why not an IVR tree</h3>
            <p>Borrowers answer in free-form, code-mixed speech (“8 ko… nahi nahi 10 ko de dunga”), interrupt, and ask off-script questions mid-sentence. A keypad tree cannot hold that; a scripted IVR either loses the caller or forces them to repeat.</p>
          </div>
          <div>
            <h3>Where the model is the risk</h3>
            <p>It may invent a figure, skip a handoff, misread a corrected date, or answer a rate question. So the model only proposes; code decides: number guard, handoff backstop, promise parser and a state machine. See docs/DECISIONS.md.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
