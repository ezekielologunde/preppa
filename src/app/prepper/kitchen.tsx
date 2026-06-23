import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, MapPin, Clock, Users } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { usePrepper } from '@/lib/use-prepper';

// ── Sub-components ───────────────────────────────────────────────────────────

function SettingsRow({ icon, label, value, onPress, isSwitch, switchValue, onSwitchChange, danger }: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={isSwitch ? 1 : 0.75}
      style={styles.settingsRow}
      disabled={isSwitch}
    >
      <View style={[styles.settingsIcon, danger && styles.settingsIconDanger]}>{icon}</View>
      <Text style={[styles.settingsLabel, danger && { color: Palette.danger }]} numberOfLines={1}>{label}</Text>
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ true: Palette.brand, false: Palette.border }}
          thumbColor={Palette.surface}
        />
      ) : (
        <View style={styles.settingsRight}>
          {value ? <Text style={styles.settingsValue} numberOfLines={1}>{value}</Text> : null}
          <ChevronRight size={14} color={Palette.textMuted} strokeWidth={2} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrepperKitchenScreen() {
  const router = useRouter();
  const { kitchen, loading: kLoading, refresh } = usePrepper(true);
  const [bio, setBio] = useState('');
  const [capacity, setCapacity] = useState('');
  const [vacation, setVacation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!kitchen) return;
    setBio(kitchen.bio ?? '');
    setCapacity(kitchen.capacity != null ? String(kitchen.capacity) : '');
    setVacation(kitchen.vacation_mode ?? false);
  }, [kitchen]);

  const save = async () => {
    if (!kitchen || saving) return;
    setSaving(true);
    const cap = parseInt(capacity, 10);
    const { error } = await supabase
      .from('kitchens')
      .update({
        bio:          bio.trim() || null,
        capacity:     isNaN(cap) ? null : cap,
        vacation_mode: vacation,
      })
      .eq('id', kitchen.id)
      .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? ''); // ownership guard
    setSaving(false);
    if (error) { Alert.alert('error', error.message); return; }
    setDirty(false);
    refresh();
  };

  const toggleVacation = async (val: boolean) => {
    setVacation(val);
    setDirty(true);
    if (!kitchen) return;
    // Immediately block orders when vacation enabled — don't wait for save
    await supabase
      .from('kitchens')
      .update({ vacation_mode: val, is_open: val ? false : kitchen.is_open })
      .eq('id', kitchen.id);
  };

  if (kLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      </SafeAreaView>
    );
  }

  if (!kitchen) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>kitchen</Text>

        {/* ── Kitchen name (read-only — requires support to change) ── */}
        <View style={styles.kitchenHeader}>
          <View style={styles.kitchenInitial}>
            <Text style={styles.kitchenInitialText}>{kitchen.display_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kitchenName}>{kitchen.display_name}</Text>
            {kitchen.health_score != null && (
              <Text style={styles.kitchenHealth}>health score: {kitchen.health_score}</Text>
            )}
          </View>
        </View>

        {/* ── Bio edit ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>kitchen bio</Text>
          <TextInput
            value={bio}
            onChangeText={(v) => { setBio(v); setDirty(true); }}
            placeholder="tell customers about your kitchen…"
            placeholderTextColor={Palette.textMuted}
            style={styles.bioInput}
            multiline
            numberOfLines={3}
            maxLength={280}
          />
          <Text style={styles.charCount}>{bio.length}/280</Text>
        </View>

        {/* ── Availability ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>availability</Text>
          <View style={styles.sectionCard}>
            <SettingsRow
              icon={<AlertTriangle size={16} color={vacation ? Palette.amberDeep : Palette.brand} strokeWidth={1.8} />}
              label="vacation mode"
              isSwitch
              switchValue={vacation}
              onSwitchChange={toggleVacation}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon={<Users size={16} color={Palette.brand} strokeWidth={1.8} />}
              label="daily capacity"
              value={capacity ? `${capacity} orders` : 'unlimited'}
              onPress={() =>
                Alert.prompt('daily capacity', 'max orders per day (leave blank for unlimited)', [
                  { text: 'cancel', style: 'cancel' },
                  { text: 'save', onPress: (v) => { setCapacity(v ?? ''); setDirty(true); } },
                ], 'plain-text', capacity)
              }
            />
          </View>
          {vacation && (
            <View style={styles.vacationBanner}>
              <AlertTriangle size={14} color={Palette.amberDeep} strokeWidth={2} />
              <Text style={styles.vacationText}>vacation mode is on — your kitchen is hidden and no orders can be placed</Text>
            </View>
          )}
        </View>

        {/* ── Location ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>operations</Text>
          <View style={styles.sectionCard}>
            <SettingsRow
              icon={<MapPin size={16} color={Palette.brand} strokeWidth={1.8} />}
              label="pickup address"
              value="tap to update"
              onPress={() => {}}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon={<Clock size={16} color={Palette.brand} strokeWidth={1.8} />}
              label="business hours"
              value="tap to set"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* ── Save button ───────────────────────────────────────── */}
        {dirty && (
          <TouchableOpacity
            onPress={save}
            activeOpacity={0.85}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            {saving
              ? <ActivityIndicator color={Palette.surface} size="small" />
              : <Text style={styles.saveBtnText}>save changes</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 32 },
  headerTitle: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8, marginBottom: 16 },

  kitchenHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Palette.surface, borderRadius: 18, padding: 16, marginBottom: 16, ...Shadow.card },
  kitchenInitial: { width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' },
  kitchenInitialText: { fontFamily: Font.display, fontSize: 22, color: Palette.surface },
  kitchenName: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  kitchenHealth: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },

  card: { backgroundColor: Palette.surface, borderRadius: 18, padding: 16, marginBottom: 16, ...Shadow.card },
  fieldLabel: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  bioInput: { fontFamily: Font.body, fontSize: Type.body, color: Palette.ink, lineHeight: 22, minHeight: 72, textAlignVertical: 'top' },
  charCount: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, textAlign: 'right', marginTop: 4 },

  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: Palette.surface, borderRadius: 18, overflow: 'hidden', ...Shadow.card },

  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  settingsIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  settingsIconDanger: { backgroundColor: Palette.dangerTint },
  settingsLabel: { flex: 1, fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink },
  settingsRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingsValue: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, maxWidth: 140 },

  rowDivider: { height: 1, backgroundColor: Palette.border, marginLeft: 64 },

  vacationBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Palette.amberTint, borderRadius: 12, padding: 12, marginTop: 8 },
  vacationText: { flex: 1, fontFamily: Font.body, fontSize: Type.micro, color: Palette.amberDeep, lineHeight: 18 },

  saveBtn: { backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontFamily: Font.display, fontSize: Type.body, color: Palette.surface },
});
