import { Rss } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Text, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedCard } from '@/components/feed-card';
import { FeedTabs, PositionDots } from '@/components/feed-ui';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { useMyFollowIds } from '@/lib/queries/follows';
import { useFeed, useFollowingFeed, type FeedItem } from '@/lib/queries/feed';
import { useAuth } from '@/providers/auth-provider';

export default function FeedScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [feedTab, setFeedTab] = useState<'following' | 'explore'>('explore');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const { data: followIds } = useMyFollowIds(user?.id);
  const followSet = useMemo(() => new Set<string>(followIds ?? []), [followIds]);

  const { data: explorePages, fetchNextPage, hasNextPage, isFetching } = useFeed();
  const { data: followingItems, isLoading: followingLoading } = useFollowingFeed(user?.id);

  const exploreItems = useMemo(
    () => (explorePages?.pages ?? []).flat(),
    [explorePages],
  );

  const items: FeedItem[] = feedTab === 'following' ? (followingItems ?? []) : exploreItems;
  const isLoading = feedTab === 'following'
    ? followingLoading
    : (isFetching && exploreItems.length === 0);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }, []);

  const renderItem = useCallback(({ item }: { item: FeedItem }) => (
    <FeedCard
      item={item}
      height={containerHeight}
      bottomInset={insets.bottom}
      followSet={followSet}
    />
  ), [containerHeight, insets.bottom, followSet]);

  function handleTabChange(t: 'following' | 'explore') {
    setFeedTab(t);
    setCurrentIndex(0);
  }

  function onEndReached() {
    if (feedTab === 'explore' && hasNextPage && !isFetching) {
      void fetchNextPage();
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
        <ListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && h !== containerHeight) setContainerHeight(h);
      }}>

      <FeedTabs tab={feedTab} onTab={handleTabChange} />

      {feedTab === 'following' && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <Rss size={40} color="rgba(255,255,255,0.35)" />
          <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff', textAlign: 'center' }}>
            Follow kitchens to see their drops here
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 240 }}>
            Switch to "for you" to discover kitchens and tap follow
          </Text>
        </View>
      ) : containerHeight > 0 ? (
        <>
          <PositionDots total={items.length} current={currentIndex} />
          <FlatList
            key={feedTab}
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            getItemLayout={(_d, i) => ({ length: containerHeight, offset: containerHeight * i, index: i })}
            snapToInterval={containerHeight}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig.current}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            windowSize={3}
            maxToRenderPerBatch={2}
            removeClippedSubviews
          />
        </>
      ) : null}
    </View>
  );
}
