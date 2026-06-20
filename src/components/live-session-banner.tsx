import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useEndLiveSession, useMyActiveLiveSession, useStartLiveSession } from '@/lib/queries/live-sessions';

const RED = '#EF4444';
const CARD = Palette.prepperCard;
const INK = '#FFFFFF';
const MUTED = '#9CA3AF';

/** Returns "Xm" or "Xh Ym" elapsed since `isoString`. Updates every minute. */
function useDuration(isoString: string | undefined | null): string {
  const [, tick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isoString) return;
    intervalRef.current = setInterval(() => tick((n) => n + 1), 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isoString]);

  if (!isoString) return '';
  const totalMins = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/** Format "2:34 PM" from ISO string */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type Props = {
  prepperId: string;
};

export function LiveSessionBanner({ prepperId }: Props) {
  const { data: session, isLoading } = useMyActiveLiveSession(prepperId);
  const startSession = useStartLiveSession(prepperId);
  const endSession = useEndLiveSession(prepperId);
  const duration = useDuration(session?.started_at);

  const isLive = !!session;

  function goLive(title?: string) {
    startSession.mutate(title?.trim() || undefined, {
      onSuccess: () => feedback.success(),
      onError: () => { feedback.error(); Alert.alert('Could not start session', 'Please try again.'); },
    });
  }

  function handleStart() {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Start live session',
        'Give your session a title (optional)',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go live', onPress: (title?: string) => goLive(title) },
        ],
        'plain-text',
        '',
      );
    } else {
      // Alert.prompt is iOS-only; start immediately with no title on Android/web
      goLive();
    }
  }

  function handleEnd() {
    if (!session) return;
    Alert.alert(
      'End live session?',
      'Your stream will end and followers will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            endSession.mutate(session.id, {
              onSuccess: () => feedback.success(),
              onError: () => { feedback.error(); Alert.alert('Could not end session', 'Please try again.'); },
            });
          },
        },
      ],
    );
  }

  if (isLoading) return null;

  return (
    <MotiView
      animate={{
        backgroundColor: isLive ? '#1A0000' : '#1A0A00',
        borderColor: isLive ? RED + '40' : Palette.brand + '30',
      }}
      transition={{ type: 'timing', duration: 260 }}
      style={{ borderRadius: 18, borderWidth: 1.5, padding: 18, gap: 12 }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {isLive ? (
          <MotiView
            from={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0.3, scale: 1.4 }}
            transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RED }}
          />
        ) : (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RED + '55' }} />
        )}

        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: isLive ? RED : INK }}>
          {isLive ? 'LIVE NOW' : 'Go LIVE'}
        </Text>
      </View>

      {/* Subtitle */}
      <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, lineHeight: 19 }}>
        {isLive
          ? `Started at ${fmtTime(session.started_at)}  ·  ${duration} ago${session.title ? `  ·  "${session.title}"` : ''}`
          : 'Share your cooking with followers in real-time'}
      </Text>

      {/* CTA */}
      <PressableScale
        onPress={isLive ? handleEnd : handleStart}
        disabled={startSession.isPending || endSession.isPending}
        accessibilityRole="button"
        accessibilityLabel={isLive ? 'End live session' : 'Start live session'}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: Radius.pill,
          backgroundColor: isLive ? RED + '22' : Palette.brand + '22',
          borderWidth: 1,
          borderColor: isLive ? RED + '55' : Palette.brand + '55',
          opacity: (startSession.isPending || endSession.isPending) ? 0.5 : 1,
        }}
      >
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: isLive ? RED : Palette.brand }}>
          {startSession.isPending || endSession.isPending
            ? isLive ? 'Ending…' : 'Starting…'
            : isLive ? 'End session' : 'Start live session'}
        </Text>
      </PressableScale>
    </MotiView>
  );
}
