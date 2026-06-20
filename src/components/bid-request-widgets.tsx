import { Check, Clock, DollarSign, Minus, Plus, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { MealRequest, MyMealRequest } from '@/lib/queries/bid-requests';

export const BUDGET_PRESETS = [8, 12, 18, 25, 35];
export const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');
export const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

export type BidRequestType = MealRequest;

const ORANGE = Palette.brand;
const INK = Palette.ink;
const S1 = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

export function Stepper({ value, onChange, min = 1, max = 100 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Palette.border }}>
      <PressableScale onPress={() => { feedback.tap(); onChange(Math.max(min, value - 1)); }} disabled={value <= min}
        accessibilityRole="button" accessibilityLabel={`Decrease, current value ${value}`}
        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', opacity: value <= min ? 0.35 : 1 }}>
        <Minus size={15} color={INK} />
      </PressableScale>
      <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <PressableScale onPress={() => { feedback.tap(); onChange(Math.min(max, value + 1)); }} disabled={value >= max}
        accessibilityRole="button" accessibilityLabel={`Increase, current value ${value}`}
        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE + '1A', alignItems: 'center', justifyContent: 'center', opacity: value >= max ? 0.35 : 1 }}>
        <Plus size={15} color={ORANGE} />
      </PressableScale>
    </View>
  );
}

export function BudgetPerServingPicker({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const [custom, setCustom] = useState(value != null && !BUDGET_PRESETS.includes(value));
  const [raw, setRaw] = useState(value != null && !BUDGET_PRESETS.includes(value) ? String(value) : '');
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BUDGET_PRESETS.map((p) => {
          const on = !custom && value === p;
          return (
            <PressableScale key={p} onPress={() => { feedback.tap(); setCustom(false); onChange(p); }}
              accessibilityRole="button" accessibilityLabel={`Set budget to $${p} per serving`}
              style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, backgroundColor: on ? Palette.brandTint : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : INK }}>${p}/serving</Text>
            </PressableScale>
          );
        })}
        <PressableScale onPress={() => { feedback.tap(); setCustom(true); onChange(null); }}
          accessibilityRole="button" accessibilityLabel="Set custom budget per serving"
          style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: custom ? ORANGE : Palette.border, backgroundColor: custom ? Palette.brandTint : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: custom ? ORANGE : INK }}>Custom</Text>
        </PressableScale>
      </View>
      {custom ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 12, height: 46, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Palette.border }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.textSecondary }}>$</Text>
          </View>
          <TextInput value={raw} onChangeText={(t) => { const n = t.replace(/[^0-9.]/g, ''); setRaw(n); const v = parseFloat(n); onChange(!isNaN(v) && v > 0 ? v : null); }}
            placeholder="per serving" placeholderTextColor={Palette.textSecondary} keyboardType="numeric" maxLength={6}
            style={{ flex: 1, height: 46, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 14, color: INK }}
            accessibilityLabel="Custom budget per serving" />
        </View>
      ) : null}
    </View>
  );
}

export function RequestCard({ r, isPrepper, onBid }: { r: BidRequestType; isPrepper: boolean; onBid: (r: BidRequestType) => void }) {
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 10, marginBottom: 12, ...S1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>{r.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 3, lineHeight: 19 }}>{r.description}</Text>
        </View>
        {r.bid_count > 0 ? (
          <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>{r.bid_count} bid{r.bid_count === 1 ? '' : 's'}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users size={13} color={Palette.textSecondary} />
          <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>{r.servings} servings</Text>
        </View>
        {r.budget_per_serving != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <DollarSign size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>${r.budget_per_serving}/serving budget</Text>
          </View>
        ) : null}
        {r.deadline ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>by {new Date(r.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>from {r.poster}{r.cuisine ? ` · ${r.cuisine}` : ''}</Text>
        {isPrepper ? (
          <PressableScale onPress={() => onBid(r)} accessibilityRole="button" accessibilityLabel={`Bid on ${r.title}`}
            style={{ height: 38, paddingHorizontal: 18, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>place bid</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

type ManageModalProps = {
  request: MyMealRequest | null;
  onClose: () => void;
  onReviewBid: (bid: MyMealRequest['bids'][0], request: MyMealRequest) => void;
};

export function ManageRequestModal({ request, onClose, onReviewBid }: ManageModalProps) {
  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }} numberOfLines={2}>{request?.title}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>
                  {request?.servings} servings{request?.budget_per_serving != null ? ` · $${request.budget_per_serving}/serving budget` : ''}
                </Text>
              </View>
              <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={Palette.inkSoft} />
              </PressableScale>
            </View>
            {request?.description ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>{request.description}</Text>
            ) : null}
            <View style={{ backgroundColor: request?.status === 'open' ? Palette.brandTint : Palette.success + '1A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: request?.status === 'open' ? ORANGE : Palette.success, textTransform: 'capitalize' }}>
                {request?.status} · {request?.bids.length ? `${request.bids.length} bid${request.bids.length === 1 ? '' : 's'}` : 'waiting for bids'}
              </Text>
            </View>
            {request?.bids.length ? (
              request.bids.map((b) => (
                <View key={b.id} style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 14, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{b.prepperName}</Text>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE, marginTop: 2 }}>
                        ${(b.pricePerServing * (request.servings)).toFixed(2)} total · ${b.pricePerServing}/serving
                      </Text>
                      {b.note ? <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 4, lineHeight: 18 }}>{b.note}</Text> : null}
                    </View>
                  </View>
                  {b.status === 'accepted' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Check size={14} color={Palette.success} strokeWidth={3} />
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.success }}>Agreed</Text>
                    </View>
                  ) : request.status === 'open' && b.status === 'pending' ? (
                    <PressableScale onPress={() => { feedback.tap(); onReviewBid(b, request); }}
                      accessibilityRole="button" accessibilityLabel={`Review bid from ${b.prepperName}`}
                      style={{ height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Review & accept bid</Text>
                    </PressableScale>
                  ) : (
                    <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, textTransform: 'capitalize' }}>{b.status}</Text>
                  )}
                </View>
              ))
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                  <Clock size={28} color={Palette.textSecondary} />
                </View>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                  No bids yet. Preppers in your area will see your request and send bids soon.
                </Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
