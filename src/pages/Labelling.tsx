import { useMemo, useState } from 'react';
import { CallTranscript, NotRun, Panel, downloadJson, pct } from '../components/ui';
import { LABEL_FRACTION, useLabelling } from '../hooks';
import { judgeCall } from '../lib/judge';
import { cohensKappa, kappaLabel } from '../lib/kappa';
import { getApiKey } from '../lib/settings';
import { TAXONOMY } from '../lib/taxonomy';
import { useStore, type CallLabel, type LabelSet } from '../store';

const empty: CallLabel = { outcomeCorrect: null, scriptCompliant: null, categories: [], note: '' };

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <span className="row" style={{ gap: 4 }}>
      <button className={`btn small ${value === true ? 'on' : ''}`} onClick={() => onChange(true)}>Yes</button>
      <button className={`btn small ${value === false ? 'on' : ''}`} onClick={() => onChange(false)}>No</button>
    </span>
  );
}

export default function Labelling() {
  const { activeRun, labels, setLabel, setLabellerName, importLabels, judge, setJudge, settings, scenarioById } = useStore();
  const lab = useLabelling();
  const [who, setWho] = useState<'A' | 'B'>('A');
  const [idx, setIdx] = useState(0);
  const [judging, setJudging] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const callById = useMemo(() => new Map((activeRun?.calls ?? []).map((c) => [c.id, c])), [activeRun]);
  const id = lab.sample[idx];
  const call = id ? callById.get(id) : undefined;
  const cur = (id && labels[who].labels[id]) || empty;
  const update = (patch: Partial<CallLabel>) => id && setLabel(who, id, { ...cur, ...patch });
  const doneBy = (w: 'A' | 'B') => lab.sample.filter((s) => labels[w].labels[s]?.outcomeCorrect !== null && labels[w].labels[s]?.outcomeCorrect !== undefined).length;

  const runCalibration = async () => {
    const key = getApiKey();
    if (!key) { setErr('Add your Gemini key in Settings to run the judge.'); return; }
    const ids = Object.keys(lab.consensusScript);
    if (ids.length < 10) { setErr('Need at least 10 calls where both labellers agree on script compliance before calibrating.'); return; }
    setErr(null);
    setJudging(true);
    const verdicts: Record<string, boolean | null> = {};
    try {
      for (const cid of ids) {
        const c = callById.get(cid);
        if (!c) continue;
        verdicts[cid] = (await judgeCall(c, settings, key)).compliant;
      }
      const usable = ids.filter((i) => verdicts[i] !== null && verdicts[i] !== undefined);
      const agr = cohensKappa(usable.map((i) => lab.consensusScript[i]), usable.map((i) => verdicts[i]!));
      setJudge({ at: new Date().toISOString(), n: usable.length, agreement: agr.agreement, kappa: agr.kappa, calibrated: agr.kappa !== null && agr.kappa >= settings.judgeKappaThreshold, verdicts });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setJudging(false);
    }
  };

  const importFile = (file: File) => file.text().then((t) => {
    try {
      const set = JSON.parse(t) as LabelSet;
      if (!set.labels) throw new Error('not a label file');
      importLabels(who, set);
    } catch (e) { setErr(`Import failed: ${(e as Error).message}`); }
  });

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">Human labels · agreement · judge calibration</span>
        <h2>Labelling</h2>
        <p className="lede">Two people independently label the same {Math.round(LABEL_FRACTION * 100)}% sample of calls (seeded, so both see the same set). We report raw agreement and Cohen's kappa. The LLM judge is only allowed to score script compliance, and only after it agrees with the human consensus (kappa ≥ {settings.judgeKappaThreshold}).</p>
      </div>
      {!activeRun ? <div className="notice">No eval run yet. Run evals first; the labelling sample is drawn from the active run.</div> : (
        <>
          <div className="tiles">
            <div className="tile"><span className="label">Sample</span><span className="tile-value">{lab.sample.length}</span><span className="tile-target">of {activeRun.calls.length} calls</span></div>
            <div className="tile"><span className="label">Labelled A / B</span><span className="tile-value">{doneBy('A')} / {doneBy('B')}</span><span className="tile-target">both: {lab.both.length}</span></div>
            <div className="tile"><span className="label">Outcome-correct agreement</span><span className={`tile-value ${lab.outcome.kappa === null ? 'notrun' : ''}`}>{lab.outcome.agreement === null ? 'not run yet' : pct(lab.outcome.agreement)}</span><span className="tile-target">κ = {lab.outcome.kappa?.toFixed(2) ?? '—'} ({kappaLabel(lab.outcome.kappa)})</span></div>
            <div className="tile"><span className="label">Script-compliance agreement</span><span className={`tile-value ${lab.script.kappa === null ? 'notrun' : ''}`}>{lab.script.agreement === null ? 'not run yet' : pct(lab.script.agreement)}</span><span className="tile-target">κ = {lab.script.kappa?.toFixed(2) ?? '—'} ({kappaLabel(lab.script.kappa)})</span></div>
            <div className={`tile ${judge && !judge.calibrated ? 'fail' : ''}`}><span className="label">LLM judge</span><span className={`tile-value ${judge ? '' : 'notrun'}`}>{judge ? (judge.calibrated ? 'calibrated' : 'not trusted') : 'not run yet'}</span><span className="tile-target">{judge ? `κ = ${judge.kappa?.toFixed(2) ?? '—'} on ${judge.n} calls` : 'needs ≥10 consensus labels'}</span></div>
          </div>

          <Panel title="Labeller" right={
            <div className="row">
              <button className={`btn small ${who === 'A' ? 'on' : ''}`} onClick={() => setWho('A')}>A</button>
              <button className={`btn small ${who === 'B' ? 'on' : ''}`} onClick={() => setWho('B')}>B</button>
              <button className="btn small" onClick={() => downloadJson(`kisht-labels-${who}.json`, labels[who])}>Export {who}</button>
              <label className="btn small">Import into {who}<input className="sr-only" type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
            </div>
          }>
            <div className="stack-sm">
              <label className="field"><span className="label">Name for labeller {who}</span><input className="input" value={labels[who].labeller} onChange={(e) => setLabellerName(who, e.target.value)} /></label>
              <div className="small muted">Label independently: don't look at the other labeller's answers. Labellers on different machines can export/import their JSON.</div>
            </div>
          </Panel>

          {call && (
            <div className="grid-2">
              <Panel title={`Call ${idx + 1} of ${lab.sample.length} · ${call.scenarioId} run ${(call.runIndex ?? 0) + 1}`} right={
                <div className="row">
                  <button className="btn small" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Prev</button>
                  <button className="btn small" disabled={idx >= lab.sample.length - 1} onClick={() => setIdx(idx + 1)}>Next →</button>
                </div>
              }>
                <div className="small muted" style={{ marginBottom: 8 }}>{scenarioById.get(call.scenarioId!)?.title}</div>
                <CallTranscript call={call} />
              </Panel>
              <Panel title={`Labeller ${who}: ${labels[who].labeller}`}>
                <div className="stack-sm">
                  <div className="spread"><span>Outcome correct for this borrower?</span><YesNo value={cur.outcomeCorrect} onChange={(v) => update({ outcomeCorrect: v })} /></div>
                  <div className="spread"><span>Script compliant (conduct)?</span><YesNo value={cur.scriptCompliant} onChange={(v) => update({ scriptCompliant: v })} /></div>
                  <span className="label">Failure categories seen</span>
                  <div className="label-grid">
                    {TAXONOMY.map((t) => (
                      <label key={t.id} className="check small"><input type="checkbox" checked={cur.categories.includes(t.id)} onChange={(e) => update({ categories: e.target.checked ? [...cur.categories, t.id] : cur.categories.filter((c) => c !== t.id) })} />{t.label}</label>
                    ))}
                  </div>
                  <label className="field"><span className="label">Note</span><textarea className="input" rows={3} value={cur.note} onChange={(e) => update({ note: e.target.value })} /></label>
                  {judge?.verdicts[call.id] !== undefined && <div className="small muted">Judge said: {String(judge.verdicts[call.id])} (shown after calibration only for review)</div>}
                </div>
              </Panel>
            </div>
          )}

          <Panel title="Judge calibration (script compliance only)">
            <div className="stack-sm">
              <p className="small">Runs the LLM judge on every call where both labellers agree on script compliance, then compares. If κ ≥ {settings.judgeKappaThreshold} the judge may be used on unlabelled calls; otherwise it stays off and humans label.</p>
              <div className="row">
                <button className="btn primary" onClick={runCalibration} disabled={judging}>{judging ? 'Judging…' : `Calibrate on ${Object.keys(lab.consensusScript).length} consensus calls`}</button>
                {judge && <button className="btn small" onClick={() => setJudge(null)}>Reset</button>}
              </div>
              {judge ? <div className="small num">Last: {judge.at} · n={judge.n} · agreement {pct(judge.agreement)} · κ {judge.kappa?.toFixed(2) ?? '—'} → {judge.calibrated ? 'calibrated' : 'NOT calibrated'}</div> : <NotRun />}
              {err && <div className="notice warn">{err}</div>}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
