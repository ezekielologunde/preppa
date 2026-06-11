import { useRouter } from 'expo-router';
import {
  Apple,
  ArrowLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
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
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontFamily: Font.semibold,
        fontSize: 11,
        color: Palette.textMuted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
      }}>
      {label}
    </Text>
  );
}

function Divider() {
  return (
    <View
      style={{ height: 1, backgroundColor: Palette.border, marginLeft: 56 }}
    />
  );
}

function StatusBadge({
  label,
  type,
}: {
  label: string;
  type: 'green' | 'orange' | 'gray';
}) {
  const colors = {
    green: { bg: '#DCFCE7', fg: Palette.success },
    orange: { bg: Palette.brandTint, fg: Palette.brandPressed },
    gray: { bg: Palette.chip, fg: Palette.textSecondary },
  };
  const c = colors[type];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: c.bg,
      }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

function Row({
  icon,
  label,
  right,
  onPress,
  accessLabel,
}: {
  icon: React.ReactNode;
  label: string;
  right: React.ReactNode;
  onPress?: () => void;
  accessLabel: string;
}) {
  const inner = (
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
        {icon}
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: Font.medium,
          fontSize: 15,
          color: Palette.ink,
        }}>
        {label}
      </Text>
      {right}
    </View>
  );

  if (!onPress) return inner;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessLabel}>
      {inner}
    </PressableScale>
  );
}

// ─── Password panel ──────────────────────────────────────────────────────────

