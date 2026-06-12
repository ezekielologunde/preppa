import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Inbox, Lock, MapPin, Users, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useOpenRequests, useSubmitBid, type OpenRequest } from '@/lib/queries/experiences';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`);

function Meta({ Icon, text }: { Icon: typeof Users; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon size={13} color={Palette.textMuted} />
      <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{text}</Text>
    </View>
  );
}

function RequestCard({ req, prepperId }: { req: OpenRequest; prepperId: string }) {
  const submit = useSubmitBid();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function send() {
    setErr(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { feedback.warning(); return setErr('Enter your quote amount.'); }
    feedback.tap();
    submit.mutate(
      { requestId: req.id, prepperId, amount: amt, message: message.trim() },
      { onError: (e) => setErr(e instanceof Error ? e.message : 'Could not submit bid.') },
    );
  }

  return (
    <View style={{ backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.md, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, flex: 1 }}>{req.title}</Text>
        <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE, textTransform: 'capitalize' }}>{req.kind.replace('_', ' ')}</Text>
        </View>
      </View>
      {req.details ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 6, lineHeight: 19 }} numberOfLines={3}>{req.details}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        {req.guests ? <Meta Icon={Users} text={`${req.guests} guests`} /> : null}
        <Meta Icon={Wallet} text={`budget ${money(req.budget)}`} />
        {req.location ? <Meta Icon={MapPin} text={req.location} /> : null}
      </View>

      {req.myBid ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.border }}>
          <Check size={16} color={Palette.success} strokeWidth={3} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>Your bid: {money(req.myBid.amount)}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, textTransform: 'capitalize' }}>· {req.myBid.status}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.border, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={amount} onChangeText={setAmount} placeholder="Your quote $" placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad"
              style={{ width: 120, height: 46, borderRadius: 12, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }} />
            <TextInput value={message} onChangeText={setMessage} placeholder="Short note (optional)" placeholderTextColor={Palette.textMuted}
              style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }} />
          </View>
          {err ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{err}</Text> : null}
          <PressableScale onPress={send} disabled={submit.isPending} accessibilityRole="button" accessibilityLabel="Submit bid"
            style={{ height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: submit.isPending ? 0.7 : 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Submit bid</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

function Gate({ title, body }: { title: string; body: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Lock size={26} color={Palette.textMuted} />
      </View>
      <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>{body}</Text>
      <PressableScale onPress={() => { feedback.tap(); router.push('/become-prepper'); }} accessibilityRole="button" accessibilityLabel="Become a prepper" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Become a prepper</Text>
      </PressableScale>
    </View>
  );
}

export default function OpportunitiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application, isLoading: appLoading } = useMyPrepperApplication(user?.id);
  const approved = application?.status === 'approved';
  const { data: requests, isLoading, refetch } = useOpenRequests(approved ? application?.id : null);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  function goBack() {
    feedback.tap();
    try { router.back(); } catch { router.replace('/dashboard'); }
  }

  const Header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
      <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={22} color={INK} />
      </PressableScale>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>opportunities</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>open experience requests to bid on</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {Header}
        {appLoading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : !user || !application ? (
          <Gate title="For preppers only" body="Apply to become a prepper to view and bid on customer experience requests." />
        ) : !approved ? (
          <Gate title="Approval pending" body="Once your prepper application is approved, customer requests will appear here for you to bid on." />
        ) : isLoading ? (
          <ListSkeleton count={4} />
        ) : !requests?.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <Inbox size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>No open requests right now. Check back soon.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, paddingTop: Platform.OS === 'web' ? 12 : 8, gap: 12, paddingBottom: 60 }}>
            {requests.map((r, i) => (
              <MotiView key={r.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 45 }}>
                <RequestCard req={r} prepperId={application!.id} />
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
