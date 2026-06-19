import { useRouter } from 'expo-router';
import { ChevronRight, Headset, MessageCircle, Search, Send, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsHeader } from '@/components/settings-ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type FaqItem = { q: string; a: string };

// ─── FAQ Data ────────────────────────────────────────────────────────────────

const FAQS: Record<string, FaqItem[]> = {
  'Getting started': [
    {
      q: 'How do I place my first order?',
      a: "Browse kitchens on the Explore tab, tap a meal you like, and tap \"Add to cart\". When you're ready, go to your cart and tap \"Place order\".",
    },
    {
      q: 'How does pickup/delivery work?',
      a: "Each kitchen sets their own fulfillment method — some offer pickup only, others offer delivery within a certain radius. Check the kitchen page for details.",
    },
    {
      q: 'How do I find kitchens near me?',
      a: "Tap Explore, then use the filter to sort by \"Nearest\". Make sure you've allowed location permissions for the best experience.",
    },
    {
      q: 'Can I customize my meal?',
      a: 'Yes! Add a note to your order in the cart before checkout. The prepper will see your request.',
    },
  ],
  'Orders & payments': [
    {
      q: 'What payment methods are accepted?',
      a: 'We accept cards (Visa, Mastercard), bank transfers, and Preppa gift cards. Promo codes can also be applied at checkout.',
    },
    {
      q: 'How do I apply a promo code?',
      a: 'In your cart, tap the "Promo code" field, enter your code, and tap Apply. The discount will be shown before you pay.',
    },
    {
      q: 'Can I cancel or change my order?',
      a: "You can cancel within 5 minutes of placing an order if the kitchen hasn't confirmed yet. After confirmation, please message the kitchen directly.",
    },
    {
      q: 'I was charged incorrectly',
      a: "Please contact our support team with your order ID. We'll investigate and issue a refund within 3 business days if applicable.",
    },
  ],
  'For preppers': [
    {
      q: 'How do I become a prepper?',
      a: "Tap \"Become a prepper\" in your profile. Complete the application including your food handler certification, and we'll review within 48 hours.",
    },
    {
      q: 'When do I get paid?',
      a: 'Request a payout from the Payouts section in your prepper hub. Payments are processed within 3–5 business days to your bank account.',
    },
    {
      q: 'What are the platform fees?',
      a: 'Preppa takes a 15% commission on completed orders. This covers payment processing, customer support, and marketing. You keep 85%.',
    },
    {
      q: 'How do I handle cancellations?',
      a: 'If you need to decline an order, do so quickly via the Decline button. Frequent cancellations may affect your visibility on the platform.',
    },
  ],
  'Account & safety': [
    {
      q: 'How do I report a problem?',
      a: 'On any order, tap "Report an issue" from the order detail screen. Our team reviews all reports within 24 hours.',
    },
    {
      q: 'How do I delete my account?',
      a: 'Go to Settings → App Preferences → Delete my account. Note: this action is permanent and cannot be undone.',
    },
    {
      q: 'Is my payment info secure?',
      a: 'Yes. We use Stripe for payment processing — Preppa never stores your card details. All data is encrypted in transit and at rest.',
    },
  ],
};

const SUPPORT_TOPICS = ['Payment issue', 'Technical bug', 'Account', 'Something else'];

const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

// ─── Accordion row ────────────────────────────────────────────────────────────

function AccordionRow({ faq, open, onToggle }: { faq: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: Palette.border }}>
      <PressableScale
        onPress={() => { feedback.tap(); onToggle(); }}
        accessibilityRole="button"
        accessibilityLabel={faq.q}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 }}>
        <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 14, color: Palette.ink, lineHeight: 20 }}>{faq.q}</Text>
        <MotiView
          animate={{ rotate: open ? '90deg' : '0deg' }}
          transition={{ type: 'timing', duration: 200 }}>
          <ChevronRight size={17} color={Palette.textSecondary} />
        </MotiView>
      </PressableScale>
      {open ? (
        <MotiView
          from={{ opacity: 0, translateY: -4 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 220 }}
          style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>{faq.a}</Text>
        </MotiView>
      ) : null}
    </View>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

