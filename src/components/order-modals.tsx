import { AlertTriangle, X } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { money } from '@/components/order-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { OrderSummary } from '@/lib/queries/orders';

const ORANGE = Palette.brand;
const INK = Palette.ink;

interface ReportModalProps {
  reportModal: OrderSummary | null;
  reportReason: string;
  setReportReason: (r: string) => void;
  reportErr: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function ReportModal({ reportModal, reportReason, setReportReason, reportErr, isPending, onSubmit, onClose }: ReportModalProps) {
  return (
    <Modal visible={!!reportModal} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close report form"
        style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
          style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 24, padding: 22, gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={26} color={Palette.textSecondary} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Report an issue</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>
            Tell us what went wrong with your preorder from {reportModal?.prepper ?? ''}. Our team will review it.
          </Text>
          <TextInput
            value={reportReason}
            onChangeText={setReportReason}
            placeholder="Describe the issue…"
            placeholderTextColor={Palette.textSecondary}
            multiline
            maxLength={1000}
            accessibilityLabel="Describe the issue"
            style={{ minHeight: 100, backgroundColor: Palette.canvas, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, padding: 12, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top' }}
          />
          {reportErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{reportErr}</Text> : null}
          <PressableScale onPress={onSubmit} disabled={isPending} accessibilityRole="button" accessibilityLabel="Submit report"
            style={{ height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Submit report</Text>}
          </PressableScale>
          <PressableScale onPress={() => { feedback.tap(); onClose(); }} accessibilityRole="button" accessibilityLabel="Cancel"
            style={{ height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Cancel</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ConfirmCancelModalProps {
  confirmCancel: OrderSummary | null;
  onConfirm: (o: OrderSummary) => void;
  onDismiss: () => void;
}

export function ConfirmCancelModal({ confirmCancel, onConfirm, onDismiss }: ConfirmCancelModalProps) {
  return (
    <Modal visible={!!confirmCancel} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Keep my preorder"
        style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
          style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 24, padding: 22, gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
            <X size={26} color={Palette.danger} strokeWidth={2.6} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Cancel this preorder?</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 20 }}>
            {confirmCancel ? `Your preorder from ${confirmCancel.prepper} (${money(confirmCancel.total)}) will be cancelled.` : ''}
            {confirmCancel?.paymentStatus === 'succeeded' ? " You'll be refunded automatically." : ''}
          </Text>
          <PressableScale onPress={() => { feedback.tap(); if (confirmCancel) onConfirm(confirmCancel); }} accessibilityRole="button" accessibilityLabel="Yes, cancel the preorder"
            style={{ height: 50, borderRadius: 14, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, cancel preorder</Text>
          </PressableScale>
          <PressableScale onPress={() => { feedback.tap(); onDismiss(); }} accessibilityRole="button" accessibilityLabel="Keep my preorder"
            style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Keep my preorder</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
