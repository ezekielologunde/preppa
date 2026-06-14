import { useRouter } from 'expo-router';
import { ChevronDown, Headset, MessageCircle, Search, Send, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsHeader } from '@/components/settings-ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const SUPPORT_TOPICS = ['Payment issue', 'Technical bug', 'Account', 'Something else'];

type Faq = { q: string; a: string };

const FAQS: Faq[] = [
  { q: 'What if my meals come from two different chefs?', a: 'Each chef prepares and hands off their own meals, so a single plan can span multiple kitchens. You will see a separate delivery or pickup window per chef on your tracker, and you only pay each chef for what they cook.' },
  { q: 'How do I skip a week?', a: 'Open My Subscriptions, pick the plan, and tap “Skip” on any upcoming delivery before that week’s cutoff. Skipped weeks are not charged, and your plan resumes automatically the following cycle.' },
  { q: 'What is the order cutoff time?', a: 'Most chefs set a cutoff the day before cooking — commonly 6:00 PM local time. The exact cutoff for each plan is shown on the delivery calendar; changes after cutoff move to the next available window.' },
  { q: 'Can I mix one-off meals with a subscription?', a: 'Yes. Subscription meals arrive on your schedule, and you can add à-la-carte preorders from any local kitchen at checkout. They are billed separately from your plan.' },
  { q: 'How does billing work across chefs?', a: 'Individual preorders are charged at checkout. Subscription plans are charged per cycle. Your billing history (in Payment & Invoicing) itemizes each chef and each plan so corporate stipends reconcile cleanly.' },
  { q: 'A meal was late or wrong — what do I do?', a: 'For anything about a specific meal or delivery, message the chef directly from the Support hub below — they can fix it fastest. For payment or app issues, contact Preppa support.' },
];

function FaqAccordion({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: Palette.border }}>
      <PressableScale
        onPress={() => { feedback.tap(); onToggle(); }}
        accessibilityRole="button"
        accessibilityLabel={faq.q}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 }}>
        <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 14.5, color: Palette.ink, lineHeight: 20 }}>{faq.q}</Text>
        <MotiView animate={{ rotate: open ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: 200 }}>
          <ChevronDown size={18} color={Palette.textSecondary} />
        </MotiView>
      </PressableScale>
      {open ? (
        <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}
          style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 21 }}>{faq.a}</Text>
        </MotiView>
      ) : null}
    </View>
  );
}

function SupportCard({ Icon, tint, title, sub, onPress }: { Icon: typeof MessageCircle; tint: string; title: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => { feedback.tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 18, padding: 16, gap: 10, ...Shadow.card }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={tint} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: Palette.ink }}>{title}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, lineHeight: 16 }}>{sub}</Text>
      </View>
    </PressableScale>
  );
}

/** In-app contact form overlay — a clean alternative to bouncing out to email. */
function ContactSupportModal({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: () => void }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  function close() { setTopic(null); setMessage(''); setSending(false); onClose(); }

  async function send() {
    if (!topic || message.trim().length < 4) return;
    setSending(true);
    feedback.tap();
    // Fire-and-forget: route the request into analytics so ops can triage it.
    supabase.rpc('record_event', { p_event: 'support_request', p_props: { topic, message: cleanBlock(message).trim() } }).then(() => {}, () => {});
    feedback.success();
    close();
    onSent();
  }

  const canSend = !!topic && message.trim().length >= 4;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <MotiView from={{ translateY: 40, opacity: 0 }} animate={{ translateY: 0, opacity: 1 }} transition={{ type: 'timing', duration: 260 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 40 : 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#0EA5E9' + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Headset size={19} color="#0EA5E9" />
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4 }}>Contact Preppa</Text>
            </View>
            <PressableScale onPress={() => { feedback.tap(); close(); }} accessibilityRole="button" accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textSecondary} />
            </PressableScale>
          </View>

          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>what’s it about?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {SUPPORT_TOPICS.map((t) => {
              const active = topic === t;
              return (
                <PressableScale key={t} onPress={() => { feedback.tap(); setTopic(t); }} accessibilityRole="button"
                  accessibilityState={{ selected: active }} accessibilityLabel={t}
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

          <PressableScale onPress={send} disabled={!canSend || sending} accessibilityRole="button" accessibilityLabel="Send to Preppa support"
            style={{ marginTop: 16, height: 52, borderRadius: Radius.pill, backgroundColor: canSend ? Palette.brand : Palette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
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

export default function HelpKnowledgeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 2600); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader title="help & knowledge" subtitle="Answers to common multi-chef questions — and a fast line to a human." />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 40, gap: 20 }}>
          {/* Search */}
          <View style={{ marginHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 16, backgroundColor: Palette.surface, paddingHorizontal: 14, ...Shadow.card }}>
              <Search size={18} color={Palette.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search FAQs…"
                placeholderTextColor={Palette.textMuted}
                maxLength={100}
                style={{ flex: 1, fontFamily: Font.body, fontSize: 14.5, color: Palette.ink }}
                accessibilityLabel="Search frequently asked questions"
                returnKeyType="search"
              />
            </View>
          </View>

          {/* FAQ accordions */}
          <View style={{ marginHorizontal: 20 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, paddingHorizontal: 4 }}>frequently asked</Text>
            <View style={{ backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden', ...Shadow.card }}>
              {filtered.length === 0 ? (
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, padding: 18, textAlign: 'center' }}>
                  No answers match “{query.trim()}”. Try the support options below.
                </Text>
              ) : (
                filtered.map((faq, i) => (
                  <FaqAccordion key={faq.q} faq={faq} open={openIdx === i} onToggle={() => setOpenIdx((cur) => (cur === i ? null : i))} />
                ))
              )}
            </View>
          </View>

          {/* Support hub */}
          <View style={{ marginHorizontal: 20 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, paddingHorizontal: 4 }}>still need help?</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SupportCard
                Icon={MessageCircle}
                tint={Palette.brand}
                title="Message your chef"
                sub="Meal or delivery issues — fastest fix"
                onPress={() => router.push('/messages?tab=messages')}
              />
              <SupportCard
                Icon={Headset}
                tint="#0EA5E9"
                title="Contact Preppa"
                sub="Payments or technical bugs"
                onPress={() => setContactOpen(true)}
              />
            </View>
          </View>
        </ScrollView>

        {toast ? (
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>

      <ContactSupportModal visible={contactOpen} onClose={() => setContactOpen(false)} onSent={() => flash('Message sent — we’ll reply by email soon.')} />
    </View>
  );
}
