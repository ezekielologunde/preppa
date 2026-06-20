import { Eye, EyeOff } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const inputStyle = {
  fontFamily: Font.body,
  fontSize: 15,
  color: Palette.ink,
  backgroundColor: Palette.surface,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: Palette.border,
  minHeight: 44,
} as const;

export function ChangePasswordPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (next.length < 8) {
      setError('New password must be at least 8 characters');
      feedback.error();
      return;
    }
    if (next !== confirm) {
      setError('Passwords do not match');
      feedback.error();
      return;
    }
    setSaving(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: current,
    });
    if (signInErr) {
      setSaving(false);
      setError('Current password is incorrect');
      feedback.error();
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({
      password: next,
    });
    setSaving(false);
    if (updateErr) {
      setError(updateErr.message);
      feedback.error();
      return;
    }
    feedback.success();
    setDone(true);
    setTimeout(onClose, 1000);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: -8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      style={{
        backgroundColor: Palette.canvas,
        marginHorizontal: 16,
        marginBottom: 4,
        borderRadius: 16,
        padding: 16,
        gap: 12,
      }}>
      {done ? (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text
            style={{
              fontFamily: Font.semibold,
              fontSize: 15,
              color: Palette.success,
            }}>
            Password updated
          </Text>
        </MotiView>
      ) : (
        <>
          <TextInput
            value={current}
            onChangeText={setCurrent}
            placeholder="Current password"
            placeholderTextColor={Palette.textSecondary}
            secureTextEntry
            maxLength={128}
            accessibilityLabel="Current password"
            style={inputStyle}
          />
          <View>
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={Palette.textSecondary}
              secureTextEntry={!showNext}
              maxLength={128}
              accessibilityLabel="New password"
              style={inputStyle}
            />
            <PressableScale
              onPress={() => setShowNext((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showNext ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 14,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}>
              {showNext ? (
                <EyeOff size={18} color={Palette.textSecondary} />
              ) : (
                <Eye size={18} color={Palette.textSecondary} />
              )}
            </PressableScale>
          </View>
          <View>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={Palette.textSecondary}
              secureTextEntry={!showConfirm}
              maxLength={128}
              accessibilityLabel="Confirm new password"
              style={inputStyle}
            />
            <PressableScale
              onPress={() => setShowConfirm((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              style={{
                position: 'absolute',
                right: 14,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}>
              {showConfirm ? (
                <EyeOff size={18} color={Palette.textSecondary} />
              ) : (
                <Eye size={18} color={Palette.textSecondary} />
              )}
            </PressableScale>
          </View>
          {error ? (
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 12,
                color: Palette.danger,
              }}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel password change"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                backgroundColor: Palette.chip,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontFamily: Font.semibold,
                  fontSize: 14,
                  color: Palette.inkSoft,
                }}>
                cancel
              </Text>
            </PressableScale>
            <PressableScale
              onPress={handleSubmit}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Update password"
              accessibilityState={{ disabled: saving }}
              style={{
                flex: 2,
                height: 44,
                borderRadius: Radius.pill,
                backgroundColor: Palette.brand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saving ? 0.6 : 1,
              }}>
              <Text
                style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                {saving ? 'updating…' : 'update password'}
              </Text>
            </PressableScale>
          </View>
        </>
      )}
    </MotiView>
  );
}