type OpenKey = `${string}:${number}`;

function FaqSection({
  title,
  items,
  openKey,
  setOpenKey,
  delay,
}: {
  title: string;
  items: FaqItem[];
  openKey: OpenKey | null;
  setOpenKey: (k: OpenKey | null) => void;
  delay: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280, delay }}
      style={{ marginHorizontal: 20 }}>
      <Text style={{
        fontFamily: Font.semibold,
        fontSize: 11.5,
        color: Palette.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}>
        {title}
      </Text>
      <View style={{ backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden', ...Shadow.card }}>
        {items.map((faq, i) => {
          const key: OpenKey = `${title}:${i}`;
          return (
            <AccordionRow
              key={faq.q}
              faq={faq}
              open={openKey === key}
              onToggle={() => setOpenKey(openKey === key ? null : key)}
            />
          );
        })}
      </View>
    </MotiView>
  );
}

// ─── Search results (flat list) ───────────────────────────────────────────────

type FlatResult = FaqItem & { section: string };

function SearchResults({
  results,
  openKey,
  setOpenKey,
}: {
  results: FlatResult[];
  openKey: OpenKey | null;
  setOpenKey: (k: OpenKey | null) => void;
}) {
  if (results.length === 0) {
    return (
      <View style={{ marginHorizontal: 20 }}>
        <View style={{ backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden', ...Shadow.card }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, padding: 20, textAlign: 'center' }}>
            No results found. Try the contact options below.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginHorizontal: 20 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, paddingHorizontal: 4 }}>
        results
      </Text>
      <View style={{ backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden', ...Shadow.card }}>
        {results.map((faq, i) => {
          const key: OpenKey = `search:${i}`;
          return (
            <AccordionRow
              key={faq.q}
              faq={faq}
              open={openKey === key}
              onToggle={() => setOpenKey(openKey === key ? null : key)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Contact support modal ────────────────────────────────────────────────────

function ContactSupportModal({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: () => void }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  function close() { setTopic(null); setMessage(''); setSending(false); setSendErr(null); onClose(); }

  async function send() {
    if (!topic || message.trim().length < 4) return;
    setSending(true);
    setSendErr(null);
    feedback.tap();
    try {
      await supabase.rpc('record_event', { p_event: 'support_request', p_props: { topic, message: cleanBlock(message).trim() } });
      feedback.success();
      close();
      onSent();
    } catch {
      feedback.error();
      setSending(false);
      setSendErr('Could not send message. Please try again.');
    }
  }

  const canSend = !!topic && message.trim().length >= 4;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <MotiView
          from={{ translateY: 40, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'timing', duration: 260 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 40 : 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#0EA5E9' + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Headset size={19} color="#0EA5E9" />
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4 }}>Contact Preppa</Text>
            </View>
            <PressableScale
              onPress={() => { feedback.tap(); close(); }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textSecondary} />
            </PressableScale>
          </View>

          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            what's it about?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {SUPPORT_TOPICS.map((t) => {
              const active = topic === t;
              return (
                <PressableScale
                  key={t}
                  onPress={() => { feedback.tap(); setTopic(t); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t}
                  style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.pill, backgroundColor: active ? Palette.brandTint : Palette.canvas, borderWidth: 1.5, borderColor: active ? Palette.brand : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? Palette.brand : Palette.inkSoft }}>{t}</Text>
                </PressableScale>
              );
            })}
          </View>

          <TextInput
            value={message}
            onChangeText={(t) => setMessage(cleanBlock(t))}
            placeholder="Tell us what happened…"
            placeholderTextColor={Palette.textMuted}
            multiline
            maxLength={600}
            textAlignVertical="top"
            style={{ minHeight: 96, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.canvas, padding: 12, fontFamily: Font.body, fontSize: 14, color: Palette.ink }}
            accessibilityLabel="Describe your issue"
          />

          {sendErr ? (
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, textAlign: 'center', marginTop: 8 }}>{sendErr}</Text>
          ) : null}
          <PressableScale
            onPress={send}
            disabled={!canSend || sending}
            accessibilityRole="button"
            accessibilityLabel="Send to Preppa support"
            style={{ marginTop: 8, height: 52, borderRadius: Radius.pill, backgroundColor: canSend ? Palette.brand : Palette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Send size={17} color={canSend ? '#fff' : Palette.textMuted} />
            <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: canSend ? '#fff' : Palette.textMuted }}>Send message</Text>
          </PressableScale>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', marginTop: 10 }}>
            We typically reply by email within one business day.
          </Text>
        </MotiView>
      </View>
    </Modal>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({ Icon, tint, label, sub, onPress }: { Icon: typeof MessageCircle; tint: string; label: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => { feedback.tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 18, padding: 16, gap: 10, ...Shadow.card }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={tint} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{label}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, lineHeight: 16 }}>{sub}</Text>
      </View>
    </PressableScale>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<OpenKey | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 2600);
  };

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length >= 2;

  const searchResults = useMemo<FlatResult[]>(() => {
    if (!isSearching) return [];
    const results: FlatResult[] = [];
    for (const [section, items] of Object.entries(FAQS)) {
      for (const item of items) {
        if (item.q.toLowerCase().includes(trimmedQuery) || item.a.toLowerCase().includes(trimmedQuery)) {
          results.push({ ...item, section });
        }
      }
    }
    return results;
  }, [trimmedQuery, isSearching]);

  const sections = Object.entries(FAQS);
  const sectionDelays = [0, 60, 120, 180];

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader title="help & support" subtitle="Browse answers or reach a human in seconds." />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 48, gap: 20 }}>

          {/* Search bar */}
          <MotiView
            from={{ opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 240 }}
            style={{ marginHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 16, backgroundColor: Palette.surface, paddingHorizontal: 14, ...Shadow.card }}>
              <Search size={18} color={Palette.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="What can we help with?"
                placeholderTextColor={Palette.textMuted}
                maxLength={100}
                returnKeyType="search"
                style={{ flex: 1, fontFamily: Font.body, fontSize: 14.5, color: Palette.ink }}
                accessibilityLabel="Search help articles"
              />
              {query.length > 0 ? (
                <PressableScale onPress={() => { feedback.tap(); setQuery(''); }} accessibilityRole="button" accessibilityLabel="Clear search">
                  <X size={16} color={Palette.textMuted} />
                </PressableScale>
              ) : null}
            </View>
          </MotiView>

          {/* Search results OR categorised sections */}
          {isSearching ? (
            <SearchResults results={searchResults} openKey={openKey} setOpenKey={setOpenKey} />
          ) : (
            sections.map(([title, items], idx) => (
              <FaqSection
                key={title}
                title={title}
                items={items}
                openKey={openKey}
                setOpenKey={setOpenKey}
                delay={sectionDelays[idx] ?? 0}
              />
            ))
          )}

          {/* Contact options */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280, delay: 240 }}
            style={{ marginHorizontal: 20, gap: 10 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 4 }}>
              still need help?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <ContactRow
                Icon={Headset}
                tint={Palette.brand}
                label="Chat with support"
                sub="Payments, bugs & account issues"
                onPress={() => setContactOpen(true)}
              />
              <ContactRow
                Icon={MessageCircle}
                tint="#0EA5E9"
                label="Email us"
                sub="support@preppa.app"
                onPress={() => { void Linking.openURL('mailto:support@preppa.app'); }}
              />
            </View>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/messages?tab=messages' as never); }}
              accessibilityRole="button"
              accessibilityLabel="Message your chef directly"
              style={{ height: 48, borderRadius: 14, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...Shadow.card }}>
              <MessageCircle size={16} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.inkSoft }}>Message your kitchen directly</Text>
            </PressableScale>
          </MotiView>
        </ScrollView>

        {toast ? (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>

      <ContactSupportModal
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        onSent={() => flash("Message sent — we'll reply by email soon.")}
      />
    </View>
  );
}
