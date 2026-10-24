import { useRef, useState } from 'react';
import { Panel, TurnView, inr, ms, downloadJson } from '../components/ui';
import { DEMO_TRANSCRIPTS } from '../data/demoTranscripts';
import { isEnded, runTurn, startCall, type CallSession, type TurnRecord } from '../lib/agent';
import { detectLanguage, LANG_LABELS, speechLangFor, type Lang } from '../lib/language';
import { formatCardDate, formatInr, POLICY_CARD, withinCallingHours } from '../lib/policyCard';
import { geminiProposer, scriptedProposer } from '../lib/proposers';
import { getApiKey } from '../lib/settings';
import { isSpeaking, listenOnce, speak, sttSupported, stopSpeaking, ttsSupported } from '../lib/speech';
import { CALL_STATES } from '../lib/stateMachine';
import { outsideHoursNotice } from '../lib/templates';
import { percentile } from '../lib/metrics';
import { useStore } from '../store';

const QUICK = [
  { label: 'Ask for discount', text: 'Late fee maaf kar doge kya? Pehli baar hai.' },
  { label: 'Claim already paid', text: 'Maine already pay kar diya hai app se.' },
  { label: 'Abusive language', text: 'Bakwas band karo, bewakoof log [abuse]' },
  { label: 'Request human agent', text: 'Mujhe kisi insaan se baat karni hai.' },
  { label: 'Self-correct date', text: '8 ko... nahi nahi 10 ko de dunga.' },
  { label: 'Ask interest rate', text: 'Interest rate kitna lag raha hai?' },
];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Simulator() {
  const { settings, addSimCall } = useStore();
  const [mode, setMode] = useState<'live' | 'demo'>(getApiKey() ? 'live' : 'demo');
  const [lang, setLang] = useState<Lang>('hinglish');
  const [demoId, setDemoId] = useState(DEMO_TRANSCRIPTS[0].id);
  const [override, setOverride] = useState(false);
  const session = useRef<CallSession | null>(null);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [interruptNext, setInterruptNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [, force] = useState(0);

  const demo = DEMO_TRANSCRIPTS.find((d) => d.id === demoId)!;
  const inHours = withinCallingHours(POLICY_CARD, nowHHMM());
  const blockedByHours = mode === 'live' && settings.enforceCallingHours && !inHours && !override;
  const s = session.current;
  const ended = s ? isEnded(s) : false;

  const say = async (text: string, turn?: TurnRecord) => {
    if (!settings.speakReplies || !ttsSupported()) return;
    const l = speechLangFor(detectLanguage(text) === 'unknown' ? (s?.record.greetingLang ?? lang) : detectLanguage(text));
    const t = await speak(text, l);
    if (turn && t !== undefined) {
      turn.ttsStartMs = t;
      force((x) => x + 1);
    }
  };

  const start = () => {
    setError(null);
    const callLang = mode === 'demo' ? demo.lang : lang;
    session.current = startCall(POLICY_CARD, settings, callLang, mode);
    setTurns([]);
    setGreeting(session.current.record.greeting);
    void say(session.current.record.greeting);
  };

  const send = async (text: string, sttMs?: number) => {
    if (!session.current || !text.trim() || busy) return;
    const wasSpeaking = isSpeaking();
    if (wasSpeaking) stopSpeaking();
    const interrupted = interruptNext || wasSpeaking;
    setBusy(true);
    setError(null);
    try {
      const proposer = mode === 'live'
        ? geminiProposer(settings, getApiKey())
        : scriptedProposer(demo.turns[session.current.record.turns.length]?.drafts ?? [{ reply: 'Demo transcript has no more turns.', intent: 'other', next_state: 'CLOSE' }]);
      const turn = await runTurn(session.current, text.trim(), proposer, { interrupted, sttMs });
      setTurns([...session.current.record.turns]);
      setInput('');
      setInterruptNext(false);
      const apiErr = turn.attempts.find((a) => a.error)?.error;
      if (apiErr) setError(apiErr);
      void say(turn.reply, turn);
      if (isEnded(session.current)) addSimCall(session.current.record);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const playDemoTurn = () => {
    const next = demo.turns[session.current?.record.turns.length ?? 0];
    if (next) {
      if (next.interrupt) setInterruptNext(true);
      void sendDemo(next.borrower, !!next.interrupt);
    }
  };
  const sendDemo = async (text: string, interrupt: boolean) => {
    setInterruptNext(interrupt);
    // setState is async; pass interrupt explicitly through a fresh closure.
    if (!session.current) return;
    setBusy(true);
    const turn = await runTurn(session.current, text, scriptedProposer(demo.turns[session.current.record.turns.length].drafts), { interrupted: interrupt });
    setTurns([...session.current.record.turns]);
    setInterruptNext(false);
    setBusy(false);
    void say(turn.reply, turn);
  };

  const mic = async () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    if (isSpeaking()) {
      stopSpeaking();
      setInterruptNext(true);
    }
    setListening(true);
    setError(null);
    try {
      const l = listenOnce(settings.sttLang, (t) => setInput(t));
      stopRef.current = l.stop;
      const r = await l.promise;
      setListening(false);
      if (r.text) await send(r.text, r.sttMs);
    } catch (e) {
      setListening(false);
      setError(`Microphone: ${(e as Error).message}`);
    }
  };

  const lat = turns.map((t) => t.llmLatencyMs).filter((x) => x > 0);
  const stt = turns.map((t) => t.sttMs).filter((x): x is number => x !== undefined);
  const tts = turns.map((t) => t.ttsStartMs).filter((x): x is number => x !== undefined);
  const last = turns.at(-1);
  const state = s?.record.machine.state;

  return (
    <div className="stack">
      <div className="page-head">
        <span className="label">Call simulator · type or speak as the borrower</span>
        <h2>One call, every guard visible</h2>
        <p className="lede">The model proposes each reply; code checks every number against the card, watches for handoff triggers, parses the promised date and enforces the call flow. Blocked drafts are shown struck through.</p>
      </div>

      <Panel title="Call setup" right={
        <div className="row">
          <button className={`btn small ${mode === 'live' ? 'on' : ''}`} onClick={() => setMode('live')} disabled={!getApiKey()} title={getApiKey() ? '' : 'Add your Gemini key in Settings'}>Live (Gemini)</button>
          <button className={`btn small ${mode === 'demo' ? 'on' : ''}`} onClick={() => setMode('demo')}>Demo (no key)</button>
        </div>
      }>
        <div className="stack-sm">
          {mode === 'demo' ? (
            <>
              <div className="notice warn"><b>Hand-written example, not model output.</b> These agent lines were written by hand to show the guards. The guards, parser and state machine below run for real on them.</div>
              <div className="field-row">
                <label className="field"><span className="label">Transcript</span>
                  <select className="input" value={demoId} onChange={(e) => { setDemoId(e.target.value); session.current = null; setTurns([]); setGreeting(null); }}>
                    {DEMO_TRANSCRIPTS.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </label>
                <div className="small muted" style={{ alignSelf: 'end' }}>{demo.shows}</div>
              </div>
            </>
          ) : (
            <div className="field-row">
              <label className="field"><span className="label">Greeting language</span>
                <select className="input" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                  {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
                </select>
              </label>
              <label className="field"><span className="label">Model</span><input className="input num" value={settings.model} readOnly /></label>
            </div>
          )}
          {mode === 'live' && settings.enforceCallingHours && !inHours && (
            <div className="notice warn">
              {outsideHoursNotice(POLICY_CARD)} It is {nowHHMM()} here.{' '}
              <label className="check"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override for testing (this is a simulator, no real person is called)</label>
            </div>
          )}
          <div className="row">
            <button className="btn primary" onClick={start} disabled={blockedByHours}>{s ? 'Restart call' : 'Start call'}</button>
            {mode === 'demo' && s && !ended && <button className="btn" onClick={playDemoTurn} disabled={busy || turns.length >= demo.turns.length}>Play next borrower turn</button>}
            {s && <button className="btn small" onClick={() => downloadJson(`${s.record.id}.json`, s.record)}>Download call JSON</button>}
          </div>
        </div>
      </Panel>

      <div className="grid-2">
        <div className="stack-sm">
          {!greeting && <div className="notice">Start a call to begin.</div>}
          {greeting && (
            <div className="transcript">
              <div className="turn agent">
                <div className="turn-head"><span className="turn-who label">Agent · fixed greeting</span><span className="chip ok">Discloses automated</span></div>
                <div className="turn-text">“{greeting}”</div>
              </div>
              {turns.map((t) => <TurnView key={t.index} turn={t} demo={s?.record.mode === 'demo'} />)}
              {ended && <div className="notice honest">Call ended · outcome <b>{s!.record.outcome.type}</b>{'date' in s!.record.outcome ? ` ${s!.record.outcome.date}` : ''}{'reason' in s!.record.outcome ? ` (${s!.record.outcome.reason})` : ''}.</div>}
            </div>
          )}
          {error && <div className="notice warn">{error}</div>}

          {mode === 'live' && s && !ended && (
            <Panel title="Borrower input" right={<span className="small muted">{sttSupported() ? `Mic: ${settings.sttLang}` : 'Mic not supported in this browser; type instead'}</span>}>
              <div className="stack-sm">
                <div className="row">{QUICK.map((q) => <button key={q.label} className="btn chipbtn" onClick={() => setInput(q.text)} disabled={busy}>{q.label}</button>)}</div>
                <div className="sim-input">
                  <input className="input" placeholder="Type what the borrower says (Hinglish, English, Marathi-English or Hindi)…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(input); }} disabled={busy} />
                  <button className={`btn ${listening ? 'on' : ''}`} onClick={mic} disabled={!sttSupported() || busy} aria-label="Speak">{listening ? '■ Stop' : '🎙 Speak'}</button>
                  <button className="btn primary send" onClick={() => send(input)} disabled={busy || !input.trim()}>{busy ? 'Thinking…' : 'Send turn'}</button>
                </div>
                <label className="check small"><input type="checkbox" checked={interruptNext} onChange={(e) => setInterruptNext(e.target.checked)} /> Mark as interruption (barge-in). Speaking while the agent talks does this automatically.</label>
              </div>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel title="Policy card (fictional)">
            <dl className="kv">
              <dt>Borrower</dt><dd>{POLICY_CARD.borrowerName}</dd>
              <dt>EMI due</dt><dd className="num">{formatInr(POLICY_CARD.emiAmountInr)}</dd>
              <dt>Due date</dt><dd className="num">{formatCardDate(POLICY_CARD.dueDate)}</dd>
              <dt>Call date</dt><dd className="num">{formatCardDate(POLICY_CARD.callDate)} (simulated)</dd>
              <dt>Promise window</dt><dd className="num">until {formatCardDate(POLICY_CARD.promiseWindowEnd)}</dd>
              <dt>Late charge</dt><dd className="num">{formatInr(POLICY_CARD.lateChargeInr)}</dd>
              <dt>Hours</dt><dd className="num">{POLICY_CARD.callingHours.start}–{POLICY_CARD.callingHours.end}</dd>
            </dl>
          </Panel>
          <Panel title="Call state (code)">
            <div className="state-strip">{CALL_STATES.map((st) => <span key={st} className={`chip ${st === state ? 'current' : ''}`}>{st}</span>)}</div>
          </Panel>
          <Panel title="Guard telemetry · last turn">
            {!last ? <span className="small muted">No turns yet.</span> : (
              <div className="stack-sm small">
                <div className="spread"><span>Drafts</span><span className="num">{last.attempts.length} ({last.attempts.filter((a) => a.rejected.length).length} blocked)</span></div>
                <div className="spread"><span>Numbers in final reply</span><span className="num">{last.attempts.at(-1)?.numberGuard?.mentions.map((m) => `${m.kind}:${m.value}`).join(', ') || 'none'}</span></div>
                <div className="spread"><span>Handoff triggers (borrower)</span><span className="num">{last.analysis.handoffHits.map((h) => h.reason).join(', ') || 'none'}</span></div>
                <div className="spread"><span>Promise parse</span><span className="num">{last.analysis.promise.date ? `${last.analysis.promise.date} (${last.analysis.validity})` : last.analysis.promise.vague ? 'vague' : 'none'}</span></div>
                <div className="spread"><span>Language</span><span className="num">{last.borrowerLang} → {last.agentLang}</span></div>
                <div className="spread"><span>Reply source</span><span className="num">{last.replySource}</span></div>
              </div>
            )}
          </Panel>
          <Panel title="Latency & cost (this call)">
            <dl className="kv small">
              <dt>LLM p50 / p95</dt><dd className="num">{ms(percentile(lat, 50))} / {ms(percentile(lat, 95))}</dd>
              <dt>STT (approx.)</dt><dd className="num">{stt.length ? ms(percentile(stt, 50)) : '—'}</dd>
              <dt>TTS start</dt><dd className="num">{tts.length ? ms(percentile(tts, 50)) : '—'}</dd>
              <dt>Cost (est.)</dt><dd className="num">{inr(s?.record.costInr ?? null, 4)}</dd>
            </dl>
            <div className="small muted">Browser-side timings; cost from token counts × the prices in Settings (estimates, verify before quoting).</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
