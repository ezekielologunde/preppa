import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink, marginBottom: 6 }}>
        {title}
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.inkSoft, lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: Palette.border,
          backgroundColor: Palette.canvas,
        }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginRight: 12 }}>
            <ChevronLeft size={24} color={Palette.ink} />
          </Pressable>
          <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink }}>
            Privacy Policy
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}>

          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, marginBottom: 24 }}>
            Last updated: June 18, 2026
          </Text>

          <Section title="What Data We Collect">
            When you use Preppa we collect: your name, email address, and profile photo when you register; your delivery addresses and location data used to show nearby Preppers and estimate delivery; payment information processed and stored securely by Stripe (we never see your full card number); your order history including items ordered, Preppers you've ordered from, and order timestamps; messages exchanged with Preppers through our in-app chat; device identifiers and app usage data for analytics and crash reporting; and photos or reviews you voluntarily submit.
          </Section>

          <Section title="How We Use Your Data">
            We use your data to fulfil your orders and coordinate with Preppers; send order confirmations, receipts, and status updates via email (powered by Resend); respond to customer support requests; detect and prevent fraud and abuse; improve the platform through anonymised usage analytics; personalise your experience such as recommending Preppers near you; and send you promotional offers if you have opted in (you can opt out at any time in Settings → Notifications).
          </Section>

          <Section title="Third Parties We Share Data With">
            We share your data only with service providers who help us operate Preppa: Stripe for payment processing, Supabase for database and authentication infrastructure, Expo for app delivery and push notifications, and Resend for transactional email. None of these partners sell your personal data. We do not sell, rent, or trade your personal information to any third party for marketing purposes. We may disclose data if required by law or to protect the safety of our users.
          </Section>

          <Section title="Data Retention">
            We retain your account data, order history, and associated records for as long as your account remains active. If you request account deletion, your personal information is removed from our active systems within 30 days, subject to legal retention obligations (e.g. financial records may be retained for up to 7 years as required by law). You can export a copy of your data at any time using the export_my_data feature in Settings → Privacy, or by emailing privacy@preppa.live.
          </Section>

          <Section title="Your Rights">
            You have the right to access, correct, or delete the personal data we hold about you. You can update your name, email, and address directly in the app (Settings → Profile). To request a full data export or account deletion, go to Settings → Privacy or contact privacy@preppa.live. We will respond to all verified requests within 30 days. If you are located in the EU or UK, you may also have the right to lodge a complaint with your local data protection authority.
          </Section>

          <Section title="Cookies and Tracking">
            The Preppa mobile app does not use browser cookies. On the web version we use essential cookies required for authentication sessions. We use anonymous, aggregated analytics to understand how users navigate the app — this data cannot be used to identify you individually. We do not use cross-site tracking or sell advertising based on your behaviour.
          </Section>

          <Section title="Children's Privacy">
            Preppa is not intended for use by anyone under the age of 13. We do not knowingly collect personal data from children under 13. If we become aware that a child under 13 has provided us with personal information, we will delete it promptly. If you believe a child has created an account, please contact privacy@preppa.live.
          </Section>

          <Section title="Security">
            We take reasonable technical and organisational measures to protect your data, including encrypted connections (TLS), row-level security enforced at the database layer, and access controls limiting which team members can view user data. No system is completely secure, so we encourage you to use a strong, unique password and enable any available two-factor authentication options.
          </Section>

          <Section title="Changes to This Policy">
            We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date above and, for material changes, notify you via in-app message or email. Continued use of Preppa after changes are posted means you accept the updated policy.
          </Section>

          <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.sm, padding: 16, marginTop: 8 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.brandPressed }}>
              Privacy questions or requests?
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.inkSoft, marginTop: 4 }}>
              Email privacy@preppa.live — we respond to all verified requests within 30 days.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
