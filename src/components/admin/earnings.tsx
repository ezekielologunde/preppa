import { BadgeCheck, Star, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { usePrepperEarnings } from '@/lib/queries/admin';
import { Admin, Card, money, compact, Pill, SectionState } from './ui';

export function AdminEarnings() {
  const { data, isLoading, isError } = usePrepperEarnings();
  const rows = data ?? [];
  const top = rows[0]?.completed_sales ?? 0;
  const totalGmv = rows.reduce((sum, r) => sum + Number(r.completed_sales ?? 0), 0);
  const RANK_COLORS = [Palette.amber, '#94a3b8', '#b45309'];

  return (
    <View style={{ gap: 12 }}>
      <SectionState loading={isLoading} error={isError} empty={!rows.length} emptyText="No prepper earnings yet." Icon={Wallet} />

      {rows.length ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Admin.success + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={20} color={Admin.success} />
          </View>
          <View>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>Total prepper earnings (completed)</Text>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Admin.text, fontVariant: ['tabular-nums'] }}>{money(totalGmv)}</Text>
          </View>
        </Card>
      ) : null}

      {rows.map((r, i) => {
        const pct = top > 0 ? Math.max(4, (Number(r.completed_sales) / top) * 100) : 0;
        return (
          <MotiView key={r.prepper_id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 50 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {i < 3 ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: RANK_COLORS[i] + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 9, color: RANK_COLORS[i] }}>#{i + 1}</Text>
                </View>
              ) : null}
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text, flex: 1 }} numberOfLines={1}>{r.display_name}</Text>
              {r.verified ? <BadgeCheck size={15} color={Admin.brand} /> : null}
              <Pill label={r.status} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
              <View>
                <Text style={{ fontFamily: Font.display, fontSize: 22, color: Admin.success, fontVariant: ['tabular-nums'] }}>{money(r.completed_sales)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textMuted }}>completed sales</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text, fontVariant: ['tabular-nums'] }}>{compact(r.completed_orders)}/{compact(r.total_orders)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textMuted }}>orders · avg {money(r.avg_order)}</Text>
                {Number(r.rating) > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Star size={11} color={Palette.amber} fill={Palette.amber} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.amber, fontVariant: ['tabular-nums'] }}>{Number(r.rating).toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 12, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: i < 3 ? RANK_COLORS[i] : Admin.brand }} />
            </View>
          </Card>
          </MotiView>
        );
      })}
    </View>
  );
}
