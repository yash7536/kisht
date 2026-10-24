import { useMemo, useState } from 'react';
import { CallTranscript, NotRun, Panel } from '../components/ui';
import { failureCounts } from '../lib/metrics';
import { TAXONOMY } from '../lib/taxonomy';
import { useStore } from '../store';

export default function Taxonomy() {
  const { grades, activeRun, scenarioById } = useStore();
  const counts = useMemo(() => failureCounts(grades), [grades]);
  const [open, setOpen] = useState<string | null>(null);
  const callById = useMemo(() => new Map((activeRun?.calls ?? []).map((c) => [c.id, c])), [activeRun]);
  const totalCalls = grades.length;

  const examples = (cat: string) =>
    grades.flatMap((g) => g.failures.filter((f) => f.category === cat).map((f) => ({ g, f }))).slice(0, 4);

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">Failures grouped from the active run</span>
        <h2>Failure taxonomy</h2>
        <p className="lede">Each category maps to the terms voice-agent teams use (hallucination, missed intent, compliance gap, flow deviation). “Caught” means a code guard stopped it before the borrower heard it. It still counts against the model.</p>
      </div>
      {!activeRun && <div className="notice">No run yet: the categories below are definitions only. Counts appear after an eval run.</div>}

      <Panel title="Categories" pad={false} right={activeRun ? <span className="small num">{totalCalls} calls in active run</span> : <NotRun />}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Category</th><th>Industry term</th><th>Severity</th><th>Definition</th><th>Detected by</th><th className="num">Events</th><th className="num">Calls</th><th className="num">Caught</th></tr></thead>
            <tbody>
              {TAXONOMY.map((c) => {
                const n = counts[c.id];
                return (
                  <tr key={c.id} className={n && c.severity === 'critical' ? 'fail-row' : ''}>
                    <td><b>{c.label}</b></td>
                    <td className="small">{c.industryTerm}</td>
                    <td><span className={`chip ${c.severity === 'critical' ? 'fail' : ''}`}>{c.severity}</span></td>
                    <td className="small">{c.definition}</td>
                    <td className="small muted">{c.detectedBy}</td>
                    <td className="num">{activeRun ? n?.total ?? 0 : '—'}</td>
                    <td className="num">{activeRun ? n?.calls.size ?? 0 : '—'}</td>
                    <td className="num">{activeRun ? n?.caught ?? 0 : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {activeRun && TAXONOMY.filter((c) => counts[c.id]).map((c) => (
        <Panel key={c.id} title={<span className="row"><span className={`chip ${c.severity === 'critical' ? 'fail' : ''}`}>{c.severity}</span><span className="serif" style={{ fontSize: 18 }}>{c.label}</span></span>} right={<span className="small num">{counts[c.id].total} events</span>}>
          <div className="stack-sm">
            {examples(c.id).map(({ g, f }, i) => (
              <div key={i} className="stack-sm">
                <div className="spread">
                  <span className="small"><span className="num">{g.scenarioId}</span> · run {g.runIndex + 1} · {scenarioById.get(g.scenarioId)?.title} — <span className="muted">{f.detail}</span></span>
                  <button className="btn small" onClick={() => setOpen(open === g.callId ? null : g.callId)}>{open === g.callId ? 'Hide' : 'Transcript'}</button>
                </div>
                {open === g.callId && callById.get(g.callId) && <CallTranscript call={callById.get(g.callId)!} />}
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
