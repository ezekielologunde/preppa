import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Text, TextInput, View,
} from 'react-native';

import { BudgetPerServingPicker, Stepper, cleanBlock, cleanLine } from '@/components/bid-request-widgets';
import { RequestSuccessOverlay } from '@/components/request-success-overlay';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const DIETS = ['Vegan', 'Vegetarian', 'Halal', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto'] as const;
type Diet = typeof DIETS[number];

type FieldCardProps = { label: string; children: React.ReactNode; delay: number };
function FieldCard({ label, children, delay }: FieldCardProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 220, delay }}
      style={{
        backgroundColor: Palette.surface,
        borderRadius: 16, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: Palette.border,
      }}>
      <Text style={{
        fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary,
        letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</Text>
      {children}
    </MotiView>
  );
}

type Props = {
  kitName: string | null;
  onClose: () => void;
  onSubmit: (args: {
    title: string;
    description?: string;
    servings: number;
    budgetPerServing?: number;
    diets: Diet[];
  }) => Promise<void>;
  isPending: boolean;
};

export function PostRequestForm({ kitName, onClose, onSubmit, isPending }: Props) {
  const [reqTitle, setReqTitle] = useState(kitName ?? '');
  const [reqDesc, setReqDesc] = useState('');
  const [reqServings, setReqServings] = useState(4);
  const [reqBudgetMin, setReqBudgetMin] = useState('');
  const [reqBudgetMax, setReqBudgetMax] = useState('');
  const [reqBudget, setReqBudget] = useState<number | null>(null);
  const [selectedDiets, setSelectedDiets] = useState<Diet[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const descRef = useRef<TextInput>(null);

  function toggleDiet(diet: Diet) {
    feedback.tap();
    setSelectedDiets((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet],
    );
  }

  async function handleSubmit() {
    setPostErr(null);
    const t = cleanLine(reqTitle).trim();
    if (!t) { setTitleTouched(true); return; }
    if (t.length < 3) { setTitleTouched(true); return setPostErr('Give your request a title (at least 3 characters).'); }
    // Derive budget from min field if provided (use min as budget-per-serving baseline)
    const budgetVal = reqBudget ?? (reqBudgetMin ? parseFloat(reqBudgetMin) || undefined : undefined);
    try {
      await onSubmit({
        title: t.slice(0, 100),
        description: cleanBlock(reqDesc).trim().slice(0, 500) || undefined,
        servings: reqServings,
        budgetPerServing: budgetVal,
        diets: selectedDiets,
      });
      feedback.success();
      setShowSuccess(true);
    } catch (e) {
      feedback.error();
      setPostErr(e instanceof Error ? e.message : 'Could not post request.');
    }
  }

  const canSubmit = reqTitle.trim().length >= 3 && !isPending;
  const titleError = titleTouched && reqTitle.trim().length < 3;

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <LinearGradient
          colors={['#FFF7F0', '#FFFFFF']}
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.5, lineHeight: 32 }}>
                What are you craving?
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 4 }}>
                Tell local preppers what you need
              </Text>
            </View>
            <PressableScale
              onPress={onClose}
              haptic={false}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: Palette.canvas,
                alignItems: 'center', justifyContent: 'center',
              }}>
              <X size={17} color={Palette.inkSoft} />
            </PressableScale>
          </View>
        </LinearGradient>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>

          {/* Description field */}
          <FieldCard label="What do you want?" delay={0}>
            <TextInput
              value={reqTitle}
              onChangeText={(t) => setReqTitle(cleanLine(t))}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => { setTitleFocused(false); setTitleTouched(true); }}
              onSubmitEditing={() => descRef.current?.focus()}
              returnKeyType="next"
              maxLength={100}
              placeholder="e.g. Jerk chicken meal prep for 4"
              placeholderTextColor={Palette.textSecondary}
              accessibilityLabel="Request title"
              style={{
                height: 48, borderRadius: 12, paddingHorizontal: 14,
                fontFamily: Font.body, fontSize: 15, color: Palette.ink,
                borderWidth: 1.5,
                borderColor: titleError ? Palette.danger : titleFocused ? Palette.brand : Palette.border,
                backgroundColor: Palette.canvas,
                marginBottom: 8,
              }}
            />
            <TextInput
              ref={descRef}
              value={reqDesc}
              onChangeText={(t) => setReqDesc(cleanBlock(t))}
              onFocus={() => setDescFocused(true)}
              onBlur={() => setDescFocused(false)}
              multiline
              numberOfLines={3}
              maxLength={500}
              placeholder="Dietary needs, preferred cuisine, deadline…"
              placeholderTextColor={Palette.textSecondary}
              accessibilityLabel="Request details"
              style={{
                minHeight: 72, borderRadius: 12, padding: 14,
                fontFamily: Font.body, fontSize: 14, color: Palette.ink,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: descFocused ? Palette.brand : Palette.border,
                backgroundColor: Palette.canvas,
              }}
            />
            {titleError && (
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, marginTop: 4 }}>
                At least 3 characters required
              </Text>
            )}
            <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, textAlign: 'right', marginTop: 4 }}>
              {reqTitle.length}/100
            </Text>
          </FieldCard>

          {/* Budget range */}
          <FieldCard label="Budget Range" delay={60}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginBottom: 4 }}>Min $</Text>
                <TextInput
                  value={reqBudgetMin}
                  onChangeText={(t) => {
                    const v = t.replace(/[^0-9.]/g, '');
                    setReqBudgetMin(v);
                    const n = parseFloat(v);
                    if (!isNaN(n) && n > 0) setReqBudget(n);
                  }}
                  placeholder="8"
                  placeholderTextColor={Palette.textSecondary}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  accessibilityLabel="Minimum budget per serving"
                  style={{
                    height: 48, borderRadius: 12, paddingHorizontal: 14,
                    fontFamily: Font.body, fontSize: 15, color: Palette.ink,
                    borderWidth: 1, borderColor: Palette.border,
                    backgroundColor: Palette.canvas,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginBottom: 4 }}>Max $</Text>
                <TextInput
                  value={reqBudgetMax}
                  onChangeText={(t) => setReqBudgetMax(t.replace(/[^0-9.]/g, ''))}
                  placeholder="25"
                  placeholderTextColor={Palette.textSecondary}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  accessibilityLabel="Maximum budget per serving"
                  style={{
                    height: 48, borderRadius: 12, paddingHorizontal: 14,
                    fontFamily: Font.body, fontSize: 15, color: Palette.ink,
                    borderWidth: 1, borderColor: Palette.border,
                    backgroundColor: Palette.canvas,
                  }}
                />
              </View>
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 6 }}>
              Per serving · optional
            </Text>
          </FieldCard>

          {/* Servings */}
          <FieldCard label="Serves" delay={120}>
            <Stepper value={reqServings} onChange={setReqServings} min={1} max={100} />
          </FieldCard>

          {/* Diet chips */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220, delay: 180 }}
            style={{
              backgroundColor: Palette.surface,
              borderRadius: 16, padding: 16, marginBottom: 12,
              borderWidth: 1, borderColor: Palette.border,
            }}>
            <Text style={{
              fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary,
              letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 12,
            }}>Dietary Preferences</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
              {DIETS.map((diet) => {
                const active = selectedDiets.includes(diet);
                return (
                  <PressableScale
                    key={diet}
                    onPress={() => toggleDiet(diet)}
                    haptic={false}
                    accessibilityRole="button"
                    accessibilityLabel={`${active ? 'Remove' : 'Add'} ${diet} preference`}
                    accessibilityState={{ selected: active }}
                    style={{
                      paddingHorizontal: 14, height: 36, borderRadius: Radius.pill,
                      backgroundColor: active ? Palette.brand : Palette.canvas,
                      borderWidth: 1,
                      borderColor: active ? Palette.brand : Palette.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{
                      fontFamily: Font.semibold, fontSize: 13,
                      color: active ? '#FFFFFF' : Palette.ink,
                    }}>{diet}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </MotiView>

          {postErr && (
            <MotiView
              from={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 200 }}
              style={{
                backgroundColor: Palette.dangerTint, borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: Palette.dangerBorder, marginBottom: 8,
              }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.dangerDeep }}>{postErr}</Text>
            </MotiView>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky CTA */}
      <MotiView
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220, delay: 240 }}
        style={{
          position: 'absolute', left: 16, right: 16, bottom: Platform.OS === 'ios' ? 32 : 16,
        }}>
        <PressableScale
          onPress={handleSubmit}
          haptic={false}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Post request"
          style={{
            height: 56, borderRadius: 16,
            backgroundColor: Palette.brand,
            alignItems: 'center', justifyContent: 'center',
            opacity: canSubmit ? 1 : 0.5,
          }}>
          {isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#FFFFFF' }}>Post Request →</Text>}
        </PressableScale>
      </MotiView>

      {/* Success overlay */}
      <RequestSuccessOverlay
        visible={showSuccess}
        onDismiss={() => {
          setShowSuccess(false);
          onClose();
        }}
      />
    </View>
  );
}
