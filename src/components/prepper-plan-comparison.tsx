import { Check, X } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

const ORANGE  = Palette.brand;
const CARD    = Palette.surface;
const INK     = Palette.ink;
const MUTED   = Palette.textSecondary;
const BORDER  = Palette.border;

type Tier = 'starter' | 'pro' | 'elite';

type RowDef = {
  label: string;
  starter: boolean | string;
  pro: boolean | string;
  elite: boolean | string;
};

const ROWS: RowDef[] = [
  { label: 'Meals listed',       starter: '5',      pro: '∞',      elite: '∞' },
  { label: 'Go Live streaming',  starter: false,    pro: true,     elite: true },
  { label: 'Rush specials',      starter: false,    pro: true,     elite: true },
  { label: 'Analytics',          starter: 'Basic',  pro: 'Full',   elite: 'Full' },
  { label: 'Priority search',    starter: false,    pro: true,     elite: true },
  { label: 'Verified badge',     starter: false,    pro: false,    elite: true },
  { label: 'Featured placement', starter: false,    pro: false,    elite: true },
];

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (typeof value === 'string') {
    return (
      <Text style={{
        fontFamily: Font.semibold,
        fontSize: 12,
        color: highlight ? ORANGE : MUTED,
        textAlign: 'center',
      }}>
        {value}
      </Text>
    );
  }
  return value
    ? <Check size={14} color={Palette.success} strokeWidth={2.5} />
    : <X size={14} color={Palette.divider} strokeWidth={2.5} />;
}

const TIERS: Tier[] = ['starter', 'pro', 'elite'];
const TIER_LABELS: Record<Tier, string> = { starter: 'Free', pro: 'Pro', elite: 'Elite' };
const COL_W = 72;
const LABEL_W = 148;

export function PrepperPlanComparison({ currentTier }: { currentTier?: Tier | null }) {
  return (
    <View>
      <Text style={{
        fontFamily: Font.heading,
        fontSize: 13,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
      }}>
        compare plans
      </Text>

      <View style={{ backgroundColor: CARD, borderRadius: 20, overflow: 'hidden' }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER }}>
          <View style={{ width: LABEL_W, paddingVertical: 14, paddingLeft: 16 }} />
          {TIERS.map((tier) => (
            <View key={tier} style={{
              width: COL_W,
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: tier === 'pro' ? ORANGE + '18' : 'transparent',
            }}>
              <Text style={{
                fontFamily: Font.heading,
                fontSize: 12,
                color: tier === currentTier ? Palette.success : (tier === 'pro' ? ORANGE : INK),
              }}>
                {TIER_LABELS[tier]}
              </Text>
              {tier === currentTier && (
                <Text style={{ fontFamily: Font.body, fontSize: 9, color: Palette.success, marginTop: 1 }}>
                  current
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Data rows */}
        {ROWS.map((row, i) => (
          <View
            key={row.label}
            style={{
              flexDirection: 'row',
              borderBottomWidth: i < ROWS.length - 1 ? 1 : 0,
              borderColor: BORDER,
            }}>
            <View style={{
              width: LABEL_W,
              paddingVertical: 13,
              paddingLeft: 16,
              justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>{row.label}</Text>
            </View>
            {TIERS.map((tier) => (
              <View key={tier} style={{
                width: COL_W,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tier === 'pro' ? ORANGE + '0A' : 'transparent',
              }}>
                <Cell value={row[tier]} highlight={tier !== 'starter'} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
