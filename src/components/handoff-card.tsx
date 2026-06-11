import { CircleCheck, QrCode } from 'lucide-react-native';
import { MotiView } from 'moti';
import QRCode from 'react-native-qrcode-svg';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

const ORANGE = Palette.brand;
const SITE = 'https://app.preppa.live';

// A few on-brand gradient palettes; each order gets a different one (seeded by
// its token) so every generated QR looks distinct and fun.
const QR_GRADIENTS: [string, string][] = [
  ['#F15F22', '#D9430F'],
  ['#FF814A', '#C2410C'],
  ['#F97316', '#DB2777'],
  ['#FB923C', '#9333EA'],
  ['#F59E0B', '#EA580C'],
  ['#EF4444', '#F15F22'],
];

function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return QR_GRADIENTS[h % QR_GRADIENTS.length];
}

/**
 * The customer's pickup/meetup proof: a big 3-digit code and a scannable QR
 * with a fun, per-order gradient + the Preppa flame in the middle. The cook
 * keys the code or scans the QR to verify. Customer-only (RLS); hidden once
 * the handoff is complete.
 */
export function HandoffCard({ pin, token, verified, label }: { pin: string; token: string; verified: boolean; label: string }) {
  if (verified) {
    return (
      <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', duration: 340, bounce: 0.15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.success + '14', borderWidth: 1, borderColor: Palette.success + '44', borderRadius: 14, padding: 12 }}>
          <CircleCheck size={18} color={Palette.success} strokeWidth={2.5} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#15803d' }}>Handoff verified — enjoy your meal!</Text>
        </View>
      </MotiView>
    );
  }
  const [g1, g2] = gradientFor(token);
  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
    <View style={{ backgroundColor: Palette.brandTint, borderRadius: 16, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <QrCode size={16} color={Palette.brandPressed} />
        <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.brandPressed }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 10, shadowColor: g2, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <QRCode
            value={`${SITE}/verify?t=${token}`}
            size={96}
            backgroundColor="#fff"
            enableLinearGradient
            linearGradient={[g1, g2]}
            gradientDirection={['0', '0', '170', '170']}
            ecl="H"
            quietZone={2}
          />
          {/* Flame chip in the centre — sits in the QR's high error-correction zone */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 19, height: 19, borderRadius: 6, backgroundColor: g1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11 }}>🔥</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.brandPressed }}>Show this to your prepper, or read out the code:</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 42, letterSpacing: 10, color: ORANGE }}>{pin}</Text>
        </View>
      </View>
    </View>
    </MotiView>
  );
}
