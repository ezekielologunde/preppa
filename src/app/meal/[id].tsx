import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Clock, Heart, Share2, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Font } from '@/constants/fonts';
import { Gradients, Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

// ── Types ────────────────────────────────────────────────────────────────────

type KitchenSnap = {
  id: string;
  display_name: string;
  bio: string | null;
  health_score: number | null;
};

type Listing = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_pence: number;
  servings: number | null;
  dietary_tags: string[] | null;
  allergens: string[] | null;
  kitchen: KitchenSnap | KitchenSnap[] | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const GRADIENTS = [
  Gradients.brand,
  Gradients.mealWarm,
  Gradients.mealGold,
  Gradients.mealGreen,
  Gradients.mealBlue,
] as const;

function pickGradient(id: string): readonly [string, string] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

function resolveKitchen(k: Listing['kitchen']): KitchenSnap | null {
  if (!k) return null;
  if (Array.isArray(k)) return k[0] ?? null;
  return k;
}

// ── Screen ───────────────────────────────────────────────────────────────────

const HERO_HEIGHT = 280;

export default function MealDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const { user }  = useAuth();

  const [listing, setListing]   = useState<Listing | null>(null);
  const [loading, setLoading]   = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [qty, setQty]           = useState(1);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    supabase
      .from('listings')
      .select(
        'id, name, tagline, description, price_pence, servings, dietary_tags, allergens, ' +
        'kitchen:kitchens(id, display_name, bio, health_score)',
      )
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setListing(data as Listing | null);
        setLoading(false);
      });
  }, [id]);

  const handleOrder = useCallback(async () => {
    if (!listing) return;
    if (!user) { router.push('/auth' as never); return; }
    setOrdering(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { listing_id: listing.id, quantity: qty },
      });
      if (error) throw error;
      if (data?.url) await Linking.openURL(data.url);
    } catch (e) {
      console.error('[meal] checkout:', e);
    } finally {
      setOrdering(false);
    }
  }, [listing, user, qty, router]);

  const gradients = listing ? pickGradient(listing.id) : Gradients.brand;
  const kitchen   = listing ? resolveKitchen(listing.kitchen) : null;
  const price     = listing ? `£${(listing.price_pence / 100).toFixed(2)}` : '—';
  const total     = listing ? `£${((listing.price_pence * qty) / 100).toFixed(2)}` : '—';

  return (
    <View style={styles.root}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <LinearGradient
          colors={gradients}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['top']} style={styles.heroNav}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={styles.heroBtn}
          >
            <ArrowLeft size={18} color={Palette.surface} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.heroBtnGroup}>
            <TouchableOpacity activeOpacity={0.75} style={styles.heroBtn}>
              <Heart size={18} color={Palette.surface} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.heroBtn}>
              <Share2 size={18} color={Palette.surface} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* ── Scrollable body ──────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.centerWrap}>
            <ActivityIndicator color={Palette.brand} />
          </View>
        )}

        {!loading && !listing && (
          <View style={styles.centerWrap}>
            <Text style={styles.errorTitle}>meal not found</Text>
            <Text style={styles.errorSub}>this meal may no longer be available</Text>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>go back</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && listing && (
          <>
            {/* ── Name + price ─────────────────────────────── */}
            <View style={styles.mealHeader}>
              <View style={styles.mealHeaderRow}>
                <Text style={styles.mealName}>{listing.name}</Text>
                <Text style={styles.mealPrice}>{price}</Text>
              </View>
              {listing.tagline ? (
                <Text style={styles.mealTagline}>{listing.tagline}</Text>
              ) : null}
              <View style={styles.metaRow}>
                {listing.servings ? (
                  <View style={styles.metaChip}>
                    <Users size={12} color={Palette.textSecondary} strokeWidth={1.8} />
                    <Text style={styles.metaText}>{listing.servings} servings</Text>
                  </View>
                ) : null}
                <View style={styles.metaChip}>
                  <Clock size={12} color={Palette.textSecondary} strokeWidth={1.8} />
                  <Text style={styles.metaText}>30–45 min</Text>
                </View>
              </View>
            </View>

            {/* ── Kitchen ──────────────────────────────────── */}
            {kitchen && (
              <View style={styles.kitchenCard}>
                <View style={styles.kitchenAvatar}>
                  <Text style={styles.kitchenInitial}>
                    {kitchen.display_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.kitchenInfo}>
                  <Text style={styles.kitchenName}>{kitchen.display_name}</Text>
                  {kitchen.health_score != null && (
                    <Text style={styles.kitchenMeta}>
                      ⭐ {kitchen.health_score.toFixed(1)} health score
                    </Text>
                  )}
                  {kitchen.bio ? (
                    <Text style={styles.kitchenBio} numberOfLines={2}>{kitchen.bio}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ── Description ──────────────────────────────── */}
            {listing.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>about this meal</Text>
                <Text style={styles.description}>{listing.description}</Text>
              </View>
            ) : null}

            {/* ── Dietary tags ─────────────────────────────── */}
            {(listing.dietary_tags ?? []).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>dietary</Text>
                <View style={styles.tagRow}>
                  {listing.dietary_tags!.map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Allergens ────────────────────────────────── */}
            {(listing.allergens ?? []).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>allergens</Text>
                <View style={styles.tagRow}>
                  {listing.allergens!.map((a) => (
                    <View key={a} style={[styles.tag, styles.allergenTag]}>
                      <Text style={[styles.tagText, styles.allergenText]}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Quantity ─────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>quantity</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  activeOpacity={0.7}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => setQty((q) => Math.min(10, q + 1))}
                  activeOpacity={0.7}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.bottomPad} />
          </>
        )}
      </ScrollView>

      {/* ── Fixed bottom CTA (thumb zone) ───────────────────────── */}
      {listing && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View style={styles.bottomInner}>
            <View>
              <Text style={styles.totalLabel}>total</Text>
              <Text style={styles.totalPrice}>{total}</Text>
            </View>
            <TouchableOpacity
              onPress={handleOrder}
              activeOpacity={0.88}
              disabled={ordering}
              style={[styles.orderBtn, ordering && styles.orderBtnLoading]}
            >
              {ordering ? (
                <ActivityIndicator color={Palette.surface} size="small" />
              ) : (
                <Text style={styles.orderBtnText}>order now</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },

  // Hero
  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  heroNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Space.xl, paddingTop: 8,
  },
  heroBtnGroup: { flexDirection: 'row', gap: 8 },
  heroBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Space.xl, paddingTop: 20 },

  // States
  centerWrap: { paddingTop: 60, alignItems: 'center' },
  errorTitle: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, marginBottom: 8 },
  errorSub: {
    fontFamily: Font.body, fontSize: Type.body,
    color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  errorBtn: {
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  errorBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  // Meal header
  mealHeader: { marginBottom: 20 },
  mealHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6,
  },
  mealName: {
    fontFamily: Font.display, fontSize: Type.display,
    color: Palette.ink, letterSpacing: -0.6, lineHeight: 28,
    flex: 1, marginRight: 12,
  },
  mealPrice: { fontFamily: Font.display, fontSize: Type.title, color: Palette.brand },
  mealTagline: {
    fontFamily: Font.body, fontSize: Type.body,
    color: Palette.textSecondary, lineHeight: 22, marginBottom: 14,
  },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Palette.chip, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  metaText: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary },

  // Kitchen
  kitchenCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: Palette.surface, borderRadius: 16,
    padding: 16, marginBottom: 20, ...Shadow.card,
  },
  kitchenAvatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  kitchenInitial: { fontFamily: Font.display, fontSize: Type.title, color: Palette.brand },
  kitchenInfo: { flex: 1 },
  kitchenName: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  kitchenMeta: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },
  kitchenBio: {
    fontFamily: Font.body, fontSize: Type.micro,
    color: Palette.textSecondary, lineHeight: 17, marginTop: 4,
  },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: Font.display, fontSize: Type.label,
    color: Palette.ink, letterSpacing: -0.2, marginBottom: 10,
  },
  description: { fontFamily: Font.body, fontSize: Type.body, color: Palette.inkSoft, lineHeight: 24 },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: Palette.brandTint, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  tagText: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.brandPressed },
  allergenTag: { backgroundColor: Palette.amberTint },
  allergenText: { color: Palette.amberDeep },

  // Quantity
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Palette.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink },
  qtyValue: {
    fontFamily: Font.display, fontSize: Type.title,
    color: Palette.ink, minWidth: 24, textAlign: 'center',
  },

  bottomPad: { height: 120 },

  // CTA bar
  bottomBar: {
    backgroundColor: Palette.surface,
    borderTopWidth: 1, borderTopColor: Palette.border,
    ...Shadow.navBar,
  },
  bottomInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, paddingVertical: 12,
  },
  totalLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },
  totalPrice: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink },
  orderBtn: {
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 40, paddingVertical: 16,
    minWidth: 160, alignItems: 'center',
  },
  orderBtnLoading: { backgroundColor: Palette.textMuted },
  orderBtnText: { fontFamily: Font.display, fontSize: Type.body, color: Palette.surface },
});
