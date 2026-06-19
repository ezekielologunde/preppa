import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useNotifPrefs, useUpdateNotifPrefs, usePushToken, type NotifPrefs } from '@/lib/queries/notification-prefs';
import { useAuth } from '@/providers/auth-provider';

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontFamily: Font.semibold,
        fontSize: 12,
        color: Palette.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 4,
      }}>
      {title}
    </Text>
  );
}

type PrefRowProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
};

function PrefRow({ label, value, onChange, disabled = false, isLast = false }: PrefRowProps) {
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 16,
        }}>
        <Text
          style={{
            fontFamily: Font.body,
            fontSize: 15,
            color: disabled ? Palette.textMuted : Palette.ink,
            flex: 1,
            marginRight: 12,
          }}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={(v) => {
            feedback.tap();
            onChange(v);
          }}
          trackColor={{ false: Palette.border, true: Palette.brand + '60' }}
          thumbColor={value ? Palette.brand : '#f4f3f4'}
          ios_backgroundColor={Palette.border}
          disabled={disabled}
          accessibilityLabel={label}
          accessibilityRole="switch"
          accessibilityState={{ checked: value, disabled }}
        />
      </View>
      {!isLast ? <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: 16 }} /> : null}
    </>
  );
}

type SectionCardProps = { children: React.ReactNode; delay?: number };

function SectionCard({ children, delay = 0 }: SectionCardProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay }}>
      <View
        style={{
          backgroundColor: Palette.surface,
          borderRadius: 16,
          overflow: 'hidden',
          marginHorizontal: 16,
        }}>
        {children}
      </View>
    </MotiView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prefs, isLoading } = useNotifPrefs(user?.id);
  const updatePrefs = useUpdateNotifPrefs(user?.id);
  const { data: pushToken } = usePushToken(user?.id);

  function toggle(key: keyof NotifPrefs) {
    if (!prefs) return;
    updatePrefs.mutate({ [key]: !prefs[key] });
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); }
  }

  const pushOn = prefs?.push_enabled ?? true;
  // All category toggles are disabled when push master is off or prefs are loading
  const catDisabled = isLoading || !pushOn;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
          }}>
          <PressableScale
            onPress={goBack}
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
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6 }}>
              notifications
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>
              Choose what Preppa sends to your device
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Push master toggle */}
          <SectionLabel title="Push notifications" />
          <SectionCard delay={0}>
            <PrefRow
              label="Push notifications"
              value={prefs?.push_enabled ?? true}
              onChange={() => toggle('push_enabled')}
              disabled={isLoading}
              isLast
            />
          </SectionCard>

          {/* Order & delivery */}
          <SectionLabel title="Order & delivery" />
          <SectionCard delay={60}>
            <PrefRow
              label="Order status updates"
              value={prefs?.order_updates ?? true}
              onChange={() => toggle('order_updates')}
              disabled={catDisabled}
            />
            <PrefRow
              label="Bid & custom meal updates"
              value={prefs?.bid_updates ?? true}
              onChange={() => toggle('bid_updates')}
              disabled={catDisabled}
              isLast
            />
          </SectionCard>

          {/* Social */}
          <SectionLabel title="Social" />
          <SectionCard delay={120}>
            <PrefRow
              label="New followers"
              value={prefs?.new_followers ?? true}
              onChange={() => toggle('new_followers')}
              disabled={catDisabled}
            />
            <PrefRow
              label="Meal drops from kitchens you follow"
              value={prefs?.meal_drops ?? true}
              onChange={() => toggle('meal_drops')}
              disabled={catDisabled}
              isLast
            />
          </SectionCard>

          {/* Marketing */}
          <SectionLabel title="Marketing" />
          <SectionCard delay={180}>
            <PrefRow
              label="Promotions & discounts"
              value={prefs?.promotions ?? true}
              onChange={() => toggle('promotions')}
              disabled={catDisabled}
            />
            <PrefRow
              label="Preppa news & tips"
              value={prefs?.prepper_news ?? false}
              onChange={() => toggle('prepper_news')}
              disabled={catDisabled}
              isLast
            />
          </SectionCard>

          {/* Footer note */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300, delay: 240 }}>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 12,
                color: Palette.textMuted,
                textAlign: 'center',
                lineHeight: 18,
                paddingHorizontal: 28,
                marginTop: 20,
              }}>
              Payment receipts are always sent regardless of these settings. To fully silence
              alerts, also use your device&apos;s system notification settings.
            </Text>
          </MotiView>

          {__DEV__ && (
            <Text style={{ fontSize: 10, color: Palette.textMuted, textAlign: 'center', marginTop: 8 }}>
              {pushToken ? `token: ${pushToken.slice(-8)}` : 'no token registered'}
            </Text>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
