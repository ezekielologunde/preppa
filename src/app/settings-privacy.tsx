import { useRouter } from 'expo-router';
import { AlertTriangle, Bell, Lock, Trash2, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsHeader, SettingsRow } from '@/components/settings-ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

const LEAVE_REASONS = [
  'Too expensive',
  'Not enough chefs near me',
  'Found another service',
  'Not using it enough',
  'Privacy concerns',
  'Something else',
];

const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

/** Two-step destructive flow: warning confirm → exit survey + final confirm. */
function DeleteAccountModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: (reason: string, note: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');

  function close() { setStep(1); setReason(null); setNote(''); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <MotiView from={{ translateY: 40, opacity: 0 }} animate={{ translateY: 0, opacity: 1 }} transition={{ type: 'timing', duration: 260 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 40 : 26, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color={Palette.danger} />
            </View>
            <PressableScale onPress={() => { feedback.tap(); close(); }} accessibilityRole="button" accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textSecondary} />
            </PressableScale>
          </View>

          {step === 1 ? (
            <>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, marginTop: 6 }}>Delete your account?</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginTop: 8 }}>
                This permanently removes your Preppa account, order history, saved addresses, and active
                subscriptions. It can’t be undone. You’ll be asked to confirm once more.
              </Text>
              <PressableScale onPress={() => { feedback.warning(); setStep(2); }} accessibilityRole="button" accessibilityLabel="Continue to delete"
                style={{ marginTop: 20, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Continue</Text>
              </PressableScale>
              <PressableScale onPress={() => { feedback.tap(); close(); }} accessibilityRole="button" accessibilityLabel="Keep my account"
                style={{ marginTop: 10, height: 50, borderRadius: Radius.pill, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Keep my account</Text>
              </PressableScale>
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, marginTop: 6 }}>Before you go</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20, marginTop: 6 }}>
                We’re sorry to see you leave. What’s the main reason? It helps us do better for local chefs and eaters.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {LEAVE_REASONS.map((r) => {
                  const active = reason === r;
                  return (
                    <PressableScale key={r} onPress={() => { feedback.tap(); setReason(r); }} accessibilityRole="button"
                      accessibilityState={{ selected: active }} accessibilityLabel={r}
                      style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.pill, backgroundColor: active ? Palette.brandTint : Palette.canvas, borderWidth: 1.5, borderColor: active ? Palette.brand : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? Palette.brand : Palette.inkSoft }}>{r}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <TextInput
                value={note}
                onChangeText={(t) => setNote(cleanBlock(t))}
                placeholder="Anything else? (optional)"
                placeholderTextColor={Palette.textMuted}
                multiline
                maxLength={300}
                textAlignVertical="top"
                style={{ marginTop: 14, minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.canvas, padding: 12, fontFamily: Font.body, fontSize: 14, color: Palette.ink }}
                accessibilityLabel="Additional feedback"
              />
              <PressableScale
                onPress={() => { feedback.error(); onConfirm(reason ?? 'Not specified', cleanBlock(note).trim()); }}
                disabled={!reason}
                accessibilityRole="button"
                accessibilityLabel="Permanently delete my account"
                style={{ marginTop: 18, height: 52, borderRadius: Radius.pill, backgroundColor: reason ? Palette.danger : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: reason ? '#fff' : Palette.textMuted }}>Permanently delete account</Text>
              </PressableScale>
              <PressableScale onPress={() => { feedback.tap(); close(); }} accessibilityRole="button" accessibilityLabel="Cancel"
                style={{ marginTop: 10, height: 50, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Cancel</Text>
              </PressableScale>
            </ScrollView>
          )}
        </MotiView>
      </View>
    </Modal>
  );
}

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const { requestAccountDeletion } = useAuth();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 2600); };

  async function handleDelete(reason: string, note: string) {
    // Real deletion: the RPC deactivates the account (status→deleted), records the
    // reason for the audit trail, then signs out. The auth screen explains the
    // 30-day restore window. No more "check your email" promise that never arrives.
    setDeleteOpen(false);
    const { error } = await requestAccountDeletion(reason, note || null);
    if (error) {
      feedback.error();
      flash('Could not delete your account. Please try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader title="privacy & security" subtitle="Control what reaches you, keep your account safe." />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40, gap: 20 }}>
          {/* Notifications */}
          <SettingsGroup title="notifications" delay={0}>
            <SettingsRow Icon={Bell} label="Notification preferences" sub="Push, email & SMS, per category" onPress={() => router.push('/notification-settings')} isLast />
          </SettingsGroup>

          {/* Security */}
          <SettingsGroup title="security" delay={60}>
            <SettingsRow Icon={Lock} label="Password" sub="Change your account password" onPress={() => router.push('/change-password')} isLast />
          </SettingsGroup>

          {/* Account management */}
          <SettingsGroup title="account management" delay={120}>
            <SettingsRow Icon={Trash2} label="Delete account" sub="Permanently remove your account and data" danger onPress={() => { feedback.impact(); setDeleteOpen(true); }} isLast />
          </SettingsGroup>
        </ScrollView>

        {toast ? (
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>

      <DeleteAccountModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} />
    </View>
  );
}
