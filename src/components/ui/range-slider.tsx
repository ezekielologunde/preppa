import { useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, View } from 'react-native';

import { Palette, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

// Cross-platform slider primitives built on PanResponder (no reanimated
// worklets) so they behave identically on native and react-native-web. The
// gesture reads from a live ref, so inline parent callbacks never go stale.

const THUMB = 26;
const TRACK_H = 6;
const ROW_H = 44;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, min: number, max: number, step: number) =>
  clamp(Math.round((v - min) / step) * step + min, min, max);

function Track({ accent, fillLeft, fillWidth, disabled, thumbs }: {
  accent: string; fillLeft: number; fillWidth: number; disabled: boolean; thumbs: number[];
}) {
  const color = disabled ? Palette.border : accent;
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: THUMB / 2, right: THUMB / 2, top: (ROW_H - TRACK_H) / 2, height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: Palette.border }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: fillLeft, width: Math.max(fillWidth, 0), top: (ROW_H - TRACK_H) / 2, height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: color }} />
      {thumbs.map((x, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: x, top: (ROW_H - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#fff', borderWidth: 2.5, borderColor: color, ...Shadow.card }} />
      ))}
    </>
  );
}

/** Single-thumb slider over [min, max] in `step` increments. */
export function RangeSlider({ min, max, step = 1, value, onChange, disabled = false, accent = Palette.brand }: {
  min: number; max: number; step?: number; value: number; onChange: (v: number) => void; disabled?: boolean; accent?: string;
}) {
  const [w, setW] = useState(0);
  const s = useRef({ min, max, step, value, usable: 1, onChange, disabled });
  s.current = { min, max, step, value, usable: Math.max(w - THUMB, 1), onChange, disabled };

  const valueFromX = (e: GestureResponderEvent) => {
    const c = s.current;
    const r = clamp((e.nativeEvent.locationX - THUMB / 2) / c.usable, 0, 1);
    return snap(c.min + r * (c.max - c.min), c.min, c.max, c.step);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !s.current.disabled,
    onMoveShouldSetPanResponder: () => !s.current.disabled,
    onPanResponderGrant: (e) => { const v = valueFromX(e); feedback.tap(); if (v !== s.current.value) s.current.onChange(v); },
    onPanResponderMove: (e) => { const v = valueFromX(e); if (v !== s.current.value) s.current.onChange(v); },
  })).current;

  const usable = Math.max(w - THUMB, 1);
  const x = ((clamp(value, min, max) - min) / (max - min)) * usable;

  return (
    <View {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: ROW_H, justifyContent: 'center' }}>
      <Track accent={accent} fillLeft={THUMB / 2} fillWidth={x} disabled={disabled} thumbs={[x]} />
    </View>
  );
}

/** Two-thumb range slider; reports both bounds. Keeps lo ≤ hi − step. */
export function DualRangeSlider({ min, max, step = 1, lo, hi, onChange, accent = Palette.brand }: {
  min: number; max: number; step?: number; lo: number; hi: number; onChange: (lo: number, hi: number) => void; accent?: string;
}) {
  const [w, setW] = useState(0);
  const s = useRef({ min, max, step, lo, hi, usable: 1, onChange });
  s.current = { min, max, step, lo, hi, usable: Math.max(w - THUMB, 1), onChange };
  const active = useRef<'lo' | 'hi'>('lo');

  const valueFromX = (e: GestureResponderEvent) => {
    const c = s.current;
    const r = clamp((e.nativeEvent.locationX - THUMB / 2) / c.usable, 0, 1);
    return snap(c.min + r * (c.max - c.min), c.min, c.max, c.step);
  };
  const apply = (v: number) => {
    const c = s.current;
    if (active.current === 'lo') { const next = clamp(v, c.min, c.hi - c.step); if (next !== c.lo) c.onChange(next, c.hi); }
    else { const next = clamp(v, c.lo + c.step, c.max); if (next !== c.hi) c.onChange(c.lo, next); }
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const v = valueFromX(e);
      active.current = Math.abs(v - s.current.lo) <= Math.abs(v - s.current.hi) ? 'lo' : 'hi';
      feedback.tap();
      apply(v);
    },
    onPanResponderMove: (e) => apply(valueFromX(e)),
  })).current;

  const usable = Math.max(w - THUMB, 1);
  const xlo = ((clamp(lo, min, max) - min) / (max - min)) * usable;
  const xhi = ((clamp(hi, min, max) - min) / (max - min)) * usable;

  return (
    <View {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: ROW_H, justifyContent: 'center' }}>
      <Track accent={accent} fillLeft={THUMB / 2 + xlo} fillWidth={xhi - xlo} disabled={false} thumbs={[xlo, xhi]} />
    </View>
  );
}
