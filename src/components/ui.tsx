import type { ReactNode } from 'react';
import type { CallRecord, TurnRecord } from '../lib/agent';
import { judgeTarget, type Target } from '../lib/decision';
import { LANG_LABELS, type DetectedLang } from '../lib/language';
import type { Summary } from '../lib/metrics';
import { allowedFactsFromCard, POLICY_CARD } from '../lib/policyCard';
import { checkNumbers } from '../lib/numbers';
import { TAXONOMY_BY_ID } from '../lib/taxonomy';

export const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);
export const ms = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)} ms`);
export const inr = (v: number | null | undefined, digits = 3) => (v === null || v === undefined ? '—' : `₹${v.toFixed(digits)}`);

export function Panel({ title, right, children, className = '', pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <div className="panel-head">
          {typeof title === 'string' ? <span className="label">{title}</span> : title}
          {right}
        </div>
      )}
      <div className={pad ? 'panel-body' : ''}>{children}</div>
    </section>
  );
}

export function NotRun({ what = 'Not run yet' }: { what?: string }) {
  return <span className="chip notrun">{what}</span>;
}

function fmtTarget(t: Target, value: number): string {
  if (t.unit === '%') return `${(value * 100).toFixed(t.value < 0.2 ? 0 : 0)}%`;
  if (t.unit === 'ms') return `${value} ms`;
  return String(value);
}

export function TargetTiles({ targets, summary, latencyThresholdMs }: { targets: Target[]; summary: Summary | null; latencyThresholdMs: number }) {
  return (
    <div className="tiles">
      {targets.map((t) => {
        const r = judgeTarget(t, summary, latencyThresholdMs);
        const tv = t.id === 'p95LatencyMs' ? latencyThresholdMs : t.value;
        const chip = r.verdict === 'not_run' ? <NotRun what="Not run" /> : r.verdict === 'pass' ? <span className="chip pass">Pass</span> : <span className={`chip ${t.critical ? 'solid-critical' : 'fail'}`}>{t.critical ? 'Critical' : 'Fail'}</span>;
        const val = r.value === null ? null : t.unit === '%' ? pct(r.value) : t.unit === 'ms' ? ms(r.value) : String(r.value);
        return (
          <div key={t.id} className={`tile ${r.verdict === 'fail' ? 'fail' : ''}`} title={t.why}>
            <div className="tile-top">
              <span className="tile-name">{t.label}</span>
              {chip}
            </div>
            <div className={`tile-value ${val === null ? 'notrun' : ''} ${r.verdict === 'fail' ? 'fail-text' : ''}`}>{val ?? 'not run yet'}</div>
            <div className="tile-target">Target {t.op === '==' ? '=' : t.op === '>=' ? '≥' : '≤'} {fmtTarget(t, tv)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function LangChip({ lang }: { lang: DetectedLang }) {
  return <span className="chip">{lang === 'unknown' ? 'lang ?' : LANG_LABELS[lang]}</span>;
}

/** Card facts actually present in an agent line ("grounded entities"). */
function groundedEntities(text: string, extraDates: string[]): string[] {
  const g = checkNumbers(text, allowedFactsFromCard(POLICY_CARD, extraDates));
  const bad = new Set(g.violations.map((v) => v.mention));
  return g.mentions.filter((m) => !bad.has(m)).map((m) => (m.kind === 'amount' ? `₹${m.value.toLocaleString('en-IN')}` : m.kind === 'date' ? `${m.value}${m.month ? '/' + m.month : ''}` : String(m.value)));
}

export function TurnView({ turn, showDrafts = true, demo = false }: { turn: TurnRecord; showDrafts?: boolean; demo?: boolean }) {
  const blockedDrafts = turn.attempts.filter((a) => a.rejected.length > 0);
  const promiseOk = turn.analysis.validity === 'ok' && turn.analysis.promise.date ? [turn.analysis.promise.date] : [];
  const entities = groundedEntities(turn.reply, promiseOk);
  const lastProposal = turn.attempts.at(-1)?.proposal;
  return (
    <>
      <div className="turn borrower">
        <div className="turn-head">
          <span className="turn-who label">Borrower{turn.interrupted ? ' · interrupts' : ''}</span>
          <span className="row">
            <LangChip lang={turn.borrowerLang} />
            {turn.sttMs !== undefined && <span className="chip lower num">STT {Math.round(turn.sttMs)} ms</span>}
          </span>
        </div>
        <div className="turn-text">{turn.borrowerText}</div>
        <div className="turn-meta">
          {turn.analysis.promise.date && (
            <span className={`chip ${turn.analysis.validity === 'ok' ? 'ok' : 'fail'}`}>
              Promise parsed: {turn.analysis.promise.date} · {turn.analysis.validity}
              {turn.analysis.promise.corrected ? ' · self-corrected' : ''}
            </span>
          )}
          {turn.analysis.promise.vague && <span className="chip">Vague date</span>}
          {turn.analysis.handoffHits.map((h) => <span key={h.reason} className="chip fail">Trigger: {h.reason}</span>)}
          {turn.analysis.alreadyPaid && <span className="chip ok">Already paid</span>}
        </div>
      </div>

      {showDrafts && blockedDrafts.map((a, i) => (
        <div key={i} className="turn agent blocked">
          <div className="turn-head">
            <span className="turn-who label">{demo ? 'Hand-written draft' : 'Agent draft'} · blocked by guard</span>
            <span className="chip fail">Not spoken</span>
          </div>
          <div className="turn-text strike">{a.proposal?.reply ?? a.rawText ?? a.error}</div>
          <div className="small fail-text">{a.rejected.join(' · ')}</div>
        </div>
      ))}

      <div className="turn agent">
        <div className="turn-head">
          <span className="turn-who label">Agent · {demo && (turn.replySource === 'model' || turn.replySource === 'model_retry') ? `hand-written${turn.replySource === 'model_retry' ? ' retry' : ''} (not model output)` : turn.replySource.replace('_', ' ')}</span>
          <span className="row">
            {turn.llmLatencyMs > 0 && <span className="chip lower num">LLM {Math.round(turn.llmLatencyMs)} ms</span>}
            {turn.ttsStartMs !== undefined && <span className="chip lower num">TTS start {Math.round(turn.ttsStartMs)} ms</span>}
            {turn.costInr > 0 && <span className="chip lower num">{inr(turn.costInr, 4)} est.</span>}
          </span>
        </div>
        <div className="turn-text">“{turn.reply}”</div>
        <div className="turn-meta">
          <span className="label">Intent:</span>
          <span className="num small">{turn.replySource === 'model' || turn.replySource === 'model_retry' ? String(lastProposal?.intent ?? '—') : 'forced handoff (code)'}</span>
          <span className="chip">{turn.stateBefore} → {turn.stateAfter}</span>
          {entities.length > 0 && <span className="chip ok">Grounded entities: {entities.join(' / ')}</span>}
          {turn.events.map((e, i) => (
            <span key={i} className={`chip ${e.caught ? 'fail' : 'critical'}`} title={e.detail}>
              {TAXONOMY_BY_ID[e.category]?.label ?? e.category}{e.caught ? ' · caught' : ''}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export function CallTranscript({ call }: { call: CallRecord }) {
  return (
    <div className="transcript">
      <div className="turn agent">
        <div className="turn-head">
          <span className="turn-who label">Agent · fixed greeting</span>
          {call.greetingViolations.length > 0 && <span className="chip fail">Greeting issue</span>}
        </div>
        <div className="turn-text">“{call.greeting}”</div>
      </div>
      {call.turns.map((t) => <TurnView key={t.index} turn={t} demo={call.mode === 'demo'} />)}
      <div className="row">
        <span className="label">Outcome</span>
        <span className="chip">{call.outcome.type}{'date' in call.outcome ? ` · ${call.outcome.date}` : ''}{'reason' in call.outcome ? ` · ${call.outcome.reason}` : ''}</span>
        <span className="chip lower num">{inr(call.costInr, 4)} est.</span>
      </div>
    </div>
  );
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(name: string, text: string, type = 'text/markdown') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
