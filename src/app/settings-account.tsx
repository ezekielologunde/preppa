import { useRouter } from 'expo-router';
import { CreditCard, Leaf, MapPin, User } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsHeader, SettingsRow } from '@/components/settings-ui';
import { Palette } from '@/constants/theme';
import { useAddresses } from '@/lib/queries/addresses';
import { usePaymentMethods } from '@/lib/queries/payment-methods';
import { useAuth } from '@/providers/auth-provider';

export default function PersonalizationLogisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: addresses } = useAddresses(user?.id);
  const { data: pm } = usePaymentMethods();

  const addrCount = addresses?.length ?? 0;
  const defaultCard = pm?.methods.find((m) => m.isDefault);
  const email = user?.email ?? 'not set';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader title="personalization & logistics" subtitle="The essentials that keep your meals arriving smoothly." />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40, gap: 20 }}>
          <SettingsGroup title="your details" delay={0}>
            <SettingsRow
              Icon={User}
              label="Profile information"
              sub={`Name, ${email}, and verified phone`}
              onPress={() => router.push('/edit-profile')}
            />
            <SettingsRow
              Icon={Leaf}
              label="Dietary & Allergen Profile"
              sub="Controls your curated 'Recommended for You' engine"
              onPress={() => router.push('/dietary-preferences')}
            />
            <SettingsRow
              Icon={MapPin}
              label="Saved delivery addresses"
              sub={addrCount === 0 ? 'Add a home or work drop-off with courier notes' : `${addrCount} saved · home & work drop-offs`}
              onPress={() => router.push('/addresses')}
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="billing" delay={60}>
            <SettingsRow
              Icon={CreditCard}
              label="Payment & invoicing"
              sub={defaultCard ? `${defaultCard.brand} ···· ${defaultCard.last4} · cards, stipends & history` : 'Cards, corporate stipends, and billing history'}
              onPress={() => router.push('/payment-methods')}
              isLast
            />
          </SettingsGroup>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
