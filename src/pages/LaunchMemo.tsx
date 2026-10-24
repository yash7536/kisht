import { useMemo } from 'react';
import { NotRun, Panel, downloadText, inr, ms, pct } from '../components/ui';
import { useDecision } from '../hooks';
import { judgeTarget, TARGETS, type Target } from '../lib/decision';
import { LANG_LABELS } from '../lib/language';
import { failureCounts } from '../lib/metrics';
import { POLICY_CARD } from '../lib/policyCard';
import { TAXONOMY_BY_ID } from '../lib/taxonomy';
import { useStore } from '../store';
import { DecisionBox } from './Overview';

const fmt = (t: Target, v: number | null) => (v === null ? 'not run yet' : t.unit === '%' ? pct(v) : t.unit === 'ms' ? ms(v) : String(v));
const fmtTarget = (t: Target, lt: number) => `${t.op === '==' ? '=' : t.op === '>=' ? '≥' : '≤'} ${t.unit === '%' ? `${t.value * 100}%` : t.unit === 'ms' ? `${lt} ms` : t.value}`;

const RISKS = [
  { risk: 'Scripted borrowers are not real borrowers', why: 'Scenarios were AI-drafted and the handoff detector was written alongside them, so scripted recall is optimistic.', mitigation: 'Real-user test (~60 calls) and compare scripted vs real metrics.' },
  { risk: 'Text pipeline hides speech errors', why: 'Eval feeds text, not audio. Browser STT on code-mixed, noisy, 8 kHz phone audio will add errors not measured here.', mitigation: 'Record real callers with consent; score STT separately.' },
  { risk: 'Guard false negatives', why: 'The number guard is value-based. A card number used in the wrong sense (e.g. "5 minutes") passes; numbers spelled unusually may be missed.', mitigation: 'Human labelling of 25% of calls catches what the guard misses.' },
  { risk: 'Conduct rules are interpreted, not certified', why: 'Policy is drawn from public RBI circulars; a lender\'s compliance team must sign off on the script.', mitigation: 'Practitioner review of rubric and policy card.' },
  { risk: 'Model and price drift', why: 'Model behaviour and per-token prices change; ₹ figures are estimates from configured prices.', mitigation: 'Pin model version; re-run evals on each change.' },
];