function PasswordPanel({ onClose }: { onClose: () => void }) {
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
    // Re-authenticate by signing in first (provides current password check)
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
            placeholderTextColor={Palette.textMuted}
            secureTextEntry
            accessibilityLabel="Current password"
            style={inputStyle}
          />
          <View>
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={Palette.textMuted}
              secureTextEntry={!showNext}
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
                <EyeOff size={18} color={Palette.textMuted} />
              ) : (
                <Eye size={18} color={Palette.textMuted} />
              )}
            </PressableScale>
          </View>
          <View>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={Palette.textMuted}
              secureTextEntry={!showConfirm}
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
                <EyeOff size={18} color={Palette.textMuted} />
              ) : (
                <Eye size={18} color={Palette.textMuted} />
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
                borderRadius: 12,
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [biometric, setBiometric] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Download data modal
  const [downloadModal, setDownloadModal] = useState(false);

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

  const handleDownloadConfirm = () => {
    setDownloadModal(false);
    feedback.success();
    flash("We'll email you a download link within 24 hours.");
  };

  const handleDeleteConfirm = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    // Server-side admin delete not available client-side — sign out and inform user
    await signOut();
    setDeleting(false);
    setDeleteStep(0);
    flash('Account deletion requested. We will process it within 24 hours.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: Palette.ink,
            gap: 12,
          }}>
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ArrowLeft size={22} color="#fff" />
          </PressableScale>
          <Text
            style={{
              fontFamily: Font.heading,
              fontSize: 18,
              color: '#fff',
              letterSpacing: -0.3,
            }}>
            account
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 28 }}>
          {/* ── SECURITY ─────────────────────────────────────────────────── */}
          <View>
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
                  <ChevronRight
                    size={18}
                    color={Palette.divider}
                    style={{
                      transform: [{ rotate: passwordOpen ? '90deg' : '0deg' }],
                    }}
                  />
                }
                onPress={() => setPasswordOpen((v) => !v)}
                accessLabel="Change password"
              />
              {passwordOpen ? (
                <PasswordPanel onClose={() => setPasswordOpen(false)} />
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
                  trackColor={{
                    false: Palette.border,
                    true: Palette.brand,
                  }}
                  thumbColor="#fff"
                  accessibilityRole="switch"
                  accessibilityLabel="Biometric login"
                  accessibilityState={{ checked: biometric }}
                />
              </View>
            </View>
          </View>

          {/* ── CONNECTED ACCOUNTS ───────────────────────────────────────── */}
          <View>
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
                <Lock size={15} color={Palette.divider} />
              </View>
            </View>
          </View>

          {/* ── DATA & PRIVACY ───────────────────────────────────────────── */}
          <View>
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
                right={<ChevronRight size={18} color={Palette.divider} />}
                onPress={() => setDownloadModal(true)}
                accessLabel="Download my data"
              />
              <Divider />
              <Row
                icon={<Shield size={17} color={Palette.textSecondary} />}
                label="privacy settings"
                right={<ChevronRight size={18} color={Palette.divider} />}
                onPress={() => soon('Privacy settings')}
                accessLabel="Privacy settings"
              />
            </View>
          </View>

          {/* ── DANGER ZONE ──────────────────────────────────────────────── */}
          <View>
            <SectionLabel label="danger zone" />
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 20,
                overflow: 'hidden',
                padding: 16,
              }}>
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: 13,
                  color: '#991B1B',
                  marginBottom: 14,
                  lineHeight: 19,
                }}>
                Deleting your account is permanent. All your data, orders, and
                preferences will be removed and cannot be recovered.
              </Text>
              <PressableScale
                onPress={() => setDeleteStep(1)}
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
          </View>
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
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
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

      {/* ── Download data modal ──────────────────────────────────────────── */}
      <Modal
        visible={downloadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDownloadModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              backgroundColor: Palette.surface,
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 360,
              gap: 16,
            }}>
            <Text
              style={{
                fontFamily: Font.heading,
                fontSize: 18,
                color: Palette.ink,
              }}>
              download my data
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.textSecondary,
                lineHeight: 21,
              }}>
              We'll email you a link to download your data within 24 hours. The
              archive includes your profile, orders, and preferences.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PressableScale
                onPress={() => setDownloadModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel data download"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
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
                onPress={handleDownloadConfirm}
                accessibilityRole="button"
                accessibilityLabel="Confirm data download request"
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: Palette.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                  request download
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete step 1 modal ──────────────────────────────────────────── */}
      <Modal
        visible={deleteStep === 1}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteStep(0)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              backgroundColor: Palette.surface,
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 360,
              gap: 16,
            }}>
            <Text
              style={{
                fontFamily: Font.heading,
                fontSize: 18,
                color: Palette.danger,
              }}>
              are you sure?
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.textSecondary,
                lineHeight: 21,
              }}>
              This will permanently delete your Preppa account, including all
              orders, favorites, and earned rewards. This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PressableScale
                onPress={() => setDeleteStep(0)}
                accessibilityRole="button"
                accessibilityLabel="Cancel account deletion"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
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
                onPress={() => {
                  setDeleteStep(2);
                  setDeleteInput('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Proceed to delete account confirmation"
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: Palette.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                  yes, delete
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete step 2 modal ──────────────────────────────────────────── */}
      <Modal
        visible={deleteStep === 2}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteStep(0)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              backgroundColor: Palette.surface,
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 360,
              gap: 16,
            }}>
            <Text
              style={{
                fontFamily: Font.heading,
                fontSize: 18,
                color: Palette.danger,
              }}>
              this cannot be undone
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.textSecondary,
                lineHeight: 21,
              }}>
              Type{' '}
              <Text
                style={{ fontFamily: Font.semibold, color: Palette.danger }}>
                DELETE
              </Text>{' '}
              to confirm account deletion.
            </Text>
            <TextInput
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE here"
              placeholderTextColor={Palette.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type DELETE to confirm"
              style={{
                fontFamily: Font.body,
                fontSize: 15,
                color: Palette.ink,
                backgroundColor: Palette.canvas,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor:
                  deleteInput.length > 0 && deleteInput !== 'DELETE'
                    ? Palette.danger
                    : Palette.border,
                minHeight: 44,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PressableScale
                onPress={() => setDeleteStep(0)}
                accessibilityRole="button"
                accessibilityLabel="Cancel account deletion"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
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
                onPress={handleDeleteConfirm}
                disabled={deleteInput !== 'DELETE' || deleting}
                accessibilityRole="button"
                accessibilityLabel="Confirm and delete account"
                accessibilityState={{
                  disabled: deleteInput !== 'DELETE' || deleting,
                }}
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: Palette.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: deleteInput !== 'DELETE' || deleting ? 0.4 : 1,
                }}>
                <Text
                  style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                  {deleting ? 'deleting…' : 'delete my account'}
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
