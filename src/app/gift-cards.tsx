import { useRouter } from 'expo-router';
import { ChevronLeft, Copy, Gift, Send } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyGiftCards, useSendGiftCard } from '@/lib/queries/gift-cards';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

const PRESET_AMOUNTS = [10, 20, 50, 100];

type Tab = 'send' | 'mine';
type SendState = 'form' | 'success';

function copyToClipboard(text: string) {
  try {
    if (Platform.OS === 'web') {
      (navigator as unknown as { clipboard?: { writeText?: (s: string) => void } })
        ?.clipboard?.writeText?.(text);
    }
  } catch { /* unavailable */ }
}

// ─── Send tab ────────────────────────────────────────────────────────────────

function SendTab({ userId }: { userId: string }) {
  const [amount, setAmount] = useState<number>(20);
  const [customAmt, setCustomAmt] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [sendState, setSendState] = useState<SendState>('form');
  const [createdCode, setCreatedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const send = useSendGiftCard(userId);

  const finalAmount = isCustom ? parseFloat(customAmt) || 0 : amount;

  async function handleSend() {
    if (finalAmount < 5) { feedback.warning(); return; }
    feedback.tap();
    try {
      const card = await send.mutateAsync({
        amount: finalAmount,
        recipientEmail: email.trim() || undefined,
        message: msg.trim() || undefined,
      });
      setCreatedCode(card.code);
      setSendState('success');
      feedback.success();
    } catch {
      feedback.error();
    }
  }

  function handleCopy() {
    copyToClipboard(createdCode);
    feedback.success();
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  async function handleShare() {
    feedback.tap();
    await Share.share({
      message: `Here's a Preppa gift card for you! Use code ${createdCode} at checkout to get ${money(finalAmount)} toward home-cooked meals.`,
    });
  }

  if (sendState === 'success') {
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        style={{ alignItems: 'center', padding: 24, gap: 20 }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: Palette.success + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Gift size={34} color={Palette.success} />
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.5 }}>Gift card created!</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>{money(finalAmount)} value</Text>
        </View>

        {/* Code card */}
        <View style={{ width: '100%', backgroundColor: Palette.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, padding: 20, gap: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Gift card code</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 28, color: ORANGE, letterSpacing: 3 }}>{createdCode}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale onPress={handleCopy} accessibilityRole="button" accessibilityLabel="Copy gift card code"
              style={{ flex: 1, height: 40, borderRadius: Radius.md, backgroundColor: codeCopied ? Palette.success + '1A' : Palette.chip, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Copy size={14} color={codeCopied ? Palette.success : Palette.textSecondary} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: codeCopied ? Palette.success : Palette.textSecondary }}>
                {codeCopied ? 'Copied!' : 'Copy code'}
              </Text>
            </PressableScale>
            <PressableScale onPress={() => { void handleShare(); }} accessibilityRole="button" accessibilityLabel="Share gift card code"
              style={{ flex: 1, height: 40, borderRadius: Radius.md, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Send size={14} color="#fff" />
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Share</Text>
            </PressableScale>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
          <PressableScale onPress={() => { setSendState('form'); setCreatedCode(''); setEmail(''); setMsg(''); setIsCustom(false); setAmount(20); setCustomAmt(''); }}
            accessibilityRole="button" accessibilityLabel="Send another gift card"
            style={{ flex: 1, height: 44, borderRadius: Radius.md, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Send another</Text>
          </PressableScale>
          <PressableScale onPress={() => { feedback.tap(); setSendState('form'); }}
            accessibilityRole="button" accessibilityLabel="Done"
            style={{ flex: 1, height: 44, borderRadius: Radius.md, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Done</Text>
          </PressableScale>
        </View>
      </MotiView>
    );
  }

  return (
    <View style={{ padding: 20, gap: 20 }}>
      {/* Amount picker */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Choose an amount</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRESET_AMOUNTS.map((p) => {
            const on = !isCustom && amount === p;
            return (
              <MotiView key={p} animate={{ backgroundColor: on ? ORANGE : Palette.surface, borderColor: on ? ORANGE : Palette.border }} transition={{ type: 'timing', duration: 160 }}
                style={{ flex: 1, borderWidth: 1.5, borderRadius: Radius.md, overflow: 'hidden' }}>
                <TouchableOpacity onPress={() => { feedback.tap(); setIsCustom(false); setAmount(p); setCustomAmt(''); }}
                  accessibilityRole="button" accessibilityLabel={`$${p} gift card`}
                  style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: on ? '#fff' : INK }}>${p}</Text>
                </TouchableOpacity>
              </MotiView>
            );
          })}
        </View>
        {/* Custom amount */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Custom:</Text>
          <TextInput
            value={customAmt}
            onChangeText={(t) => { setCustomAmt(t.replace(/[^0-9.]/g, '')); setIsCustom(true); }}
            onFocus={() => setIsCustom(true)}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            placeholderTextColor={Palette.textSecondary}
            accessibilityLabel="Custom gift card amount"
            style={{ flex: 1, height: 44, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: isCustom ? ORANGE : Palette.border, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }}
          />
        </View>
        {finalAmount < 5 && (isCustom ? !!customAmt : false) ? (
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, paddingHorizontal: 2 }}>Minimum amount is $5</Text>
        ) : null}
      </View>

      {/* Personal message */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Personal message (optional)</Text>
        <TextInput
          value={msg}
          onChangeText={setMsg}
          placeholder="e.g. Happy birthday! Enjoy a home-cooked meal."
          placeholderTextColor={Palette.textSecondary}
          multiline
          maxLength={200}
          accessibilityLabel="Personal message for gift card"
          style={{ minHeight: 80, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top' }}
        />
      </View>

      {/* Recipient email */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Recipient email (optional)</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: -4 }}>Leave blank to share the code yourself</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          placeholderTextColor={Palette.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={200}
          accessibilityLabel="Recipient email"
          style={{ height: 48, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }}
        />
      </View>

      {/* CTA */}
      <PressableScale
        onPress={() => { void handleSend(); }}
        disabled={send.isPending || finalAmount < 5}
        accessibilityRole="button"
        accessibilityLabel={`Send a ${money(finalAmount)} gift card`}
        style={{ height: 56, borderRadius: Radius.lg, backgroundColor: finalAmount >= 5 ? ORANGE : Palette.chip, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, opacity: send.isPending ? 0.6 : 1 }}>
        {send.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
            <Gift size={18} color={finalAmount >= 5 ? '#fff' : Palette.textSecondary} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: finalAmount >= 5 ? '#fff' : Palette.textSecondary }}>
              Send gift card — {money(finalAmount)}
            </Text>
          </>
        }
      </PressableScale>
    </View>
  );
}

// ─── My cards tab ─────────────────────────────────────────────────────────────

function MyCardsTab({ userId }: { userId: string }) {
  const { data: cards, isLoading } = useMyGiftCards(userId);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  if (!cards?.length) {
    return (
      <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Gift size={28} color={Palette.textSecondary} />
        </View>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>No gift cards sent yet</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
          Gift a meal to a friend or family member and it will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 10 }}>
      {cards.map((card) => {
        const isRedeemed = !card.isActive || card.balance === 0;
        const isExpired = !!card.expiresAt && new Date(card.expiresAt) < new Date() && !isRedeemed;
        const statusColor = isExpired ? Palette.danger : isRedeemed ? Palette.textSecondary : Palette.success;
        const statusLabel = isExpired ? 'Expired' : isRedeemed ? 'Redeemed' : `Active · ${money(card.balance)} left`;

        return (
          <MotiView key={card.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}
            style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 8, borderWidth: 1, borderColor: Palette.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.display, fontSize: 18, color: ORANGE, letterSpacing: 1.5 }}>{card.code}</Text>
              <View style={{ backgroundColor: statusColor + '1A', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: statusColor }}>{statusLabel}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Value: {money(card.amount)}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
                {new Date(card.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            {card.recipientEmail ? (
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>To: {card.recipientEmail}</Text>
            ) : null}
            {card.message ? (
              <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, fontStyle: 'italic' }}>"{card.message}"</Text>
            ) : null}
          </MotiView>
        );
      })}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function GiftCardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('send');

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back(); else router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>gift cards</Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 3, marginBottom: 4 }}>
          {(['send', 'mine'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <MotiView key={t} animate={{ backgroundColor: on ? '#fff' : 'transparent' }} transition={{ type: 'timing', duration: 160 }}
                style={{ flex: 1, borderRadius: Radius.md - 2, overflow: 'hidden' }}>
                <TouchableOpacity onPress={() => { feedback.tap(); setTab(t); }}
                  accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t === 'send' ? 'Send a gift card' : 'My sent gift cards'}
                  style={{ height: 38, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: on ? Font.heading : Font.body, fontSize: 14, color: on ? INK : Palette.textSecondary }}>
                    {t === 'send' ? 'Gift a meal' : 'My gift cards'}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            );
          })}
        </View>

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Gift size={28} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to send or view gift cards.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
            {tab === 'send'
              ? <SendTab userId={user.id} />
              : <MyCardsTab userId={user.id} />}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
