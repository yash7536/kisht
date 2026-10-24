/**
 * Browser speech: Web Speech API SpeechRecognition (STT) and SpeechSynthesis (TTS).
 * Support varies (Chrome/Edge have recognition; Firefox does not). Everything degrades to typing.
 * Timings measured here are browser-side approximations, labelled as such in the UI.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

export function sttSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SttResult {
  text: string;
  /** ms from end of speech (onspeechend) to the final result: approximate recognition latency. */
  sttMs: number | undefined;
}

export function listenOnce(lang: string, onInterim?: (t: string) => void): { promise: Promise<SttResult>; stop: () => void } {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const rec: SR = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let speechEnd: number | undefined;
  const promise = new Promise<SttResult>((resolve, reject) => {
    let finalText = '';
    rec.onspeechend = () => { speechEnd = performance.now(); };
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onInterim?.(finalText + interim);
    };
    rec.onerror = (e: any) => reject(new Error(e.error || 'speech recognition error'));
    rec.onend = () => resolve({ text: finalText.trim(), sttMs: speechEnd ? performance.now() - speechEnd : undefined });
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}

export function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ?? voices.find((v) => v.lang === 'hi-IN') ?? voices.find((v) => v.lang === 'en-IN');
}

/** Speak text; resolves with ms from speak() call to audio start (onstart). */
export function speak(text: string, lang: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve(undefined);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    const t0 = performance.now();
    let started: number | undefined;
    u.onstart = () => { started = performance.now() - t0; resolve(started); };
    u.onerror = () => resolve(undefined);
    window.speechSynthesis.speak(u);
    setTimeout(() => resolve(started), 4000);
  });
}

export function stopSpeaking(): boolean {
  if (!ttsSupported()) return false;
  const was = window.speechSynthesis.speaking;
  window.speechSynthesis.cancel();
  return was;
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking;
}
