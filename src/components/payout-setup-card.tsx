import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, ExternalLink, Wallet } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, AppState, type AppStateStatus, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useStripeConnect } from '@/lib/queries/stripe-connect';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const CARD = Palette.prepperCard;
const MUTED = Palette.textMuted;

export function PayoutSetupCard() {
  const { data, connectAccount, getOnboardingLink, getDashboardLink, syncStatus } = useStripeConnect();

  // Sync Stripe account status when app returns to foreground (user may have
  // completed onboarding in the browser and come back).
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (last.match(/inactive|background/) && next === 'active') {
        void syncStatus.mutateAsync().catch(() => {});
      }
      last = next;
    });
    return () => sub.remove();
  }, []);

  const status = data?.stripe_account_status ?? 'not_connected';
  const isBusy =
    connectAccount.isPending || getOnboardingLink.isPending || getDashboardLink.isPending;

  async function handleSetupPayouts() {
    feedback.tap();
    try {
      let accountId = data?.stripe_account_id;
      if (!accountId) {
        const created = await connectAccount.mutateAsync();
        accountId = created.account_id ?? null;
      }
      if (!accountId) return;
      const { url } = await getOnboardingLink.mutateAsync();
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        // Sync real Stripe status back to DB after user returns from onboarding.
        await syncStatus.mutateAsync().catch(() => {});
      }
    } catch (e) {
      Alert.alert('Setup failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function handleDashboard() {
    feedback.tap();
    try {
      const { url } = await getDashboardLink.mutateAsync();
      if (url) await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert('Could not open dashboard', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  if (status === 'active') {
    return (
      <View style={{ backgroundColor: GREEN + '18', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <BadgeCheck size={18} color={GREEN} />
        <Text style={{ flex: 1, fontFamily: Font.semibold, fontSize: 13.5, color: GREEN }}>Payouts active</Text>
        <PressableScale onPress={handleDashboard} disabled={isBusy} accessibilityRole="button" accessibilityLabel="View payout dashboard"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GREEN + '22', borderRadius: Radius.pill, paddingHorizontal: 13, paddingVertical: 7 }}>
          {isBusy
            ? <ActivityIndicator size="small" color={GREEN} />
            : <><Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: GREEN }}>Dashboard</Text><ExternalLink size={12} color={GREEN} /></>}
        </PressableScale>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Wallet size={17} color={ORANGE} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>Payout setup in progress</Text>
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED, lineHeight: 18 }}>
          Complete your Stripe setup to start receiving direct bank payouts.
        </Text>
        <PressableScale onPress={handleSetupPayouts} disabled={isBusy} accessibilityRole="button" accessibilityLabel="Continue payout setup"
          style={{ alignSelf: 'flex-start', backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 9 }}>
          {isBusy
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Continue setup</Text>}
        </PressableScale>
      </View>
    );
  }

  // 'not_connected' or null
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Wallet size={17} color={ORANGE} />
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>Get paid faster</Text>
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED, lineHeight: 18 }}>
        Connect your bank account to receive automatic payouts directly to your bank. Card processing and platform fees are deducted automatically.
      </Text>
      <PressableScale onPress={handleSetupPayouts} disabled={isBusy} accessibilityRole="button" accessibilityLabel="Set up payouts"
        style={{ alignSelf: 'flex-start', backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 9 }}>
        {isBusy
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Set up payouts</Text>}
      </PressableScale>
    </View>
  );
}
