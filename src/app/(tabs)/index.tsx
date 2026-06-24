import { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ChevronDown, ChevronRight, MapPin, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Font } from '@/constants/fonts';
import { Gradients, Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { greeting } from '@/lib/greeting';

// ── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  emoji: string;
  label: string;
  query: string;
};

type MealCard = {
  id: string;
  name: string;
  kitchen: string;
  time: string;
  pricePence: number;
  tag: string;
  tagColor: string;
  foodColor: readonly [string, string];
};

// ── Static data (replace with React Query from searchListings() once live) ───

const CATEGORIES: Category[] = [
  { id: 'breakfast', emoji: '☀️', label: 'breakfast', query: 'breakfast' },
  { id: 'lunch',     emoji: '🥗', label: 'lunch',     query: 'lunch' },
  { id: 'dinner',    emoji: '🍲', label: 'dinner',    query: 'dinner' },
  { id: 'healthy',   emoji: '🌿', label: 'healthy',   query: 'healthy' },
  { id: 'vegan',     emoji: '🌸', label: 'vegan',     query: 'vegan' },
];

const MEAL_CARDS: MealCard[] = [
  {
    id: '1',
    name: 'honey garlic salmon',
    kitchen: "kelsi's kitchen",
    time: '30–40 min',
    pricePence: 1499,
    tag: '🔥 popular',
    tagColor: Palette.brand,
    foodColor: Gradients.mealWarm,
  },
  {
    id: '2',
    name: 'creamy jerk pasta',
    kitchen: 'island bites',
    time: '25–35 min',
    pricePence: 1349,
    tag: '✓ new',
    tagColor: Palette.success,
    foodColor: Gradients.mealGold,
  },
  {
    id: '3',
    name: 'wellness bowl',
    kitchen: 'green plates',
    time: '20–30 min',
    pricePence: 1249,
    tag: '✓ healthy',
    tagColor: Palette.success,
    foodColor: Gradients.mealGreen,
  },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function CategoryPill({
  item,
  active,
  onPress,
}: {
  item: Category;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={styles.pillEmoji}>{item.emoji}</Text>
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

function MealCardItem({ item }: { item: MealCard }) {
  const router = useRouter();
  const price = (item.pricePence / 100).toFixed(2);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/meal/${item.id}` as never)}
      activeOpacity={0.82}
      style={styles.mealCard}
    >
      <View style={styles.mealPhoto}>
        <LinearGradient
          colors={item.foodColor}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.8, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.mealTag}>
          <Text style={styles.mealTagText}>{item.tag}</Text>
        </View>
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.mealName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.mealKitchen} numberOfLines={1}>by {item.kitchen}</Text>
        <View style={styles.mealMeta}>
          <Text style={styles.mealTime}>{item.time}</Text>
          <Text style={styles.mealPrice}>${price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('breakfast');
  const greet = greeting();

  const handleSearch = () => router.push('/search' as never);
  const handleSurpriseMe = () => router.push('/search' as never);
  const handleSeeAll = () => router.push('/search' as never);
  const handleRewards = () => router.push('/profile' as never);
  const handleLocation = () => {};

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Avatar */}
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={Gradients.avatarPlaceholder}
                style={styles.avatar}
              />
              <View style={styles.onlineDot} />
            </View>
            {/* Greeting text */}
            <View>
              <Text style={styles.greetSub}>{greet} 👋</Text>
              <Text style={styles.greetMain}>
                what are you{'\n'}
                <Text style={styles.greetAccent}>craving today?</Text>
              </Text>
            </View>
          </View>
          {/* Notification bell */}
          <TouchableOpacity
            onPress={() => router.push('/inbox' as never)}
            activeOpacity={0.7}
            style={styles.bellBtn}
          >
            <Bell size={20} color={Palette.ink} strokeWidth={1.8} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        {/* ── Location ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleLocation}
          activeOpacity={0.7}
          style={styles.locationRow}
        >
          <MapPin size={13} color={Palette.brand} fill={Palette.brand} />
          <Text style={styles.locationText}>New York, NY</Text>
          <ChevronDown size={14} color={Palette.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        {/* ── Search bar ───────────────────────────────────────────────── */}
        <Pressable onPress={handleSearch} style={styles.searchBar}>
          <Search size={16} color={Palette.textSecondary} strokeWidth={2} />
          <Text style={styles.searchPlaceholder}>
            search for meals, kitchens…
          </Text>
        </Pressable>

        {/* ── Category pills ───────────────────────────────────────────── */}
        <FlatList
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillList}
          renderItem={({ item }) => (
            <CategoryPill
              item={item}
              active={activeCategory === item.id}
              onPress={() => {
                setActiveCategory(item.id);
                router.push(`/search?q=${item.query}` as never);
              }}
            />
          )}
        />

        {/* ── Surprise Me banner ───────────────────────────────────────── */}
        <View style={styles.surpriseBanner}>
          <View style={styles.surpriseLeft}>
            <Text style={styles.surpriseTitle}>chef surprise me</Text>
            <Text style={styles.surpriseSub}>
              tell us your mood,{'\n'}we'll pick the perfect meal
            </Text>
            <TouchableOpacity
              onPress={handleSurpriseMe}
              activeOpacity={0.85}
              style={styles.surpriseBtn}
            >
              <Text style={styles.surpriseBtnText}>surprise me 🪄</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.surprisePhoto}>
            <LinearGradient
              colors={Gradients.surpriseBanner}
              style={styles.surprisePhotoGradient}
            />
          </View>
        </View>

        {/* ── Recommended for you ──────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>recommended for you</Text>
          <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>see all</Text>
            <ChevronRight size={13} color={Palette.brand} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={MEAL_CARDS}
          keyExtractor={(m) => m.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mealList}
          renderItem={({ item }) => <MealCardItem item={item} />}
        />

        {/* ── Rewards banner ───────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleRewards}
          activeOpacity={0.85}
          style={styles.rewardsBanner}
        >
          <View style={styles.rewardsIcon}>
            <Text style={styles.rewardsEmoji}>🎁</Text>
          </View>
          <View style={styles.rewardsText}>
            <Text style={styles.rewardsTitle}>
              you have <Text style={styles.rewardsPoints}>350 points</Text>
            </Text>
            <Text style={styles.rewardsSub}>
              unlock rewards & save on your next order
            </Text>
          </View>
          <View style={styles.rewardsBtn}>
            <Text style={styles.rewardsBtnText}>view →</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  scroll: { paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xl,
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarWrap: { position: 'relative', width: 54, height: 54 },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2.5, borderColor: Palette.brand,
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Palette.success,
    borderWidth: 2, borderColor: Palette.surface,
  },
  greetSub: {
    fontFamily: Font.semibold, fontSize: Type.label,
    color: Palette.textSecondary, marginBottom: 2,
  },
  greetMain: {
    fontFamily: Font.display, fontSize: 24,
    color: Palette.ink, letterSpacing: -0.8, lineHeight: 28,
  },
  greetAccent: { color: Palette.brand },
  bellBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: Palette.surface,
    borderWidth: 1, borderColor: Palette.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    ...Shadow.card,
  },
  bellDot: {
    position: 'absolute', top: 7, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Palette.brand,
    borderWidth: 1.5, borderColor: Palette.surface,
  },

  // Location
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Space.xl, marginBottom: 14,
  },
  locationText: {
    fontFamily: Font.display, fontSize: Type.label,
    color: Palette.ink,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Space.xl, marginBottom: 18,
    height: 48, borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1, borderColor: Palette.border,
    paddingHorizontal: 16,
    ...Shadow.card,
  },
  searchPlaceholder: {
    fontFamily: Font.body, fontSize: Type.body,
    color: Palette.textMuted, flex: 1,
  },

  // Category pills
  pillList: { paddingLeft: Space.xl, paddingRight: 8, marginBottom: 20 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: Palette.chip,
    marginRight: 8,
  },
  pillActive: { backgroundColor: Palette.brand },
  pillEmoji: { fontSize: 15 },
  pillLabel: {
    fontFamily: Font.semibold, fontSize: Type.label,
    color: Palette.inkSoft,
  },
  pillLabelActive: { color: Palette.surface },

  // Surprise Me banner
  surpriseBanner: {
    marginHorizontal: Space.xl, marginBottom: 22,
    borderRadius: 22, backgroundColor: Palette.brandTint,
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 20, paddingRight: 0,
    paddingVertical: 20, overflow: 'hidden', minHeight: 120,
  },
  surpriseLeft: { flex: 1, paddingRight: 8 },
  surpriseTitle: {
    fontFamily: Font.display, fontSize: 22,
    color: Palette.ink, letterSpacing: -0.6, lineHeight: 26, marginBottom: 6,
  },
  surpriseSub: {
    fontFamily: Font.semibold, fontSize: Type.label,
    color: Palette.textSecondary, lineHeight: 19, marginBottom: 14,
  },
  surpriseBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.ink, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  surpriseBtnText: {
    fontFamily: Font.display, fontSize: Type.label, color: Palette.surface,
  },
  surprisePhoto: {
    width: 110, height: 110, borderRadius: 55,
    overflow: 'hidden', marginRight: -8, flexShrink: 0,
  },
  surprisePhotoGradient: { flex: 1 },

  // Section row
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Space.xl, marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Font.display, fontSize: Type.title,
    color: Palette.ink, letterSpacing: -0.3,
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: {
    fontFamily: Font.semibold, fontSize: Type.label, color: Palette.brand,
  },

  // Meal cards
  mealList: { paddingLeft: Space.xl, paddingRight: 8, marginBottom: 22 },
  mealCard: {
    width: 164, borderRadius: 18,
    backgroundColor: Palette.surface,
    marginRight: 12, overflow: 'hidden',
    ...Shadow.card,
  },
  mealPhoto: {
    height: 130, borderRadius: 0, overflow: 'hidden', position: 'relative',
  },
  mealTag: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.48)', borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  mealTagText: {
    fontFamily: Font.display, fontSize: 11, color: Palette.surface,
  },
  mealInfo: { padding: 12, gap: 3 },
  mealName: {
    fontFamily: Font.display, fontSize: 14,
    color: Palette.ink, lineHeight: 18,
  },
  mealKitchen: {
    fontFamily: Font.body, fontSize: Type.micro,
    color: Palette.textSecondary,
  },
  mealMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 4,
  },
  mealTime: {
    fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary,
  },
  mealPrice: {
    fontFamily: Font.display, fontSize: Type.label, color: Palette.brand,
  },

  // Rewards banner
  rewardsBanner: {
    marginHorizontal: Space.xl, marginBottom: 8,
    borderRadius: 20, backgroundColor: Palette.successTint,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  rewardsIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: Palette.success,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  rewardsEmoji: { fontSize: 20 },
  rewardsText: { flex: 1 },
  rewardsTitle: {
    fontFamily: Font.display, fontSize: 15, color: Palette.ink,
  },
  rewardsPoints: { color: Palette.success },
  rewardsSub: {
    fontFamily: Font.body, fontSize: Type.micro,
    color: Palette.textSecondary, marginTop: 2,
  },
  rewardsBtn: {
    backgroundColor: Palette.ink, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0,
  },
  rewardsBtnText: {
    fontFamily: Font.display, fontSize: Type.micro, color: Palette.surface,
  },

  bottomPad: { height: 32 },
});
