import { Check, Clock, Edit3, MessageCircle, Save, X, XCircle } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  useAcceptBid,
  useCancelExperienceRequest,
  useUpdateRequestDetails,
  type MyExperienceRequest,
} from '@/lib/queries/experiences';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
const money = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`);
const KIND_LABEL: Record<string, string> = {
  catering: 'Catering', private_chef: 'Private chef', food_service: 'Food service',
  cleaning: 'Cleaning', class: 'Cooking class', tasting: 'Tasting menu',
};

export function RequestDetailSheet({
  request, onClose,
}: {
  request: MyExperienceRequest | null;
  onClose: () => void;
}) {
  const accept = useAcceptBid();
  const cancel = useCancelExperienceRequest();
  const updateDetails = useUpdateRequestDetails();
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefsDraft, setPrefsDraft] = useState('');
  const [prefsErr, setPrefsErr] = useState<string | null>(null);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  if (!request) return null;

  const pendingBids = request.bids.filter((b) => b.status === 'pending');
  const acceptedBid = request.bids.find((b) => b.status === 'accepted');
  const isOpen = request.status === 'open';
  const isBooked = request.status === 'booked';

  function handleClose() { setCancelConfirm(false); setEditingPrefs(false); onClose(); }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
          <ScrollView keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 16 }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE }}>
                      {KIND_LABEL[request.kind] ?? request.kind}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: isBooked ? Palette.success + '1A' : isOpen ? Palette.brandTint : Palette.chip, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: isBooked ? Palette.success : isOpen ? ORANGE : Palette.textMuted, textTransform: 'capitalize' }}>
                      {request.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5 }}>{request.title}</Text>
              </View>
              <PressableScale onPress={() => { feedback.tap(); handleClose(); }} accessibilityRole="button" accessibilityLabel="Close"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginTop: 2 }}>
                <X size={18} color={Palette.inkSoft} />
              </PressableScale>
            </View>

            {/* Meta chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {request.guests ? (
                <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>👥 {request.guests} guests</Text>
                </View>
              ) : null}
              {request.budget ? (
                <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>💰 {money(request.budget)}</Text>
                </View>
              ) : null}
              {request.location ? (
                <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }} numberOfLines={1}>📍 {request.location}</Text>
                </View>
              ) : null}
            </View>

            {/* Food preferences */}
            <View style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Food preferences</Text>
                {isOpen && !editingPrefs ? (
                  <PressableScale onPress={() => { feedback.tap(); setPrefsDraft(request.details ?? ''); setEditingPrefs(true); }}
                    accessibilityRole="button" accessibilityLabel="Edit preferences"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Edit3 size={13} color={ORANGE} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>Edit</Text>
                  </PressableScale>
                ) : null}
              </View>
              {editingPrefs ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={prefsDraft}
                    onChangeText={(t) => setPrefsDraft(cleanBlock(t))}
                    multiline
                    placeholder="Cuisine preferences, dietary needs, vibe, must-haves…"
                    placeholderTextColor={Palette.textMuted}
                    maxLength={500}
                    textAlignVertical="top"
                    style={{ minHeight: 88, backgroundColor: Palette.surface, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, padding: 12, fontFamily: Font.body, fontSize: 14, color: INK }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PressableScale onPress={() => { feedback.tap(); setEditingPrefs(false); }} accessibilityRole="button" accessibilityLabel="Cancel"
                      style={{ flex: 1, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>Cancel</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={async () => {
                        feedback.tap();
                        setPrefsErr(null);
                        try {
                          await updateDetails.mutateAsync({ requestId: request.id, details: cleanBlock(prefsDraft).trim() });
                          feedback.success();
                          setEditingPrefs(false);
                        } catch (e) {
                          feedback.error();
                          setPrefsErr(e instanceof Error ? e.message : 'Could not save preferences.');
                        }
                      }}
                      disabled={updateDetails.isPending}
                      accessibilityRole="button" accessibilityLabel="Save preferences"
                      style={{ flex: 2, height: 40, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: updateDetails.isPending ? 0.7 : 1 }}>
                      {updateDetails.isPending
                        ? <ActivityIndicator color="#fff" size="small" />
                        : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Save size={14} color="#fff" />
                            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Save changes</Text>
                          </View>
                        )}
                    </PressableScale>
                  </View>
                  {prefsErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.danger }}>{prefsErr}</Text> : null}
                </View>
              ) : (
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: request.details ? INK : Palette.textMuted, lineHeight: 20 }}>
                  {request.details ?? 'No preferences noted — tap Edit to add dietary needs or cuisine wishes.'}
                </Text>
              )}
            </View>

            {/* Bids / booked section */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isBooked ? 'Booked with' : pendingBids.length > 0 ? `${pendingBids.length} bid${pendingBids.length === 1 ? '' : 's'} received` : 'Awaiting bids'}
              </Text>

              {isBooked && acceptedBid ? (
                <View style={{ backgroundColor: Palette.success + '0D', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: Palette.success + '33' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.success + '1A', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={20} color={Palette.success} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{acceptedBid.prepper?.display_name ?? 'Your chef'}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.success }}>{money(acceptedBid.amount)} · Confirmed</Text>
                    </View>
                  </View>
                  {acceptedBid.message ? (
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{acceptedBid.message}</Text>
                  ) : null}
                  <PressableScale onPress={() => { feedback.tap(); handleClose(); }} accessibilityRole="button" accessibilityLabel="Message your chef"
                    style={{ height: 44, borderRadius: Radius.pill, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                    <MessageCircle size={16} color="#fff" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Message your chef</Text>
                  </PressableScale>
                </View>
              ) : pendingBids.length === 0 ? (
                <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 24, alignItems: 'center', gap: 10 }}>
                  <Clock size={28} color={Palette.textMuted} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                    No bids yet. Preppers near you will see your request and send quotes shortly.
                  </Text>
                </MotiView>
              ) : (
                <View style={{ gap: 10 }}>
                  {pendingBids.map((b, i) => (
                    <MotiView key={b.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                      <View style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 16, gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <View style={{ gap: 2 }}>
                            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{b.prepper?.display_name ?? 'Prepper'}</Text>
                            <Text style={{ fontFamily: Font.display, fontSize: 20, color: ORANGE, letterSpacing: -0.4 }}>{money(b.amount)}</Text>
                          </View>
                        </View>
                        {b.message ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{b.message}</Text> : null}
                        <PressableScale
                          onPress={async () => {
                            feedback.tap();
                            setAcceptErr(null);
                            try { await accept.mutateAsync(b.id); feedback.success(); handleClose(); } catch { feedback.error(); setAcceptErr('Could not accept bid. Please try again.'); }
                          }}
                          disabled={accept.isPending}
                          accessibilityRole="button" accessibilityLabel={`Accept bid from ${b.prepper?.display_name ?? 'this prepper'}`}
                          style={{ height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: accept.isPending ? 0.7 : 1 }}>
                          {accept.isPending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Accept · {money(b.amount)}</Text>}
                        </PressableScale>
                        {acceptErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.danger, textAlign: 'center' }}>{acceptErr}</Text> : null}
                      </View>
                    </MotiView>
                  ))}
                </View>
              )}
            </View>

            {/* Cancel request */}
            {isOpen ? (
              cancelConfirm ? (
                <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }}
                  style={{ backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#991B1B' }}>Cancel this request?</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#B91C1C', lineHeight: 19 }}>
                    This will close your request and dismiss all bids. This cannot be undone.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PressableScale onPress={() => { feedback.tap(); setCancelConfirm(false); }} accessibilityRole="button" accessibilityLabel="Keep request"
                      style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Keep it</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={async () => {
                        feedback.tap();
                        setCancelErr(null);
                        try { await cancel.mutateAsync(request.id); feedback.success(); handleClose(); } catch { feedback.error(); setCancelErr('Could not cancel request. Please try again.'); }
                      }}
                      disabled={cancel.isPending}
                      accessibilityRole="button" accessibilityLabel="Confirm cancel"
                      style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', opacity: cancel.isPending ? 0.7 : 1 }}>
                      {cancel.isPending
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Yes, cancel</Text>}
                    </PressableScale>
                  </View>
                  {cancelErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: '#991B1B' }}>{cancelErr}</Text> : null}
                </MotiView>
              ) : (
                <PressableScale onPress={() => { feedback.tap(); setCancelConfirm(true); }} accessibilityRole="button" accessibilityLabel="Cancel request"
                  style={{ height: 48, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.danger, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <XCircle size={16} color={Palette.danger} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.danger }}>Cancel this request</Text>
                </PressableScale>
              )
            ) : null}

          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
