import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import type { ListingForm } from '@/app/create-listing';

const USE_CASE_LABELS: Record<string, string> = {
  'weekly-prep':   'Weekly Meal Prep',
  'lunch-box':     'Lunch Box',
  'daily-drop':    'Daily Drop',
  'monthly-sub':   'Subscription Box',
  'family-bundle': 'Family Bundle',
  'macro-plan':    'Macro-Balanced Plan',
  dinner:          'Dinner Special',
  single:          'Single Serving',
  'snack-pack':    'Snack Pack',
  class:           'Cooking Class',
  consult:         'Meal Planning',
  catering:        'Corporate Catering',
  'diet-spec':     'Dietary Specialist',
  cultural:        'Cultural Cuisine',
  therapeutic:     'Therapeutic Meals',
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  form: ListingForm;
  update: <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function PreviewStep({ form }: Props) {
  const daysText = [...form.availableDays].sort((a, b) => a - b).map(d => DAYS_SHORT[d]).join(', ') || '—';
  const servicesText = form.serviceTypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ') || '—';
  const typesText = form.useCases.map(k => USE_CASE_LABELS[k] ?? k).join(', ') || '—';
  const dietText = form.dietaryTags.length ? form.dietaryTags.join(', ') : 'None specified';
  const allergensText = form.allergens.length ? form.allergens.join(', ') : 'None declared';
  const coverPhoto = form.photos[0];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Preview your listing</Text>
      <Text style={styles.sub}>Review everything before going live.</Text>

      <View style={styles.card}>
        {coverPhoto ? (
          <Image
            source={{ uri: coverPhoto.uri }}
            style={styles.coverImage}
            resizeMode="cover"
            accessibilityLabel="Cover photo"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>No photo — add one for more orders</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={2}>
              {form.name || 'Untitled listing'}
            </Text>
            {form.price ? <Text style={styles.cardPrice}>£{form.price}</Text> : null}
          </View>
          {form.tagline ? <Text style={styles.cardTagline}>{form.tagline}</Text> : null}
          {form.description ? (
            <Text style={styles.cardDesc} numberOfLines={3}>{form.description}</Text>
          ) : null}
          {form.servings ? (
            <Text style={styles.cardMeta}>{form.servings} serving{form.servings !== '1' ? 's' : ''} available</Text>
          ) : null}
          {form.photos.length > 1 && (
            <Text style={styles.cardMeta}>+{form.photos.length - 1} more photo{form.photos.length > 2 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      <Section title="Details">
        <DetailRow label="Price" value={form.price ? `£${form.price} per serving` : ''} />
        <DetailRow label="Servings" value={form.servings} />
        <DetailRow label="Portions/day" value={form.dailyPortions} />
      </Section>

      <Section title="Listing type">
        <DetailRow label="Types" value={typesText} />
      </Section>

      <Section title="Availability">
        <DetailRow label="Service" value={servicesText} />
        <DetailRow label="Days" value={daysText} />
      </Section>

      <Section title="Diet & allergens">
        <DetailRow label="Dietary" value={dietText} />
        <DetailRow label="Allergens" value={allergensText} />
      </Section>

      <View style={styles.publishNote}>
        <Check size={15} color={Palette.success} strokeWidth={2.5} />
        <Text style={styles.publishText}>
          Tap Publish to make your listing live. You can edit it anytime from your kitchen hub.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Space.lg, paddingBottom: 100 },
  heading: { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    marginBottom: Space.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  coverImage: { width: '100%', height: 180 },
  coverPlaceholder: {
    width: '100%',
    height: 96,
    backgroundColor: Palette.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  cardBody: { padding: Space.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Space.sm },
  cardName: { fontFamily: Font.heading, fontSize: Type.title, color: Palette.ink, flex: 1, marginRight: Space.md },
  cardPrice: { fontFamily: Font.heading, fontSize: Type.title, color: Palette.brand },
  cardTagline: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.sm },
  cardDesc: { fontFamily: Font.body, fontSize: Type.label, color: Palette.inkSoft, lineHeight: 20, marginBottom: Space.sm },
  cardMeta: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  section: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  sectionTitle: {
    fontFamily: Font.semibold,
    fontSize: Type.micro,
    color: Palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Space.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  detailLabel: { fontFamily: Font.medium, fontSize: Type.body, color: Palette.inkSoft, flex: 1 },
  detailValue: { fontFamily: Font.body, fontSize: Type.body, color: Palette.ink, flex: 1.5, textAlign: 'right' },
  publishNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    backgroundColor: Palette.successTint,
    borderRadius: Radius.md,
    padding: Space.lg,
    marginTop: Space.sm,
  },
  publishText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.successDark, flex: 1, lineHeight: 20 },
});
