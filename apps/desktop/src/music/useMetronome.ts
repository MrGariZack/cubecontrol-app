import { useCallback, useEffect, useRef, useState } from "react";
import { clampBpm } from "./delaySync";

const LOOKAHEAD_S = 0.1;
const SCHEDULE_MS = 25;
const CLICK_S = 0.04;

/**
 * Silent practice click locked to session BPM (Helix-style tempo panel).
 * Uses Web Audio scheduling — not setInterval — so it stays in time.
 */
export function useMetronome(bpm: number | null) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const bpmRef = useRef(bpm);

  bpmRef.current = bpm;

  const stopScheduler = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeContext = useCallback(async () => {
    stopScheduler();
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx !== null && ctx.state !== "closed") await ctx.close();
  }, [stopScheduler]);

  const scheduleClick = useCallback((ctx: AudioContext, time: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1200 : 880;
    gain.gain.setValueAtTime(accent ? 0.18 : 0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_S);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + CLICK_S);
  }, []);

  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    const currentBpm = bpmRef.current;
    if (ctx === null || currentBpm === null) return;
    const secondsPerBeat = 60 / clampBpm(currentBpm);
    while (nextNoteRef.current < ctx.currentTime + LOOKAHEAD_S) {
      const accent = beatRef.current % 4 === 0;
      scheduleClick(ctx, nextNoteRef.current, accent);
      nextNoteRef.current += secondsPerBeat;
      beatRef.current = (beatRef.current + 1) % 4;
    }
  }, [scheduleClick]);

  const stop = useCallback(() => {
    stopScheduler();
    setPlaying(false);
    beatRef.current = 0;
  }, [stopScheduler]);

  const start = useCallback(async () => {
    if (bpmRef.current === null) return;
    let ctx = ctxRef.current;
    if (ctx === null || ctx.state === "closed") {
      ctx = new AudioContext();
      ctxRef.current = ctx;
    }
    if (ctx.state === "suspended") await ctx.resume();
    nextNoteRef.current = ctx.currentTime + 0.05;
    beatRef.current = 0;
    stopScheduler();
    tick();
    timerRef.current = window.setInterval(tick, SCHEDULE_MS);
    setPlaying(true);
  }, [stopScheduler, tick]);

  const toggle = useCallback(() => {
    if (playing) stop();
    else void start();
  }, [playing, start, stop]);

  // Keep running when BPM changes; restart schedule from "now".
  useEffect(() => {
    if (!playing) return;
    if (bpm === null) {
      stop();
      return;
    }
    const ctx = ctxRef.current;
    if (ctx === null) return;
    nextNoteRef.current = ctx.currentTime + 0.05;
    beatRef.current = 0;
  }, [bpm, playing, stop]);

  useEffect(() => () => {
    void closeContext();
  }, [closeContext]);

  return { playing, toggle, stop, canPlay: bpm !== null && bpm >= 40 && bpm <= 240 };
}
