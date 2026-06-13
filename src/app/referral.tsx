import { useRouter } from 'expo-router';
import { ChevronLeft, Copy, Gift, Share2, Ticket, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

const APP_URL = 'https://app.preppa.live';

function referralCode(userId: string): string {
  return 'PREP-' + userId.replace(/-/g, '').slice(0, 6).toUpperCase();
}

const HOW_IT_WORKS = [
  { Icon: Ticket, color: Palette.brand, title: 'share your code', body: 'Send your unique referral code to friends and family.' },
  { Icon: Users, color: '#a78bfa', title: 'they sign up', body: 'Your friend creates an account and places their first preorder.' },
  { Icon: Gift, color: Palette.success, title: 'you both earn', body: 'You get $5 in Preppa credits. They get $5 off their first preorder.' },
];

export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const code = user ? referralCode(user.id) : 'PREP-XXXXXX';
  const shareMessage = `Join Preppa — home-cooked meals from local kitchens! Use my code ${code} for $5 off your first order: ${APP_URL}`;

  async function handleShare() {
    feedback.tap();
    try {
      await Share.share({ message: shareMessage });
    } catch {
      /* share sheet unavailable */
    }
  }

  function handleCopy() {
    feedback.success();
    try {
      (navigator as unknown as { clipboard?: { writeText?: (s: string) => void } })
        ?.clipboard
        ?.writeText?.(code);
    } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.8 }}>referrals</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>give $5, get $5</Text>
          </View>
        </View>

        {/* Hero code card */}
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 300 }}
          style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <View
            style={{
              backgroundColor: Palette.ink,
              borderRadius: 24,
              padding: 24,
              gap: 16,
              alignItems: 'center',
              ...Shadow.floating,
            }}>
            <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: Palette.brand + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Palette.brand + '40' }}>
              <Gift size={28} color={Palette.brand} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.4 }}>your referral code</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 34, color: '#fff', letterSpacing: 2 }}>{code}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <PressableScale
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel="Copy referral code"
                style={{ flex: 1, height: 50, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Copy size={16} color={copied ? Palette.success : '#fff'} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: copied ? Palette.success : '#fff' }}>
                  {copied ? 'copied!' : 'copy code'}
                </Text>
              </PressableScale>
              <PressableScale
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel="Share referral link"
                style={{ flex: 1, height: 50, borderRadius: Radius.md, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Share2 size={16} color="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>share</Text>
              </PressableScale>
            </View>
          </View>
        </MotiView>

        {/* How it works */}
        <View style={{ paddingHorizontal: 20, gap: 4 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>how it works</Text>
          {HOW_IT_WORKS.map(({ Icon, color, title, body }, i) => (
            <MotiView
              key={title}
              from={{ opacity: 0, translateX: -10 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 240, delay: 160 + i * 45 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, borderBottomWidth: i < HOW_IT_WORKS.length - 1 ? 1 : 0, borderColor: Palette.border }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={19} color={color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: Palette.ink }}>{title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 18 }}>{body}</Text>
                </View>
              </View>
            </MotiView>
          ))}
        </View>

        {/* Fine print */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, lineHeight: 17 }}>
            Credits are applied automatically after your referee's first order is confirmed. One credit per referral. Credits do not expire.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
