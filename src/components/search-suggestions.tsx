/**
 * SearchSuggestionsPanel
 *
 * Rendered below the search bar. Shows two modes:
 *  • typing (query.length >= 2): live autocomplete from meals + kitchens
 *  • focused + empty: recent searches list + trending chips
 */
import { Flame, TrendingUp, UtensilsCrossed, ChefHat, Clock, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useSearchSuggestions, useTrendingSearches, type SuggestionItem } from '@/lib/queries/search';
import { clearRecentSearches, removeSearch } from '@/lib/recent-searches';

const ORANGE = Palette.brand;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontFamily: Font.display, fontSize: 14, color: Palette.ink, letterSpacing: -0.3, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 }}>
      {children}
    </Text>
  );
}

function SuggestionRow({ item, onPress }: { item: SuggestionItem; onPress: () => void }) {
  const Icon = item.type === 'kitchen' ? ChefHat : UtensilsCrossed;
  return (
    <PressableScale
      onPress={() => { feedback.tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`Search for ${item.label}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 }}>
      <Icon size={16} color={Palette.textSecondary} />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.medium, fontSize: 14.5, color: Palette.ink }}>
        {item.label}
      </Text>
    </PressableScale>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export type SearchSuggestionsPanelProps = {
  query: string;
  recent: string[];
  onSelectTerm: (term: string) => void;
};

export function SearchSuggestionsPanel({ query, recent, onSelectTerm }: SearchSuggestionsPanelProps) {
  const isTyping = query.trim().length >= 2;
  const { data: suggestions = [], isFetching } = useSearchSuggestions(query);
  const { data: trending = [] } = useTrendingSearches();

  // When query >= 2 chars: show autocomplete
  if (isTyping) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: -6 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: -6 }}
        transition={{ type: 'timing', duration: 180 }}
        style={{
          marginHorizontal: 16,
          marginTop: 6,
          backgroundColor: Palette.surface,
          borderRadius: 16,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          overflow: 'hidden',
        }}>
        {isFetching && suggestions.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={ORANGE} />
          </View>
        ) : suggestions.length === 0 ? null : (
          suggestions.map((item, i) => (
            <View key={`${item.type}-${item.label}`}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: Palette.divider, marginLeft: 44 }} /> : null}
              <SuggestionRow item={item} onPress={() => onSelectTerm(item.label)} />
            </View>
          ))
        )}
      </MotiView>
    );
  }

  // When focused but empty: show recent + trending
  const hasRecent = recent.length > 0;
  const hasTrending = trending.length > 0;
  if (!hasRecent && !hasTrending) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -6 }}
      transition={{ type: 'timing', duration: 200 }}
      style={{
        marginHorizontal: 16,
        marginTop: 6,
        backgroundColor: Palette.surface,
        borderRadius: 16,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        overflow: 'hidden',
        paddingBottom: 12,
      }}>
      {/* Recent searches */}
      {hasRecent ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 14, color: Palette.ink, letterSpacing: -0.3 }}>recent</Text>
            <Pressable
              onPress={() => { feedback.tap(); clearRecentSearches(); }}
              accessibilityRole="button"
              accessibilityLabel="Clear all recent searches"
              hitSlop={10}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary }}>clear all</Text>
            </Pressable>
          </View>
          {recent.slice(0, 5).map((term) => (
            <View key={term} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <Clock size={15} color={Palette.textSecondary} />
              <PressableScale
                onPress={() => { feedback.tap(); onSelectTerm(term); }}
                accessibilityRole="button"
                accessibilityLabel={`Search ${term}`}
                style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 14.5, color: Palette.ink }}>{term}</Text>
              </PressableScale>
              <Pressable
                onPress={() => { feedback.tap(); removeSearch(term); }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${term}`}
                hitSlop={10}
                style={{ padding: 4 }}>
                <X size={15} color={Palette.textSecondary} />
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {/* Divider between sections */}
      {hasRecent && hasTrending ? (
        <View style={{ height: 1, backgroundColor: Palette.divider, marginHorizontal: 16, marginTop: 8 }} />
      ) : null}

      {/* Trending chips */}
      {hasTrending ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <Flame size={14} color={ORANGE} />
            <Text style={{ fontFamily: Font.display, fontSize: 14, color: Palette.ink, letterSpacing: -0.3 }}>trending</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
            {trending.slice(0, 6).map((term) => (
              <PressableScale
                key={term}
                onPress={() => { feedback.tap(); onSelectTerm(term); }}
                accessibilityRole="button"
                accessibilityLabel={`Trending: ${term}`}
                style={{
                  paddingHorizontal: 14,
                  height: 34,
                  borderRadius: Radius.pill,
                  backgroundColor: Palette.brandTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE }}>{term}</Text>
              </PressableScale>
            ))}
          </View>
        </>
      ) : null}
    </MotiView>
  );
}