export default function LaunchMemo() {
  const { settings, activeRun, grades } = useStore();
  const { summary, byLang, decision, evidence } = useDecision();
  const counts = useMemo(() => failureCounts(grades), [grades]);
  const topFailures = Object.entries(counts).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  const lt = settings.latencyThresholdMs;

  const mustBeTrue = [
    { item: 'Zero invented numbers reach the borrower across all runs', ok: summary ? summary.inventedNumberHeard === 0 : null },
    { item: 'No missed handoffs in any language (system level)', ok: byLang.length ? byLang.every((r) => r.missedHandoffs === 0) : null },
    { item: 'Every scenario reviewed by Vishnu', ok: evidence.scenariosReviewed === evidence.scenariosTotal },
    { item: 'Two human labellers on 25% of calls, kappa ≥ 0.6', ok: evidence.labelledCalls ? (evidence.kappaOutcome ?? 0) >= 0.6 : null },
    { item: 'Real-user test run; real vs scripted gap understood', ok: null },
    { item: '₹ per resolved call below the human-caller cost (baseline from a practitioner)', ok: null },
    { item: 'Lender compliance sign-off on script and policy card', ok: null },
  ];

  const markdown = () => {
    const L: string[] = [];
    L.push(`# Kisht launch memo (generated ${new Date().toISOString().slice(0, 10)})`, '', `> ${POLICY_CARD.fictionalNotice} Scenarios drafted with AI assistance; ${evidence.scenariosReviewed}/${evidence.scenariosTotal} reviewed.`, '');
    L.push('## Decision', '', `**${decision.headline}**`, '', ...decision.reasons.map((r) => `- ${r}`), '');
    L.push('## Evidence', '', activeRun ? `Run \`${activeRun.id}\`, model \`${activeRun.model}\`, k=${activeRun.k}, ${activeRun.calls.length} calls.` : 'Not run yet.', '', '| Gate | Target | Actual | Result |', '|---|---|---|---|');
    for (const t of TARGETS) { const r = judgeTarget(t, summary, lt); L.push(`| ${t.label} | ${fmtTarget(t, lt)} | ${fmt(t, r.value)} | ${r.verdict.replace('_', ' ')} |`); }
    L.push('', `Cost per resolved call (estimate): ${inr(summary?.costPerResolvedCallInr ?? null)}. Human baseline: not collected.`, '');
    L.push('### By language', '', ...(byLang.length ? byLang.map((r) => `- ${r.key}: task completion ${pct(r.taskCompletion)}, pass ${pct(r.passRate)}, missed handoffs ${r.missedHandoffs} (${r.runs} runs)`) : ['Not run yet.']), '');
    L.push('### Top failure categories', '', ...(topFailures.length ? topFailures.map(([c, v]) => `- ${TAXONOMY_BY_ID[c as keyof typeof TAXONOMY_BY_ID]?.label ?? c}: ${v.total} events in ${v.calls.size} calls (${v.caught} caught by guards)`) : ['Not run yet.']), '');
    L.push('### Real-user test', '', 'Not run yet.', '');
    L.push('## Risks', '', ...RISKS.map((r) => `- **${r.risk}.** ${r.why} Mitigation: ${r.mitigation}`), '');
    L.push('## What must be true to launch', '', ...mustBeTrue.map((m) => `- [${m.ok ? 'x' : ' '}] ${m.item}${m.ok === null ? ' (not run yet)' : ''}`), '');
    return L.join('\n');
  };

  return (
    <div className="stack memo-page">
      <div className="spread">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <span className="label">Launch memo · fills from results</span>
          <h2>Should Kisht make real reminder calls?</h2>
        </div>
        <button className="btn primary" onClick={() => downloadText('kisht-launch-memo.md', markdown())}>Export memo (.md)</button>
      </div>
      <div className="notice honest small">Template: Decision · Evidence · Risks · What must be true. Sections without data say “not run yet”. The decision rule is in src/lib/decision.ts; Vishnu makes the final call.</div>

      <div className="panel panel-pad memo">
        <section style={{ borderTop: 0, paddingTop: 0 }}>
          <span className="label">01 · Decision</span>
          <div style={{ marginTop: 10 }}><DecisionBox /></div>
        </section>

        <section>
          <span className="label">02 · Evidence</span>
          <h3>{activeRun ? `Scripted eval · ${activeRun.calls.length} calls · ${activeRun.model} · k=${activeRun.k}` : 'Scripted eval'}</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Gate</th><th>Target</th><th className="num">Actual</th><th>Result</th></tr></thead>
              <tbody>
                {TARGETS.map((t) => {
                  const r = judgeTarget(t, summary, lt);
                  return (
                    <tr key={t.id} className={r.verdict === 'fail' ? 'fail-row' : ''}>
                      <td>{t.label}<div className="small muted">{t.why}</div></td>
                      <td className="num small">{fmtTarget(t, lt)}</td>
                      <td className={`num ${r.verdict === 'fail' ? 'fail-text' : ''}`}>{fmt(t, r.value)}</td>
                      <td>{r.verdict === 'not_run' ? <NotRun /> : <span className={`chip ${r.verdict === 'pass' ? 'pass' : 'fail'}`}>{r.verdict}</span>}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td>₹ per resolved call (estimate)<div className="small muted">Needs a human-caller cost baseline from a practitioner before it means anything.</div></td>
                  <td className="small">vs human baseline</td>
                  <td className="num">{inr(summary?.costPerResolvedCallInr ?? null)}</td>
                  <td><NotRun what="Baseline missing" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid-halves" style={{ marginTop: 16 }}>
            <Panel title="By language">
              {byLang.length === 0 ? <NotRun /> : (
                <dl className="kv">{byLang.flatMap((r) => [<dt key={r.key}>{LANG_LABELS[r.key as keyof typeof LANG_LABELS] ?? r.key}</dt>, <dd key={r.key + 'v'} className={`num ${r.taskCompletion !== null && r.taskCompletion < 0.85 ? 'fail-text' : ''}`}>{pct(r.taskCompletion)} complete · {r.missedHandoffs} missed HO · {r.runs} runs</dd>])}</dl>
              )}
            </Panel>
            <Panel title="Top failure categories">
              {topFailures.length === 0 ? <NotRun /> : (
                <dl className="kv">{topFailures.flatMap(([c, v]) => [<dt key={c}>{TAXONOMY_BY_ID[c as keyof typeof TAXONOMY_BY_ID]?.label ?? c}</dt>, <dd key={c + 'v'} className="num">{v.total} events · {v.calls.size} calls · {v.caught} caught</dd>])}</dl>
              )}
            </Panel>
          </div>
          <div style={{ marginTop: 16 }}>
            <Panel title="Real-user test vs scripted">
              <p><NotRun /> The key result: the gap between scripted-set and real-caller performance. Protocol: 15–20 people, ~60 calls, consent script, same rubric. See docs/REAL_USER_TEST.md.</p>
            </Panel>
          </div>
        </section>

        <section>
          <span className="label">03 · Risks</span>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Risk</th><th>Why it matters</th><th>Mitigation</th></tr></thead>
              <tbody>{RISKS.map((r) => <tr key={r.risk}><td><b>{r.risk}</b></td><td className="small">{r.why}</td><td className="small">{r.mitigation}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section>
          <span className="label">04 · What must be true</span>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {mustBeTrue.map((m) => (
              <div key={m.item} className={`panel panel-pad spread ${m.ok === false ? 'critical' : ''}`}>
                <span>{m.ok === true ? '✓' : m.ok === false ? '✕' : '○'} {m.item}</span>
                {m.ok === null ? <NotRun /> : <span className={`chip ${m.ok ? 'pass' : 'fail'}`}>{m.ok ? 'Met' : 'Unmet'}</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
