import { useRouter } from 'expo-router';
import { CalendarCheck, ChefHat, MapPin, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { HC, CARD } from '@/components/prepper-order-card';
import type { HomeCookRequest } from '@/lib/queries/home-cook';

const INK    = Palette.ink;
const SUB    = Palette.textSecondary;
const BORDER = '#EDE9E4';
const S1     = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

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
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...S1 }}>
        <ChefHat size={28} color={SUB} />
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>No home cook requests</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center' }}>{message}</Text>
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
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...S1 }}>
          <ChefHat size={28} color={SUB} />
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center' }}>
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
            <View style={{ backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: isNegotiating ? HC : HC + '66', ...S1 }}>
              <View style={{ padding: 14, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>
                      {job.customerName ?? 'Customer'}
                    </Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: SUB, marginTop: 1 }}>
                      ${job.ingredientBudget} ingredient budget · {job.guestCount} guest{job.guestCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: isNegotiating ? HC + '18' : '#F0EDEA', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: isNegotiating ? HC : SUB, textTransform: 'capitalize' }}>
                      {job.status}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <CalendarCheck size={13} color={HC} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>
                      {job.requestedDate} · {job.requestedTime.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <MapPin size={13} color={HC} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }} numberOfLines={1}>
                      {job.address}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Users size={13} color={HC} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>
                      {job.guestCount} guests{job.cuisine ? ` · ${job.cuisine}` : ''}
                    </Text>
                  </View>
                </View>

                {isNegotiating && job.cookingFee != null ? (
                  <View style={{ backgroundColor: '#F8F6F3', borderRadius: 11, padding: 10, gap: 3 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: HC }}>Terms proposed — awaiting customer</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: SUB }}>
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
                      style={{ height: 44, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: SUB }}>Chat</Text>
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
                  ) : job.status === 'negotiating' ? (
                    <View style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: HC + '12', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: HC }}>Awaiting customer</Text>
                    </View>
                  ) : job.status === 'accepted' ? (
                    <View style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.successTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.success }}>Accepted — coordinate via chat</Text>
                    </View>
                  ) : (
                    <View style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: SUB, textTransform: 'capitalize' }}>{job.status}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </MotiView>
        );
      })}
    </ScrollView>
  );
}
