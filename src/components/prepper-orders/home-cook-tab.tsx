import { useRouter } from 'expo-router';
import { CalendarCheck, ChefHat, MapPin, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { HC, HC_TINT, CARD } from '@/components/prepper-order-card';
import type { HomeCookRequest } from '@/lib/queries/home-cook';

export interface HomeCookTabProps {
  prepperId: string | undefined;
  homeCookJobs: HomeCookRequest[] | undefined;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onProposeTerms: (job: HomeCookRequest) => void;
}

function EmptyState({ message }: { message: string }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
        <ChefHat size={28} color="#5b6170" />
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No home cook requests</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>{message}</Text>
    </MotiView>
  );
}

export function HomeCookTab({ prepperId, homeCookJobs, refreshing, onRefresh, onProposeTerms }: HomeCookTabProps) {
  const router = useRouter();

  if (!prepperId) {
    return (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 280 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
        <ChefHat size={28} color="#5b6170" />
        <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>
          Approved preppers see home cook booking requests here.
        </Text>
      </MotiView>
    );
  }

  if (!homeCookJobs?.length) {
    return (
      <EmptyState message="When Prep+ customers book you to cook at their home, requests appear here for you to review and propose terms." />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={HC} colors={[HC]} />}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
      {homeCookJobs.map((job, i) => {
        const isNegotiating = job.status === 'negotiating';
        return (
          <MotiView
            key={job.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 260, delay: i * 45 }}>
            <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 12, borderLeftWidth: 3, borderLeftColor: isNegotiating ? HC : '#7C3AED66' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }} numberOfLines={1}>
                    {job.customerName ?? 'Customer'}
                  </Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>
                    ${job.ingredientBudget} ingredient budget · {job.guestCount} guest{job.guestCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: isNegotiating ? HC + '30' : '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: isNegotiating ? HC_TINT : Palette.textMuted, textTransform: 'capitalize' }}>
                    {job.status}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <CalendarCheck size={13} color={HC} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>
                    {job.requestedDate} · {job.requestedTime.replace('_', ' ')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <MapPin size={13} color={HC} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }} numberOfLines={1}>
                    {job.address}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Users size={13} color={HC} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>
                    {job.guestCount} guests{job.cuisine ? ` · ${job.cuisine}` : ''}
                  </Text>
                </View>
              </View>

              {isNegotiating && job.cookingFee != null ? (
                <View style={{ backgroundColor: '#1d2129', borderRadius: 11, padding: 10, gap: 3 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: HC }}>Terms proposed — awaiting customer</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>
                    Cooking: ${job.cookingFee} · Travel: ${job.travelFee ?? 0} · Customer total: ${job.ingredientBudget + job.cookingFee + (job.travelFee ?? 0)}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {job.conversationId ? (
                  <PressableScale
                    onPress={() => { feedback.tap(); router.push({ pathname: '/chat', params: { id: job.conversationId!, name: job.customerName ?? 'Customer' } }); }}
                    accessibilityRole="button"
                    accessibilityLabel="Open chat"
                    style={{ height: 44, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textMuted }}>Chat</Text>
                  </PressableScale>
                ) : null}
                {job.status === 'pending' ? (
                  <PressableScale
                    onPress={() => { feedback.tap(); onProposeTerms(job); }}
                    accessibilityRole="button"
                    accessibilityLabel="Propose terms"
                    style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: HC, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }}>Propose terms</Text>
                  </PressableScale>
                ) : (
                  <View style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: '#1d2129', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.textMuted }}>Awaiting customer confirmation</Text>
                  </View>
                )}
              </View>
            </View>
          </MotiView>
        );
      })}
    </ScrollView>
  );
}
