import { Bell, BellOff, MessageCircle, Megaphone, ShoppingBag, Star, Users, Utensils, Video } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsHeader } from '@/components/settings-ui';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useNotifPrefs, useUpdateNotifPrefs, type NotifPrefs } from '@/lib/queries/notification-prefs';
import { useAuth } from '@/providers/auth-provider';

// ─── Sub-components ──────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 70 }} />;
}

type PrefRowProps = {
  Icon: typeof Bell;
  label: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  isLast?: boolean;
};

function PrefRow({ Icon, label, sub, value, onToggle, disabled = false, isLast = false }: PrefRowProps) {
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          minHeight: 60,
          opacity: disabled ? 0.45 : 1,
        }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={Palette.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{label}</Text>
          <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 2, lineHeight: 16 }}>{sub}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={() => {
            if (!disabled) { feedback.tap(); onToggle(); }
          }}
          trackColor={{ false: Palette.border, true: Palette.brand + '80' }}
          thumbColor={value ? Palette.brand : '#f4f4f4'}
          ios_backgroundColor={Palette.border}
          disabled={disabled}
          accessibilityLabel={sub ? `${label}. ${sub}` : label}
          accessibilityRole="switch"
          accessibilityState={{ checked: value, disabled }}
        />
      </View>
      {!isLast ? <Divider /> : null}
    </>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NotificationPreferencesScreen() {
  const { user } = useAuth();
  const { data: prefs, isLoading } = useNotifPrefs(user?.id);
  const update = useUpdateNotifPrefs(user?.id);

  // Local optimistic state mirrors server prefs while mutation is in flight
  const [local, setLocal] = useState<Partial<NotifPrefs>>({});

  function current(key: keyof NotifPrefs): boolean {
    if (key in local) return local[key] as boolean;
    if (prefs) return prefs[key];
    // defaults
    return key !== 'prepper_news';
  }

  function toggle(key: keyof NotifPrefs) {
    const next = !current(key);
    setLocal((prev) => ({ ...prev, [key]: next }));
    update.mutate(
      { [key]: next },
      {
        onSettled: () => {
          // Clear local override once server responds — useNotifPrefs cache is revalidated
          setLocal((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
        },
      },
    );
  }

  const pushOn = current('push_enabled');
  const catDisabled = isLoading || !pushOn;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader
          title="notifications"
          subtitle="Choose what Preppa sends to your device."
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: 48,
            gap: 20,
            ...(Platform.OS === 'web' ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' } : {}),
          }}>

          {/* Master push toggle */}
          <SettingsGroup title="push notifications" delay={0}>
            <PrefRow
              Icon={pushOn ? Bell : BellOff}
              label="Push notifications"
              sub="Enable or disable all push notifications from Preppa"
              value={pushOn}
              onToggle={() => toggle('push_enabled')}
              disabled={isLoading}
              isLast
            />
          </SettingsGroup>

          {/* Orders */}
          <SettingsGroup title="orders" delay={60}>
            <PrefRow
              Icon={ShoppingBag}
              label="Order updates"
              sub="Status changes, confirmations, delivery alerts"
              value={current('order_updates')}
              onToggle={() => toggle('order_updates')}
              disabled={catDisabled}
            />
            <PrefRow
              Icon={Utensils}
              label="Bid & custom meal updates"
              sub="Responses to your custom meal requests"
              value={current('bid_updates')}
              onToggle={() => toggle('bid_updates')}
              disabled={catDisabled}
              isLast
            />
          </SettingsGroup>

          {/* Activity */}
          <SettingsGroup title="activity" delay={120}>
            <PrefRow
              Icon={Users}
              label="New followers"
              sub="When someone starts following your kitchen"
              value={current('new_followers')}
              onToggle={() => toggle('new_followers')}
              disabled={catDisabled}
              isLast
            />
          </SettingsGroup>

          {/* Discover */}
          <SettingsGroup title="discover" delay={180}>
            <PrefRow
              Icon={Video}
              label="Meal drops from followed kitchens"
              sub="When a kitchen you follow adds a new meal"
              value={current('meal_drops')}
              onToggle={() => toggle('meal_drops')}
              disabled={catDisabled}
            />
            <PrefRow
              Icon={MessageCircle}
              label="Preppa news & tips"
              sub="Platform updates, cooking tips, new features"
              value={current('prepper_news')}
              onToggle={() => toggle('prepper_news')}
              disabled={catDisabled}
              isLast
            />
          </SettingsGroup>

          {/* Promotions */}
          <SettingsGroup title="promotions" delay={240}>
            <PrefRow
              Icon={Megaphone}
              label="Promotions & offers"
              sub="Deals, gift cards, referral bonuses"
              value={current('promotions')}
              onToggle={() => toggle('promotions')}
              disabled={catDisabled}
              isLast
            />
          </SettingsGroup>

          {/* Warning box when order_updates is disabled */}
          {!current('order_updates') && pushOn && !isLoading ? (
            <MotiView
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220 }}
              style={{ marginHorizontal: 20 }}>
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Star size={15} color="#92400E" style={{ marginTop: 1 }} />
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#92400E', lineHeight: 19, flex: 1 }}>
                  Disabling "Order updates" means you won't receive real-time delivery status notifications.
                </Text>
              </View>
            </MotiView>
          ) : null}

          {/* Footer note */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300, delay: 300 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 28 }}>
              Payment receipts are always sent regardless of these settings. To fully silence alerts, also use your device's system notification settings.
            </Text>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
