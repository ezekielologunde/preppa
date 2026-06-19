import { CheckSquare, Square, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const TERMS = [
  {
    id: 'age',
    heading: 'Age & eligibility',
    body: 'I confirm I am 18 or older and legally permitted to sell food in my area.',
  },
  {
    id: 'review',
    heading: 'Application review',
    body: 'I understand my kitchen and documents will be reviewed by the Preppa team before I can go live — usually within 1–2 business days.',
  },
  {
    id: 'food_safety',
    heading: 'Food safety compliance',
    body: 'I agree to maintain proper food handling standards and hold all certifications required by my local laws and health authorities.',
  },
  {
    id: 'identity',
    heading: 'Identity verification',
    body: 'I consent to Preppa securely verifying my identity documents. They will not be shared beyond the internal review team.',
  },
  {
    id: 'tos',
    heading: 'Preppa Prepper Terms',
    body: 'I have read and agree to the Preppa Prepper Terms of Service, including payment processing, order fulfilment, and dispute resolution policies.',
  },
];

export function PrepperTermsModal({
  visible,
  isPending,
  onClose,
  onAccept,
}: {
  visible: boolean;
  isPending: boolean;
  onClose: () => void;
  onAccept: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const allChecked = TERMS.every((t) => checked.has(t.id));

  function toggle(id: string) {
    feedback.tap();
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Palette.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Palette.border }}>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4 }}>
            Terms & acknowledgements
          </Text>
          <PressableScale onPress={() => { feedback.tap(); onClose(); }}
            accessibilityRole="button" accessibilityLabel="Close terms"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <X size={17} color={Palette.textSecondary} />
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20, marginBottom: 4 }}>
            Please read and acknowledge each section before submitting your application.
          </Text>

          {TERMS.map((term) => {
            const on = checked.has(term.id);
            return (
              <PressableScale key={term.id} onPress={() => toggle(term.id)}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                accessibilityLabel={term.heading}
                style={{ flexDirection: 'row', gap: 14, backgroundColor: Palette.canvas,
                  borderRadius: 16, padding: 16, alignItems: 'flex-start' }}>
                <MotiView animate={{ opacity: on ? 1 : 0.55 }} transition={{ type: 'timing', duration: 140 }}
                  style={{ marginTop: 2, flexShrink: 0 }}>
                  {on
                    ? <CheckSquare size={22} color={Palette.brand} />
                    : <Square size={22} color={Palette.textMuted} />}
                </MotiView>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>{term.heading}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{term.body}</Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 8 : 20, paddingTop: 12,
          borderTopWidth: 1, borderTopColor: Palette.border }}>
          <PressableScale onPress={() => { if (!allChecked || isPending) return; onAccept(); }}
            disabled={!allChecked || isPending}
            accessibilityRole="button" accessibilityLabel="Accept and submit application"
            style={{ height: 54, borderRadius: Radius.pill,
              backgroundColor: allChecked ? Palette.brand : Palette.chip,
              alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.72 : 1 }}>
            {isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontFamily: Font.heading, fontSize: 16,
                  color: allChecked ? '#fff' : Palette.textMuted }}>
                  {allChecked ? 'Accept & submit application' : `Check all ${TERMS.length} sections to continue`}
                </Text>}
          </PressableScale>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
