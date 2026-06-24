import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, FileText, Image as ImageIcon, User } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import type { ApplicationForm } from '@/app/apply/index';

type Props = {
  form: ApplicationForm;
};

function Card({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {icon}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, muted && styles.rowValueMuted]}>{value || '—'}</Text>
    </View>
  );
}

function AttestRow({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.attestRow}>
      <CheckCircle
        size={16}
        color={checked ? Palette.success : Palette.border}
        strokeWidth={2}
      />
      <Text style={[styles.attestText, !checked && styles.attestMissing]}>{label}</Text>
    </View>
  );
}

export function ReviewStep({ form }: Props) {
  const specialtiesList = form.specialties
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');

  const expYears = form.experienceYears
    ? `${form.experienceYears} year${form.experienceYears === '1' ? '' : 's'}`
    : 'Not specified';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Review your application</Text>
      <Text style={styles.sub}>Check everything looks correct before submitting. You can go back to edit.</Text>

      <Card icon={<User size={16} color={Palette.brand} strokeWidth={2} />} title="Personal details">
        <Row label="Legal name"       value={form.legalName} />
        <Row label="Postcode"         value={form.postcode} />
        <Row label="Kitchen address"  value={form.kitchenAddress} muted={!form.kitchenAddress} />
        <Row label="Bio"              value={form.bio || 'Not provided'} muted={!form.bio} />
        <Row label="Experience"       value={expYears} muted={!form.experienceYears} />
        <Row label="Specialities"     value={specialtiesList || 'Not specified'} muted={!specialtiesList} />
      </Card>

      <Card icon={<ImageIcon size={16} color={Palette.brand} strokeWidth={2} />} title="Kitchen photos">
        {form.kitchenPhotos.length === 0 ? (
          <Text style={styles.emptyNote}>No photos added.</Text>
        ) : (
          <View style={styles.photoRow}>
            {form.kitchenPhotos.map((photo, i) => (
              <View key={photo.id} style={styles.thumbWrap}>
                <Image source={{ uri: photo.uri }} style={styles.thumb} resizeMode="cover" />
                {i === 0 && (
                  <View style={styles.thumbBadge}>
                    <Text style={styles.thumbBadgeText}>Main</Text>
                  </View>
                )}
              </View>
            ))}
            <Text style={styles.photoCount}>{form.kitchenPhotos.length} photo{form.kitchenPhotos.length !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </Card>

      <Card icon={<FileText size={16} color={Palette.brand} strokeWidth={2} />} title="Food safety certificate">
        {form.foodSafetyCertUri ? (
          <>
            <View style={styles.certRow}>
              <CheckCircle size={16} color={Palette.success} strokeWidth={2} />
              <Text style={styles.certUploaded}>Certificate uploaded</Text>
            </View>
            {form.certExpirationDate ? (
              <Row label="Expiry date" value={form.certExpirationDate} />
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyNote}>No certificate uploaded. You can submit without one, but approval may be slower.</Text>
        )}
      </Card>

      <Card icon={<CheckCircle size={16} color={Palette.brand} strokeWidth={2} />} title="Legal declarations">
        <AttestRow checked={form.insuranceAttested}       label="Public liability insurance confirmed" />
        <AttestRow checked={form.contractorAttested}      label="Self-employment status acknowledged" />
        <AttestRow checked={form.natashsLawAcknowledged}  label="Natasha's Law obligations acknowledged" />
      </Card>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          By submitting, you confirm all information is accurate and up to date. Our Trust & Safety team will review your application within 3–5 business days.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { paddingHorizontal: Space.lg, paddingBottom: 120 },
  heading:       { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub:           { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl, lineHeight: 22 },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Space.lg,
    marginBottom: Space.md,
    ...Shadow.card,
  },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.md },
  cardTitle:     { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink },
  row:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Space.sm, gap: Space.lg },
  rowLabel:      { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, flexShrink: 0 },
  rowValue:      { fontFamily: Font.medium, fontSize: Type.label, color: Palette.ink, flex: 1, textAlign: 'right' },
  rowValueMuted: { color: Palette.textMuted, fontFamily: Font.body },
  emptyNote:     { fontFamily: Font.body, fontSize: Type.label, color: Palette.textMuted, lineHeight: 20 },
  photoRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md, alignItems: 'center' },
  thumbWrap:     { position: 'relative' },
  thumb:         { width: 64, height: 64, borderRadius: Radius.md },
  thumbBadge: {
    position: 'absolute', bottom: 3, left: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.pill,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  thumbBadgeText: { fontFamily: Font.semibold, fontSize: 8, color: Palette.surface },
  photoCount:    { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, alignSelf: 'flex-end' },
  certRow:       { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.sm },
  certUploaded:  { fontFamily: Font.medium, fontSize: Type.label, color: Palette.success },
  attestRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm, marginBottom: Space.sm },
  attestText:    { flex: 1, fontFamily: Font.body, fontSize: Type.label, color: Palette.ink, lineHeight: 20 },
  attestMissing: { color: Palette.danger },
  notice: {
    backgroundColor: Palette.chip,
    borderRadius: Radius.md,
    padding: Space.lg,
    marginTop: Space.md,
  },
  noticeText:    { fontFamily: Font.body, fontSize: Type.label, color: Palette.inkSoft, lineHeight: 20 },
});
