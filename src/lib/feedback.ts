import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// One cross-platform feedback primitive for the whole app: haptics on native
// (expo-haptics) and on mobile web (Vibration API), plus subtle WebAudio cues
// for success/alert moments. Routing every tap and key action through this
// keeps the "it heard me" feel consistent and dynamic system-wide.

const isWeb = Platform.OS === 'web';

function vibrate(pattern: number | number[]) {
  if (!isWeb || typeof navigator === 'undefined') return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no vibration motor (desktop) — silent no-op */
  }
}

// Lazily-created shared AudioContext; only resumes after a user gesture (which
// taps always are), so browsers don't block it.
let actx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (!isWeb || typeof window === 'undefined') return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    actx = actx ?? new AC();
    if (actx.state === 'suspended') void actx.resume();
    return actx;
  } catch {
    return null;
  }
}

/** A short, soft tone. delay/dur in seconds. Kept quiet so it never grates. */
function tone(freq: number, dur: number, delay = 0, type: OscillatorType = 'sine', gain = 0.04) {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const feedback = {
  /** Light selection tick — every tappable element. No sound (would grate). */
  tap() {
    if (isWeb) vibrate(8);
    else void Haptics.selectionAsync();
  },
  /** Medium press — primary buttons. */
  impact() {
    if (isWeb) vibrate(12);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Heavy press — context-shifting actions (workspace switch). */
  heavy() {
    if (isWeb) vibrate(20);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  /** Confirmation — added to cart, payment captured. Rising two-note. */
  success() {
    if (isWeb) {
      vibrate([12, 28, 12]);
      tone(587.33, 0.1); // D5
      tone(880, 0.14, 0.07); // A5
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  /** Soft warning — needs attention but not an error. */
  warning() {
    if (isWeb) {
      vibrate(24);
      tone(440, 0.14, 0, 'triangle', 0.05);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },
  /** Error — failed action. Low descending buzz. */
  error() {
    if (isWeb) {
      vibrate([24, 40, 24]);
      tone(220, 0.16, 0, 'sawtooth', 0.05);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
};
