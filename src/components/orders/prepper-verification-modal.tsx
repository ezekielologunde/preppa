import { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle, X } from 'lucide-react-native';
import { MotiView } from 'moti';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, TouchTarget, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  orderId: string;
  customerName?: string;
  onClose: () => void;
  onSuccess: () => void;
};

type ModalState = 'entry' | 'loading' | 'success' | 'error';

// ── PIN dots ─────────────────────────────────────────────────────────────────

function PinDots({ pin, error }: { pin: string; error: boolean }) {
  return (
    <View style={dotStyles.row}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            pin.length > i && dotStyles.dotFilled,
            error && dotStyles.dotError,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 8 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Palette.chip, borderWidth: 1.5, borderColor: Palette.border,
  },
  dotFilled: { backgroundColor: Palette.brand, borderColor: Palette.brand },
  dotError:  { borderColor: Palette.danger },
});

// ── Keypad ────────────────────────────────────────────────────────────────────

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'] as const;

type KeypadProps = {
  onKey: (k: string) => void;
  disabled: boolean;
};

function Keypad({ onKey, disabled }: KeypadProps) {
  return (
    <View style={kpStyles.grid}>
      {KEYS.map((key, idx) => {
        if (key === '') {
          return <View key={idx} style={kpStyles.empty} />;
        }
        const isBack = key === '⌫';
        return (
          <Pressable
            key={idx}
            style={({ pressed }) => [
              kpStyles.key,
              isBack && kpStyles.keyBack,
              pressed && kpStyles.keyPressed,
              disabled && kpStyles.keyDisabled,
            ]}
            onPress={() => { if (!disabled) onKey(key); }}
            android_ripple={{ color: 'rgba(255,255,255,0.08)', radius: 32 }}
            accessibilityLabel={isBack ? 'delete digit' : `digit ${key}`}
            accessibilityRole="button"
          >
            <Text style={[kpStyles.keyText, isBack && kpStyles.keyBackText]}>
              {key}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const kpStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: Space.xl },
  key: {
    flex: 1, minWidth: '30%', minHeight: 64,
    backgroundColor: Palette.prepperCard,
    borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  keyBack: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  keyDisabled: { opacity: 0.4 },
  keyText: { fontFamily: Font.display, fontSize: 24, color: '#FFFFFF', letterSpacing: 0 },
  keyBackText: { fontSize: 20 },
  empty: { flex: 1, minWidth: '30%', minHeight: 64 },
});

// ── Modal ────────────────────────────────────────────────────────────────────

export function PrepperVerificationModal({ visible, orderId, customerName, onClose, onSuccess }: Props) {
  const [pin, setPin]             = useState('');
  const [stage, setStage]         = useState<ModalState>('entry');
  const [errorMsg, setErrorMsg]   = useState('');
  const [attempts, setAttempts]   = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  function handleKey(key: string) {
    if (stage === 'loading' || stage === 'success') return;
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      if (stage === 'error') { setStage('entry'); setErrorMsg(''); }
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    Haptics.selectionAsync();
    if (next.length === 4) submitPin(next);
  }

  async function submitPin(attempt: string) {
    setStage('loading');
    try {
      const { data, error } = await supabase.rpc('verify_order_pin', {
        p_order_id: orderId,
        p_pin: attempt,
      });

      if (error) {
        const isLocked = error.message?.toLowerCase().includes('locked');
        handleError(isLocked
          ? 'Too many attempts. Please try again in 30 minutes.'
          : error.message ?? 'Verification failed. Try again.');
        return;
      }

      if (data === true) {
        setStage('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => { onSuccess(); resetModal(); }, 2_000);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        handleError(
          next >= 4
            ? `Incorrect PIN — ${5 - next} attempt${5 - next === 1 ? '' : 's'} remaining.`
            : 'Incorrect PIN. Please try again.',
        );
      }
    } catch {
      handleError('Network error. Please try again.');
    }
  }

  function handleError(msg: string) {
    setStage('error');
    setPin('');
    setErrorMsg(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function resetModal() {
    setPin('');
    setStage('entry');
    setErrorMsg('');
    setAttempts(0);
  }

  function handleClose() {
    if (stage === 'loading' || stage === 'success') return;
    resetModal();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ── Header ─────────────────────────────────────────────── */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>verify handoff</Text>
              {customerName ? (
                <Text style={styles.sheetSub}>Enter the PIN shown by {customerName}</Text>
              ) : (
                <Text style={styles.sheetSub}>{"Enter the customer's 4-digit PIN to release payment"}</Text>
              )}
            </View>
            {stage !== 'loading' && stage !== 'success' && (
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7} hitSlop={8}>
                <X size={18} color={Palette.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          {stage === 'success' ? (
            /* ── Success ──────────────────────────────────────────── */
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220 }}
              style={styles.successWrap}
            >
              <CheckCircle size={64} color={Palette.success} strokeWidth={1.5} />
              <Text style={styles.successTitle}>payment released</Text>
              <Text style={styles.successSub}>Funds are on their way to your account.</Text>
            </MotiView>
          ) : (
            /* ── PIN entry ────────────────────────────────────────── */
            <>
              <Animated.View style={{ transform: [{ translateX: shakeAnim }], marginBottom: Space.lg }}>
                <PinDots pin={pin} error={stage === 'error'} />
                {stage === 'error' && errorMsg ? (
                  <Text style={styles.errorText}>{errorMsg}</Text>
                ) : (
                  <Text style={styles.pinHint}>
                    {stage === 'loading' ? 'verifying…' : pin.length === 0 ? 'enter 4-digit PIN' : ' '}
                  </Text>
                )}
              </Animated.View>

              <Keypad onKey={handleKey} disabled={stage === 'loading'} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Palette.prepperBg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: Space.xl, paddingBottom: 48,
    ...Shadow.floating,
  },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, marginBottom: Space.xxl,
  },
  sheetTitle: {
    fontFamily: Font.display, fontSize: Type.title, color: '#FFFFFF', letterSpacing: -0.3,
  },
  sheetSub: {
    fontFamily: Font.body, fontSize: Type.label, color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  closeBtn: {
    width: TouchTarget, height: TouchTarget, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  errorText: {
    fontFamily: Font.medium, fontSize: Type.label, color: Palette.danger,
    textAlign: 'center', marginTop: 8,
  },
  pinHint: {
    fontFamily: Font.body, fontSize: Type.label, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 8, minHeight: 20,
  },

  successWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Space.xxl, gap: Space.lg, paddingHorizontal: Space.xl,
  },
  successTitle: {
    fontFamily: Font.display, fontSize: Type.displayLg, color: '#FFFFFF', letterSpacing: -0.5,
  },
  successSub: {
    fontFamily: Font.body, fontSize: Type.body, color: 'rgba(255,255,255,0.5)', textAlign: 'center',
  },
});
