import { useRouter } from 'expo-router';
import {
  Apple,
  ChevronLeft,
  ChevronRight,
  Download,
  Fingerprint,
  Lock,
  Mail,
  Shield,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChangePasswordPanel } from '@/components/account/change-password';
import { DeleteAccountModals } from '@/components/account/delete-account';
import { DownloadDataModal } from '@/components/account/download-data-modal';
import { Divider, Row, SectionLabel, StatusBadge } from '@/components/account/account-row';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Shadow } from '@/constants/theme';
import { exportMyData } from '@/lib/export-data';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const router = useRouter();
  const { user, requestAccountDeletion } = useAuth();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [biometric, setBiometric] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Download data modal
  const [downloadModal, setDownloadModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Delete account flow: step 0 = closed, 1 = "are you sure", 2 = "type DELETE"
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const providers: string[] = (user?.app_metadata?.providers as string[]) ?? [];

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2800);
  };

  const soon = (label: string) => {
    feedback.warning();
    flash(`${label} — coming soon`);
  };

  const handleDownloadConfirm = async () => {
    if (downloading) return;
    setDownloading(true);
    const { error } = await exportMyData();
    setDownloading(false);
    if (error) {
      feedback.error();
      flash('Could not export your data. Please try again.');
      return;
    }
    setDownloadModal(false);
    feedback.success();
    flash('Your data has been exported.');
  };

  const handleDeleteConfirm = async () => {
    if (deleteInput !== 'DELETE' || deleting) return;
    setDeleting(true);
    const { error } = await requestAccountDeletion(null, null);
    setDeleting(false);
    if (error) {
      feedback.error();
      flash('Could not delete your account. Please try again.');
      return;
    }
    // requestAccountDeletion deactivated the account server-side and signed out;
    // the user lands on the auth screen, which explains the deletion + restore window.
    setDeleteStep(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            gap: 12,
          }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text
            style={{
              fontFamily: Font.display,
              fontSize: 22,
              color: Palette.ink,
              letterSpacing: -0.5,
            }}>
            account
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 28 }}>
          {/* ── SECURITY ─────────────────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <SectionLabel label="security" />
            <View
              style={{
                backgroundColor: Palette.surface,
                borderRadius: 20,
                overflow: 'hidden',
              }}>
              {/* Change password row */}
              <Row
                icon={<Lock size={17} color={Palette.textSecondary} />}
                label="change password"
                right={
                  <MotiView
                    animate={{ rotate: passwordOpen ? '90deg' : '0deg' }}
                    transition={{ type: 'timing', duration: 200 }}
                  >
                    <ChevronRight size={18} color={Palette.textSecondary} />
                  </MotiView>
                }
                onPress={() => { feedback.tap(); setPasswordOpen((v) => !v); }}
                accessLabel="Change password"
              />
              {passwordOpen ? (
                <ChangePasswordPanel onClose={() => setPasswordOpen(false)} />
              ) : null}

              <Divider />

              {/* 2FA */}
              <Row
                icon={<Shield size={17} color={Palette.textSecondary} />}
                label="two-factor authentication"
                right={<StatusBadge label="Off" type="gray" />}
                onPress={() => soon('Two-factor authentication')}
                accessLabel="Two-factor authentication"
              />
              <Divider />

              {/* Sessions */}
              <Row
                icon={<Smartphone size={17} color={Palette.textSecondary} />}
                label="active sessions"
                right={<StatusBadge label="1 device" type="gray" />}
                onPress={() => soon('Active sessions')}
                accessLabel="Active sessions"
              />
              <Divider />

              {/* Biometric */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  minHeight: 52,
                }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: Palette.chip,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Fingerprint size={17} color={Palette.textSecondary} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Font.medium,
                    fontSize: 15,
                    color: Palette.ink,
                  }}>
                  biometric login
                </Text>
                <Switch
                  value={biometric}
                  onValueChange={(v) => {
                    setBiometric(v);
                    feedback.tap();
                  }}
                  trackColor={{ false: Palette.border, true: Palette.brand }}
                  thumbColor="#fff"
                  ios_backgroundColor={Palette.border}
                  accessibilityRole="switch"
                  accessibilityLabel="Biometric login"
                  accessibilityState={{ checked: biometric }}
                />
              </View>
            </View>
          </MotiView>

          {/* ── CONNECTED ACCOUNTS ───────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }}>
            <SectionLabel label="connected accounts" />
            <View
              style={{
                backgroundColor: Palette.surface,
                borderRadius: 20,
                overflow: 'hidden',
              }}>
              {/* Google */}
              <Row
                icon={
                  <Text
                    style={{
                      fontFamily: Font.heading,
                      fontSize: 16,
                      color: '#4285F4',
                    }}>
                    G
                  </Text>
                }
                label="Google"
                right={
                  <StatusBadge
                    label={providers.includes('google') ? 'Connected' : 'Connect'}
                    type={providers.includes('google') ? 'green' : 'orange'}
                  />
                }
                onPress={() => soon('Google sign-in')}
                accessLabel={
                  providers.includes('google')
                    ? 'Google — Connected'
                    : 'Connect Google account'
                }
              />
              <Divider />

              {/* Apple */}
              <Row
                icon={<Apple size={17} color={Palette.ink} />}
                label="Apple"
                right={
                  <StatusBadge
                    label={providers.includes('apple') ? 'Connected' : 'Connect'}
                    type={providers.includes('apple') ? 'green' : 'orange'}
                  />
                }
                onPress={() => soon('Apple sign-in')}
                accessLabel={
                  providers.includes('apple')
                    ? 'Apple — Connected'
                    : 'Connect Apple account'
                }
              />
              <Divider />

              {/* Email — always locked */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  minHeight: 52,
                }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: Palette.chip,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Mail size={17} color={Palette.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: Font.medium,
                      fontSize: 15,
                      color: Palette.ink,
                    }}>
                    email
                  </Text>
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 13,
                      color: Palette.textSecondary,
                      marginTop: 1,
                    }}
                    numberOfLines={1}>
                    {user?.email ?? '—'}
                  </Text>
                </View>
                <Lock size={15} color={Palette.textSecondary} />
              </View>
            </View>
          </MotiView>

          {/* ── DATA & PRIVACY ───────────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 160 }}>
            <SectionLabel label="data & privacy" />
            <View
              style={{
                backgroundColor: Palette.surface,
                borderRadius: 20,
                overflow: 'hidden',
              }}>
              <Row
                icon={<Download size={17} color={Palette.textSecondary} />}
                label="download my data"
                right={<ChevronRight size={18} color={Palette.textSecondary} />}
                onPress={() => { feedback.tap(); setDownloadModal(true); }}
                accessLabel="Download my data"
              />
              <Divider />
              <Row
                icon={<Shield size={17} color={Palette.textSecondary} />}
                label="privacy settings"
                right={<ChevronRight size={18} color={Palette.textSecondary} />}
                onPress={() => soon('Privacy settings')}
                accessLabel="Privacy settings"
              />
            </View>
          </MotiView>

          {/* ── DANGER ZONE ──────────────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 240 }}>
            <SectionLabel label="danger zone" />
            <View
              style={{
                backgroundColor: Palette.danger + '0F',
                borderRadius: 20,
                overflow: 'hidden',
                padding: 16,
              }}>
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: 13,
                  color: Palette.danger,
                  marginBottom: 14,
                  lineHeight: 19,
                }}>
                Deleting your account is permanent. All your data, orders, and
                preferences will be removed and cannot be recovered.
              </Text>
              <PressableScale
                onPress={() => { feedback.warning(); setDeleteStep(1); }}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                style={{
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: Palette.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 10,
                }}>
                <Trash2 size={18} color="#fff" />
                <Text
                  style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>
                  delete account
                </Text>
              </PressableScale>
            </View>
          </MotiView>
        </ScrollView>

        {/* ── Toast ──────────────────────────────────────────────────────── */}
        {toast ? (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 28,
              backgroundColor: Palette.ink,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 13,
              ...Shadow.floating,
            }}>
            <Text
              style={{
                fontFamily: Font.medium,
                fontSize: 13.5,
                color: '#fff',
                textAlign: 'center',
              }}>
              {toast}
            </Text>
          </MotiView>
        ) : null}
      </SafeAreaView>

      <DownloadDataModal
        visible={downloadModal}
        loading={downloading}
        onClose={() => setDownloadModal(false)}
        onConfirm={handleDownloadConfirm}
      />

      <DeleteAccountModals
        deleteStep={deleteStep}
        deleteInput={deleteInput}
        deleting={deleting}
        onDeleteInput={setDeleteInput}
        onStep1Cancel={() => setDeleteStep(0)}
        onStep1Proceed={() => { setDeleteStep(2); setDeleteInput(''); }}
        onStep2Cancel={() => setDeleteStep(0)}
        onStep2Confirm={handleDeleteConfirm}
      />
    </View>
  );
}
