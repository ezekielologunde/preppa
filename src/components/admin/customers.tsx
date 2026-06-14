import { Search, ShieldCheck, ShoppingBag, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { useAdminCustomerOrderStats, useAdminCustomers, useGrantRole, useSetUserStatus } from '@/lib/queries/admin';
import { Admin, Avatar, Card, money, Pill, SectionState } from './ui';

function joinLabel(iso: string) {
  return 'joined ' + new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function AdminCustomers() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useAdminCustomers(search);
  const setUserStatus = useSetUserStatus();
  const grantRole = useGrantRole();
  const { data: statsMap } = useAdminCustomerOrderStats();

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Admin.card, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, paddingHorizontal: 14, height: 48 }}>
        <Search size={18} color={Admin.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSearch(query)}
          placeholder="Search name or email"
          placeholderTextColor={Admin.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          style={{ flex: 1, fontFamily: Font.body, fontSize: 14, color: Admin.text }}
        />
        {query ? (
          <PressableScale onPress={() => setSearch(query)} accessibilityRole="button" accessibilityLabel="Run search">
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.brand }}>Go</Text>
          </PressableScale>
        ) : null}
      </View>

      {data && data.length > 0 ? (
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>{data.length} customer{data.length === 1 ? '' : 's'}</Text>
      ) : null}
      <SectionState loading={isLoading} error={isError} empty={!data?.length} emptyText="No customers found." Icon={Users} />

      {(data ?? []).map((c, i) => {
        const name = c.full_name ?? c.email?.split('@')[0] ?? 'guest';
        const suspended = c.status === 'suspended';
        const stat = statsMap?.get(c.id);
        return (
          <MotiView key={c.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 50 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text }}>{name}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }} numberOfLines={1}>{c.email ?? 'no email'}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textMuted, marginTop: 1 }}>{joinLabel(c.created_at)}</Text>
              </View>
              <Pill label={c.status} />
            </View>
            {stat && stat.order_count > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Admin.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <ShoppingBag size={12} color={Admin.textMuted} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Admin.textDim, fontVariant: ['tabular-nums'] }}>
                    {stat.order_count} order{stat.order_count === 1 ? '' : 's'}
                  </Text>
                </View>
                {stat.total_spend > 0 ? (
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Admin.success, fontVariant: ['tabular-nums'] }}>
                    {money(stat.total_spend)} spent
                  </Text>
                ) : null}
                {stat.order_count !== stat.completed_count ? (
                  <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textMuted }}>
                    {stat.completed_count} completed
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <PressableScale
                onPress={() => setUserStatus.mutate({ userId: c.id, status: suspended ? 'active' : 'suspended' })}
                disabled={setUserStatus.isPending}
                accessibilityRole="button"
                accessibilityLabel={suspended ? `Reactivate ${name}` : `Suspend ${name}`}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: suspended ? Admin.success + '55' : Admin.border }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: suspended ? Admin.success : Admin.textDim }}>
                  {suspended ? 'Reactivate' : 'Suspend'}
                </Text>
              </PressableScale>
              <PressableScale
                onPress={() => grantRole.mutate({ userId: c.id, role: 'admin' })}
                disabled={grantRole.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Make ${name} an admin`}
                style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, height: 44, borderRadius: Radius.sm, backgroundColor: Admin.brand + '1F', borderWidth: 1, borderColor: Admin.brand + '55' }}>
                <ShieldCheck size={15} color={Admin.brand} />
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Admin.brand }}>Make admin</Text>
              </PressableScale>
            </View>
          </Card>
          </MotiView>
        );
      })}
    </View>
  );
}
