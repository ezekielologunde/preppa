import { CircleCheck, QrCode } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const SITE = 'https://app.preppa.live';

/**
 * The customer's pickup/meetup proof: a big 4-digit PIN and a scannable QR.
 * The cook either keys the PIN or scans the QR to verify the handoff. Shown
 * only to the customer (RLS); hidden once the order is complete.
 */
export function HandoffCard({ pin, token, verified, label }: { pin: string; token: string; verified: boolean; label: string }) {
  if (verified) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.success + '14', borderWidth: 1, borderColor: Palette.success + '44', borderRadius: 14, padding: 12 }}>
        <CircleCheck size={18} color={Palette.success} strokeWidth={2.5} />
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#15803d' }}>Handoff verified — enjoy your meal!</Text>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: Palette.brandTint, borderRadius: 16, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <QrCode size={16} color={Palette.brandPressed} />
        <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.brandPressed }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 8 }}>
          <QRCode value={`${SITE}/verify?t=${token}`} size={96} color={INK} backgroundColor="#fff" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.brandPressed }}>Show this to your prepper, or read out the code:</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 38, letterSpacing: 8, color: ORANGE }}>{pin}</Text>
        </View>
      </View>
    </View>
  );
}
