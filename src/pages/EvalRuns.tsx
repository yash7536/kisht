import { Fragment, useMemo, useRef, useState } from 'react';
import { CallTranscript, NotRun, Panel, TargetTiles, downloadJson, inr, ms, pct } from '../components/ui';
import { TARGETS } from '../lib/decision';
import { LANG_LABELS } from '../lib/language';
import type { BreakdownRow, Grade } from '../lib/metrics';
import { POLICY_CARD } from '../lib/policyCard';
import { geminiProposer } from '../lib/proposers';
import { estimateRunCostInr, runSuite, type RunProgress, type SuiteRun } from '../lib/runner';
import { PERSONAS, type Scenario } from '../lib/scenarios';
import { getApiKey } from '../lib/settings';
import { TAXONOMY_BY_ID } from '../lib/taxonomy';
import { useResults, useStore } from '../store';

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <Panel title={title} pad={false}>
      {rows.length === 0 ? <div className="panel-body"><NotRun /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Group</th><th className="num">Runs</th><th className="num">Task completion</th><th className="num">Pass</th><th className="num">Invented #</th><th className="num">Missed HO</th><th className="num">Unneeded HO</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.taskCompletion !== null && r.taskCompletion < 0.85 ? 'fail-row' : ''}>
                  <td>{LANG_LABELS[r.key as keyof typeof LANG_LABELS] ?? r.key}</td>
                  <td className="num">{r.runs}</td>
                  <td className="num">{pct(r.taskCompletion)}</td>
                  <td className="num">{pct(r.passRate)}</td>
                  <td className={`num ${r.inventedNumberCallRate ? 'fail-text' : ''}`}>{pct(r.inventedNumberCallRate)}</td>
                  <td className={`num ${r.missedHandoffs ? 'fail-text' : ''}`}>{r.missedHandoffs}</td>
                  <td className="num">{r.unnecessaryHandoffs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function expectedText(s: Scenario) {
  const e = s.expected;
  return e.outcome === 'promise' ? `promise ${e.promiseDate}` : e.outcome === 'handoff' ? `handoff · ${e.handoffReason}` : `closed · ${e.closeReason}`;
}

export default function EvalRuns() {
  const store = useStore();
  const { scenarios, settings, runs, activeRun, setActiveRunId, addRun, deleteRun, grades, storageWarning, scenarioErrors } = store;
  const { summary, byLang, byPersona, byDisruption } = useResults();
  const [langF, setLangF] = useState('all');
  const [personaF, setPersonaF] = useState('all');
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [k, setK] = useState(settings.runsPerScenario);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const live = useRef<SuiteRun | null>(null);

  const selected = useMemo(() => scenarios.filter((s) => (langF === 'all' || s.language === langF) && (personaF === 'all' || s.persona === personaF) && (!reviewedOnly || s.reviewed)), [scenarios, langF, personaF, reviewedOnly]);
  const est = estimateRunCostInr(selected, k, settings);

  const start = async () => {
    const key = getApiKey();
    if (!key) { setErr('Add your own Gemini API key in Settings first.'); return; }
    setErr(null);
    setRunning(true);
    abort.current = new AbortController();
    try {
      const run = await runSuite(selected, k, () => geminiProposer(settings, key, abort.current!.signal), POLICY_CARD, settings, (p) => setProgress(p), abort.current.signal);
      live.current = run;
      addRun(run);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const importRun = (file: File) => {
    file.text().then((t) => {
      try {
        const r = JSON.parse(t) as SuiteRun;
        if (!r.id || !Array.isArray(r.calls)) throw new Error('not a Kisht run file');
        addRun(r);
      } catch (e) { setErr(`Import failed: ${(e as Error).message}`); }
    });
  };

  const byScenario = useMemo(() => {
    const m = new Map<string, Grade[]>();
    for (const g of grades) m.set(g.scenarioId, [...(m.get(g.scenarioId) ?? []), g].sort((a, b) => a.runIndex - b.runIndex));
    return m;
  }, [grades]);
  const callById = useMemo(() => new Map((activeRun?.calls ?? []).map((c) => [c.id, c])), [activeRun]);

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">Scripted borrower turns × live model × k runs</span>
        <h2>Evaluation runs</h2>
        <p className="lede">Borrower lines are scripted and identical every run; only the agent is live. Each scenario runs k times so we can see consistency (pass^k), not just one lucky pass. Results exist only after you run them.</p>
      </div>
      {scenarioErrors.length > 0 && <div className="notice warn">Scenario file errors: {scenarioErrors.join(' · ')}</div>}
      <div className="notice honest small">Scenarios: drafted with AI assistance; reviewed by Vishnu before results are published. {scenarios.filter((s) => s.reviewed).length}/{scenarios.length} reviewed. See REVIEW.md.</div>

      <Panel title="New run">
        <div className="stack-sm">
          <div className="field-row">
            <label className="field"><span className="label">Language</span>
              <select className="input" value={langF} onChange={(e) => setLangF(e.target.value)}>
                <option value="all">All</option>{Object.entries(LANG_LABELS).map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}
              </select></label>
            <label className="field"><span className="label">Persona</span>
              <select className="input" value={personaF} onChange={(e) => setPersonaF(e.target.value)}>
                <option value="all">All</option>{PERSONAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></label>
            <label className="field"><span className="label">Runs per scenario (k)</span>
              <input className="input num" type="number" min={1} max={10} value={k} onChange={(e) => setK(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></label>
          </div>
          <label className="check small"><input type="checkbox" checked={reviewedOnly} onChange={(e) => setReviewedOnly(e.target.checked)} /> Only scenarios marked reviewed</label>
          <div className="spread">
            <span className="small num">{selected.length} scenarios × {k} = {est.calls} calls · up to {est.turns} model turns · rough cost ≈ {inr(est.inr, 2)} (assumes ~1,800 input / 120 output tokens per turn; estimate)</span>
            <div className="row">
              {running ? <button className="btn danger" onClick={() => abort.current?.abort()}>Stop</button> : <button className="btn primary" onClick={start} disabled={!selected.length}>Run {est.calls} calls</button>}
            </div>
          </div>
          {progress && (running || progress.done < progress.total) && (
            <div className="stack-sm">
              <div className="progress"><div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>
              <span className="small num">{progress.done}/{progress.total} {progress.current ? `· last ${progress.current}` : ''}</span>
            </div>
          )}
          {err && <div className="notice warn">{err}</div>}
          {storageWarning && <div className="notice warn">{storageWarning}</div>}
        </div>
      </Panel>

      <Panel title="Recorded runs" right={
        <div className="row">
          <label className="btn small">Import JSON<input className="sr-only" type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importRun(e.target.files[0])} /></label>
          {activeRun && <button className="btn small" onClick={() => downloadJson(`${activeRun.id}.json`, { ...activeRun, note: 'Kisht eval run. API key is never included.' })}>Download active run JSON</button>}
        </div>
      }>
        {runs.length === 0 ? <NotRun what="No runs yet" /> : (
          <div className="row">
            {runs.map((r) => (
              <span key={r.id} className="row" style={{ gap: 4 }}>
                <button className={`btn small ${r.id === activeRun?.id ? 'on' : ''}`} onClick={() => setActiveRunId(r.id)}>{r.id.replace('run-', '')} · {r.model} · {r.calls.length} calls{r.aborted ? ' (stopped)' : ''}</button>
                <button className="btn small" onClick={() => { if (confirm('Delete this run from this browser?')) deleteRun(r.id); }} aria-label="Delete run">✕</button>
              </span>
            ))}
          </div>
        )}
      </Panel>

      <section className="stack-sm">
        <span className="label">Gates vs target · active run</span>
        <TargetTiles targets={TARGETS} summary={summary} latencyThresholdMs={settings.latencyThresholdMs} />
      </section>

      <Panel title="All metrics · active run">
        {!summary ? <NotRun /> : (
          <dl className="kv">
            <dt>Calls</dt><dd className="num">{summary.runs} ({summary.apiErrors} API errors excluded)</dd>
            <dt>Task completion</dt><dd className="num">{pct(summary.taskCompletion)}</dd>
            <dt>Script compliance</dt><dd className="num">{pct(summary.scriptCompliance)} (model drafts, incl. ones the guard blocked)</dd>
            <dt>Invented number</dt><dd className="num">{pct(summary.inventedNumberCallRate)} of calls · {pct(summary.inventedNumberDraftRate)} of drafts · {summary.inventedNumberHeard} heard by borrower</dd>
            <dt>Correct handoff</dt><dd className="num">{pct(summary.correctHandoffRate)} system · {pct(summary.correctHandoffByModelRate)} model alone · reason match {pct(summary.handoffReasonAccuracy)}</dd>
            <dt>Unnecessary handoff</dt><dd className="num">{pct(summary.unnecessaryHandoffRate)}</dd>
            <dt>Pass rate / pass^{summary.k}</dt><dd className="num">{pct(summary.passRate)} / {pct(summary.passHatK)}</dd>
            <dt>Latency p50 / p95</dt><dd className="num">{ms(summary.p50LatencyMs)} / {ms(summary.p95LatencyMs)} (model time per turn, incl. retries)</dd>
            <dt>Cost (est.)</dt><dd className="num">{inr(summary.totalCostInr, 2)} total · {inr(summary.costPerCallInr)} per call · {inr(summary.costPerResolvedCallInr)} per resolved call ({summary.resolvedCalls} resolved)</dd>
          </dl>
        )}
      </Panel>

      <div className="grid-halves">
        <Breakdown title="By language" rows={byLang} />
        <Breakdown title="By interruption / disruption" rows={byDisruption} />
      </div>
      <Breakdown title="By persona" rows={byPersona} />

      <Panel title="Scenarios" pad={false} right={<span className="small muted">{activeRun ? 'R1…Rk = run results' : 'No results yet; showing the scenario library'}</span>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID · title</th><th>Language</th><th>Persona</th><th>Disruption</th><th>Expected</th><th>Runs</th><th>Failures</th><th>Reviewed</th></tr></thead>
            <tbody>
              {scenarios.map((s) => {
                const gs = byScenario.get(s.id) ?? [];
                const anyFail = gs.some((g) => !g.pass);
                const cats = [...new Set(gs.flatMap((g) => g.failures.map((f) => f.category)))];
                return (
                  <Fragment key={s.id}>
                    <tr className={anyFail ? 'fail-row' : ''}>
                      <td><span className="num">{s.id}</span> {s.title}
                        <div className="small muted">{s.turns.map((t) => (t.interrupt ? '» ' : '') + t.text).join(' / ')}</div></td>
                      <td>{LANG_LABELS[s.language]}</td>
                      <td>{s.persona}</td>
                      <td className="small">{s.disruptions.join(', ')}</td>
                      <td className="small num">{expectedText(s)}</td>
                      <td>
                        {gs.length === 0 ? <span className="small muted">—</span> : (
                          <span className="dots">{gs.map((g) => <button key={g.callId} className={`dot ${g.apiError ? 'n' : g.pass ? 'p' : 'f'}`} title={`run ${g.runIndex + 1}: ${g.pass ? 'pass' : 'fail'}`} onClick={() => setOpen(open === g.callId ? null : g.callId)} style={{ border: 0, cursor: 'pointer' }}>{g.apiError ? '?' : g.pass ? '✓' : '✕'}</button>)}</span>
                        )}
                      </td>
                      <td>{cats.map((c) => <span key={c} className="chip fail" style={{ margin: 2 }}>{TAXONOMY_BY_ID[c]?.label ?? c}</span>)}</td>
                      <td>{s.reviewed ? <span className="chip ok">Yes</span> : <span className="chip notrun">No</span>}</td>
                    </tr>
                    {gs.some((g) => g.callId === open) && callById.get(open!) && (
                      <tr><td colSpan={8} style={{ background: 'var(--surface)' }}><CallTranscript call={callById.get(open!)!} /></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
