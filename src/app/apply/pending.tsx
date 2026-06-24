import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { ChefHat, Clock, Mail } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';

const MAX_FORM_WIDTH = 560;

function StepItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepIcon}>{icon}</View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

export default function PendingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <MotiView
          from={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 500, damping: 18 }}
          style={styles.iconWrap}
        >
          <ChefHat size={48} color={Palette.brand} strokeWidth={1.5} />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 340, delay: 120 }}
        >
          <Text style={styles.heading}>Application submitted!</Text>
          <Text style={styles.sub}>
            Thank you for applying to become a Preppa. Our Trust & Safety team will review your application within 3–5 business days.
          </Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 340, delay: 240 }}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>What happens next</Text>
          <StepItem
            icon={<Mail size={18} color={Palette.brand} strokeWidth={1.5} />}
            title="Confirmation email"
            body="We've sent a receipt to your registered email address."
          />
          <StepItem
            icon={<Clock size={18} color={Palette.brand} strokeWidth={1.5} />}
            title="Review in 3–5 days"
            body="Our team checks your documents, certificate, and kitchen photos."
          />
          <StepItem
            icon={<ChefHat size={18} color={Palette.brand} strokeWidth={1.5} />}
            title="Go live"
            body="Once approved, your kitchen is activated and you can publish your first meal."
          />
        </MotiView>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Return to home"
        >
          <Text style={styles.primaryBtnText}>Return to home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Palette.canvas },
  container: {
    flex: 1, width: '100%', maxWidth: MAX_FORM_WIDTH,
    alignSelf: 'center', paddingHorizontal: Space.lg,
    paddingTop: Space.xxl, paddingBottom: Space.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.xl,
  },
  heading: {
    fontFamily: Font.heading, fontSize: Type.displayXl,
    color: Palette.ink, textAlign: 'center', marginBottom: Space.md,
  },
  sub: {
    fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary,
    textAlign: 'center', lineHeight: 24, marginBottom: Space.xl,
  },
  card: {
    width: '100%', backgroundColor: Palette.surface,
    borderRadius: Radius.card, padding: Space.xl,
    marginBottom: Space.xl, ...Shadow.card,
  },
  cardTitle:   { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.lg },
  stepItem:    { flexDirection: 'row', gap: Space.md, marginBottom: Space.lg, alignItems: 'flex-start' },
  stepIcon:    {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepText:    { flex: 1 },
  stepTitle:   { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink, marginBottom: 2 },
  stepBody:    { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, lineHeight: 20 },
  primaryBtn: {
    width: '100%', height: 52, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm, backgroundColor: Palette.brand,
  },
  primaryBtnText: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.surface },
});
