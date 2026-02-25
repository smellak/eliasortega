import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "chat-sound-enabled";

function getInitialState(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

/**
 * Web Audio API notification sound.
 * Plays a short 800Hz sine "ding" (150ms fade-out).
 */
export function useNotificationSound() {
  const [soundEnabled, setSoundEnabled] = useState(getInitialState);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const toggle = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const play = useCallback(() => {
    if (!soundEnabled) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext not supported or blocked — ignore
    }
  }, [soundEnabled]);

  return { soundEnabled, toggle, play };
}
