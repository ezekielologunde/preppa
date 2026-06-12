import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { Font } from '@/constants/fonts';
import { experienceTypes } from '@/constants/mock';
import { Palette, Radius } from '@/constants/theme';
import { useAcceptBid, useCreateExperienceRequest, useMyExperienceRequests } from '@/lib/queries/experiences';
import { useAuth } from '@/providers/auth-provider';
import type { ExperienceKind } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const KINDS = experienceTypes.map((t) => ({ key: t.key as ExperienceKind, label: t.label }));
const money = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`);

const inputStyle = { height: 50, borderRadius: 14, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontSize: 15, fontFamily: Font.body, color: INK } as const;

export default function ExperienceRequestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ kind?: string }>();
  const { data: requests, isLoading, refetch } = useMyExperienceRequests(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }
  const create = useCreateExperienceRequest();
  const accept = useAcceptBid();

  const initialKind = (KINDS.find((k) => k.key === params.kind)?.key ?? 'catering') as ExperienceKind;
  const [kind, setKind] = useState<ExperienceKind>(initialKind);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [guests, setGuests] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/experiences'); }
  }

  function submit() {
    setErr(null);
    if (!user) return router.push('/auth?mode=signup');
    if (title.trim().length < 3) return setErr('Give your request a short title.');
    feedback.tap();
    create.mutate(
      {
        userId: user.id,
        kind,
        title: title.trim(),
        details: details.trim(),
        guests: guests ? parseInt(guests, 10) : null,
        budget: budget ? parseFloat(budget) : null,
        location: location.trim(),
      },
      {
        onSuccess: () => { setTitle(''); setDetails(''); setGuests(''); setBudget(''); setLocation(''); },
        onError: (e) => setErr(e instanceof Error ? e.message : 'Could not post request.'),
      },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>Post a request</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
          {/* Kind selector */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: INK, marginTop: 8, marginBottom: 8 }}>What do you need?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              return (
                <PressableScale key={k.key} onPress={() => { feedback.tap(); setKind(k.key); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={k.label}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill, backgroundColor: on ? Palette.brandTint : Palette.canvas, borderWidth: 1, borderColor: on ? ORANGE : 'transparent' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : Palette.inkSoft }}>{k.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }}>
          <View style={{ gap: 12, marginTop: 16 }}>
            <TextInput style={inputStyle} placeholder="Title — e.g. Birthday dinner for 8" placeholderTextColor={Palette.textMuted} value={title} onChangeText={setTitle} />
            <TextInput style={[inputStyle, { height: 90, paddingTop: 14, textAlignVertical: 'top' }]} placeholder="Details — cuisine, dietary needs, vibe…" placeholderTextColor={Palette.textMuted} value={details} onChangeText={setDetails} multiline />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Guests" placeholderTextColor={Palette.textMuted} keyboardType="number-pad" value={guests} onChangeText={setGuests} />
              <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Budget $" placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad" value={budget} onChangeText={setBudget} />
            </View>
            <TextInput style={inputStyle} placeholder="Location — neighbourhood or address" placeholderTextColor={Palette.textMuted} value={location} onChangeText={setLocation} />
          </View>
          </MotiView>

          {err ? <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.danger, marginTop: 14 }}>{err}</Text> : null}

          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
          <PressableScale onPress={submit} disabled={create.isPending} accessibilityRole="button" accessibilityLabel="Post request"
            style={{ height: 52, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 18, opacity: create.isPending ? 0.7 : 1 }}>
            {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Post request</Text>}
          </PressableScale>
          </MotiView>

          {/* My requests */}
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4, marginTop: 22, marginBottom: 10 }}>my requests</Text>
          {isLoading ? (
            <ActivityIndicator color={ORANGE} style={{ marginTop: 12 }} />
          ) : !requests?.length ? (
            <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.md, padding: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center' }}>
                {user ? 'No requests yet. Post one above to start receiving bids.' : 'Sign in to post a request and track bids.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {requests.map((r, i) => (
                <MotiView key={r.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 45 }}>
                <View style={{ backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.md, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, flex: 1 }}>{r.title}</Text>
                    <View style={{ backgroundColor: r.status === 'open' ? Palette.brandTint : Palette.success + '1A', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: r.status === 'open' ? ORANGE : Palette.success, textTransform: 'capitalize' }}>{r.status}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 4 }}>
                    {r.guests ? `${r.guests} guests · ` : ''}{r.budget ? `budget ${money(r.budget)} · ` : ''}{r.location ?? ''}
                  </Text>

                  {/* Bids */}
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textMuted, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {r.bids.length ? `${r.bids.length} bid${r.bids.length === 1 ? '' : 's'}` : 'No bids yet'}
                  </Text>
                  {r.bids.map((b) => (
                    <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Palette.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{b.prepper?.display_name ?? 'Prepper'} · {money(b.amount)}</Text>
                        {b.message ? <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }} numberOfLines={2}>{b.message}</Text> : null}
                      </View>
                      {b.status === 'accepted' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Check size={15} color={Palette.success} strokeWidth={3} />
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.success }}>Booked</Text>
                        </View>
                      ) : r.status === 'open' && b.status === 'pending' ? (
                        <PressableScale onPress={() => { feedback.tap(); accept.mutate(b.id); }} disabled={accept.isPending} accessibilityRole="button" accessibilityLabel={`Accept bid from ${b.prepper?.display_name ?? 'prepper'}`}
                          style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff' }}>Accept</Text>
                        </PressableScale>
                      ) : (
                        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted, textTransform: 'capitalize' }}>{b.status}</Text>
                      )}
                    </View>
                  ))}
                </View>
                </MotiView>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
