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

export default function TermsScreen() {
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
            Terms of Service
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}>

          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, marginBottom: 24 }}>
            Last updated: June 18, 2026
          </Text>

          <Section title="About Preppa">
            Preppa is a local meal-prep marketplace that connects customers with independent home cooks and meal-prep professionals ("Preppers"). We provide the platform, payment processing, and communications infrastructure; we are not a party to the transaction between you and any Prepper.
          </Section>

          <Section title="Eligibility">
            You must be at least 18 years old to create an account or place an order on Preppa. By registering, you confirm that you are 18 or older and that all information you provide is accurate, complete, and up to date. You are responsible for maintaining the confidentiality of your account credentials.
          </Section>

          <Section title="Ordering">
            When you place an order through Preppa you are entering into a binding commitment directly with the Prepper who fulfills that order. Preppa facilitates the transaction but is not a party to it. Orders are confirmed once the Prepper accepts. If a Prepper declines or cannot fulfill your order you will receive a full refund to your original payment method.
          </Section>

          <Section title="Payments">
            All payments are processed securely by Stripe, Inc. By placing an order you authorise Stripe to charge your selected payment method for the order total, which includes the Prepper's price and a Preppa platform service fee. Preppa does not store your full card details. In the event of a failed charge, your order will not be confirmed until payment succeeds.
          </Section>

          <Section title="Cancellations and Refunds">
            Preppers set their own pickup or delivery windows at the time of listing. Cancellations requested before a Prepper begins preparation may be eligible for a full refund. Cancellations after preparation has started, or no-shows, are subject to Preppa's discretion and may result in a partial or no refund. Refund decisions are final. If you have a dispute, contact support@preppa.live within 48 hours of your scheduled pickup or delivery.
          </Section>

          <Section title="Prepper Conduct">
            Preppers agree to comply with all applicable food safety laws and local health regulations, provide accurate and truthful meal descriptions (including allergen information), fulfill confirmed orders on time, and maintain a professional and respectful relationship with customers. Preppa reserves the right to remove any Prepper who violates these standards or receives sustained negative feedback.
          </Section>

          <Section title="Prohibited Activities">
            You may not use Preppa to: commit fraud or impersonate another person; post false, misleading, or fake listings; harass, threaten, or abuse other users or Preppers; circumvent the platform by arranging off-platform payments; scrape, reverse-engineer, or interfere with Preppa's systems; or violate any applicable law or regulation.
          </Section>

          <Section title="Intellectual Property">
            By submitting photos, reviews, or other content to Preppa you grant us a worldwide, non-exclusive, royalty-free licence to use, display, and distribute that content in connection with operating and promoting the Preppa platform. You retain ownership of your content. We will not sell your content to third parties.
          </Section>

          <Section title="Limitation of Liability">
            To the maximum extent permitted by law, Preppa's total liability to you for any claim arising out of or related to these Terms or the platform is limited to the amount you paid for the order giving rise to the claim. Preppa is not liable for any indirect, incidental, consequential, or punitive damages. We do not warrant that the platform will be uninterrupted or error-free.
          </Section>

          <Section title="Governing Law">
            These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles. Any disputes arising under these Terms that cannot be resolved informally will be subject to binding arbitration in Delaware, except that either party may seek injunctive relief in a court of competent jurisdiction.
          </Section>

          <Section title="Changes to These Terms">
            We may update these Terms from time to time. When we do, we will revise the "Last updated" date at the top of this page and notify you via the app or email. Continued use of Preppa after changes are posted constitutes your acceptance of the revised Terms.
          </Section>

          <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.sm, padding: 16, marginTop: 8 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.brandPressed }}>
              Questions about these Terms?
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.inkSoft, marginTop: 4 }}>
              Email us at support@preppa.live and we'll get back to you within one business day.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
