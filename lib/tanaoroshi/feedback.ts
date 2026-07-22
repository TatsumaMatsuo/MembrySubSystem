/**
 * 棚卸: 読取フィードバック（音・バイブ）
 *
 * 画面を注視せず読取成否を判別できるようにする（非機能要件）。
 * - 音は Web Audio API で合成（音声ファイル不要）。
 * - iOS Safari は navigator.vibrate 未対応 → 音のみで判別できる設計。
 * - iOS は初回ユーザー操作前に音を鳴らせないため、開始時に unlock() を呼ぶ。
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** ユーザー操作イベント内で1度呼ぶ（iOS の自動再生制限を解除） */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (c && c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* noop */
    }
  }
}

function beep(freq: number, durationMs: number, times: number, gapMs = 60): void {
  const c = getCtx();
  if (!c) return;
  let start = c.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + durationMs / 1000);
    start += (durationMs + gapMs) / 1000;
  }
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop */
    }
  }
}

/** 読取成功（新規登録） */
export function feedbackSuccess(): void {
  beep(880, 80, 1);
  vibrate(40);
}

/** 加算発生（同一品目の再読取） */
export function feedbackAdd(): void {
  beep(880, 60, 2);
  vibrate([40, 40, 40]);
}

/** エラー（マスタ未登録・読取失敗） */
export function feedbackError(): void {
  beep(220, 300, 1);
  vibrate(200);
}

/** 警告（対象外品目など） */
export function feedbackWarn(): void {
  beep(440, 150, 2);
  vibrate([100, 60, 100]);
}
