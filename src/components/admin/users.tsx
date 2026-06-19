import { MoreHorizontal, Search, Shield, UserCog, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAdminUpdateUserRole, useAdminUpdateUserStatus, useAdminUsers, type AdminUser } from '@/lib/queries/admin';
import { Admin, Avatar, Card, Pill, SectionState } from './ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function joinLabel(iso: string) {
  return 'Joined ' + new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function primaryRole(roles: string[]): string {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('super_prepper')) return 'super prepper';
  if (roles.includes('prepper')) return 'prepper';
  return 'customer';
}

type FilterKey = 'all' | 'customers' | 'preppers' | 'suspended';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'customers', label: 'Customers' },
  { key: 'preppers', label: 'Preppers' },
  { key: 'suspended', label: 'Suspended' },
];

function applyFilter(users: AdminUser[], filter: FilterKey): AdminUser[] {
  switch (filter) {
    case 'customers': return users.filter((u) => !u.roles.some((r) => ['prepper', 'super_prepper', 'admin'].includes(r)));
    case 'preppers': return users.filter((u) => u.roles.some((r) => ['prepper', 'super_prepper'].includes(r)));
    case 'suspended': return users.filter((u) => u.status === 'suspended');
    default: return users;
  }
}

// ---------------------------------------------------------------------------
// Role modal
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { role: 'prepper', label: 'Prepper', warning: 'This gives the user access to prepper tools and order management.' },
  { role: 'admin', label: 'Admin', warning: 'This grants full admin console access. Use with caution.' },
];

function RoleModal({
  user,
  visible,
  onClose,
}: {
  user: AdminUser | null;
  visible: boolean;
  onClose: () => void;
}) {
  const updateRole = useAdminUpdateUserRole();
  const [pending, setPending] = useState<string | null>(null);

  const handleRole = useCallback((role: string, warning: string) => {
    const hasRole = user?.roles.includes(role);
    const action = hasRole ? 'Remove' : 'Grant';
    Alert.alert(
      `${action} ${role} role?`,
      warning,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: hasRole ? 'destructive' : 'default',
          onPress: () => {
            setPending(role);
            updateRole.mutate(
              { userId: user!.id, role, revoke: hasRole },
              {
                onSuccess: () => { feedback.success(); setPending(null); onClose(); },
                onError: () => { feedback.error(); setPending(null); },
              },
            );
          },
        },
      ],
    );
  }, [user, updateRole, onClose]);

  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={{ backgroundColor: Admin.card, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: 24, gap: 16, borderTopWidth: 1, borderColor: Admin.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Shield size={18} color={Admin.brand} />
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Admin.text }}>Change role</Text>
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.textDim }}>
              Current roles: {user.roles.length ? user.roles.join(', ') : 'customer (default)'}
            </Text>
            {ROLE_OPTIONS.map(({ role, label, warning }) => {
              const hasRole = user.roles.includes(role);
              const isPending = pending === role;
              return (
                <PressableScale
                  key={role}
                  onPress={() => handleRole(role, warning)}
                  disabled={isPending || updateRole.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`${hasRole ? 'Remove' : 'Grant'} ${label} role`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: Radius.sm,
                    borderWidth: 1,
                    borderColor: hasRole ? Admin.danger + '55' : Admin.border,
                    backgroundColor: hasRole ? Admin.danger + '11' : 'transparent',
                  }}>
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Admin.text }}>{label}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textMuted, maxWidth: 260 }} numberOfLines={2}>{warning}</Text>
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: hasRole ? Admin.danger : Admin.brand }}>
                    {isPending ? '...' : hasRole ? 'Remove' : 'Grant'}
                  </Text>
                </PressableScale>
              );
            })}
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Admin.textDim }}>Cancel</Text>
            </PressableScale>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// User row
// ---------------------------------------------------------------------------

function UserRow({ user, index }: { user: AdminUser; index: number }) {
  const updateStatus = useAdminUpdateUserStatus();
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const suspended = user.status === 'suspended';
  const role = primaryRole(user.roles);

  const handleStatusToggle = useCallback(() => {
    const next = suspended ? 'active' : 'suspended';
    const label = suspended ? 'Restore' : 'Suspend';
    Alert.alert(
      `${label} ${user.displayName}?`,
      suspended
        ? 'This will restore the user\'s access to the platform.'
        : 'This will prevent the user from placing or receiving orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: suspended ? 'default' : 'destructive',
          onPress: () =>
            updateStatus.mutate(
              { userId: user.id, status: next },
              { onSuccess: () => feedback.success(), onError: () => feedback.error() },
            ),
        },
      ],
    );
  }, [suspended, user, updateStatus]);

  return (
    <>
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 220, delay: Math.min(index * 40, 300) }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={user.displayName} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Admin.text }} numberOfLines={1}>{user.displayName}</Text>
                <Pill label={suspended ? 'suspended' : role} />
              </View>
              {user.email ? (
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textMuted, marginTop: 1 }} numberOfLines={1}>{user.email}</Text>
              ) : null}
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textMuted, marginTop: 2 }}>{joinLabel(user.createdAt)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <PressableScale
              onPress={handleStatusToggle}
              disabled={updateStatus.isPending}
              accessibilityRole="button"
              accessibilityLabel={suspended ? `Restore ${user.displayName}` : `Suspend ${user.displayName}`}
              style={{
                flex: 1,
                height: 40,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: suspended ? Admin.success + '55' : Admin.danger + '44',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: suspended ? Admin.success : Admin.danger }}>
                {suspended ? 'Restore' : 'Suspend'}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => { feedback.tap(); setRoleTarget(user); }}
              accessibilityRole="button"
              accessibilityLabel={`Change role for ${user.displayName}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: Admin.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MoreHorizontal size={18} color={Admin.textDim} />
            </PressableScale>
          </View>
        </Card>
      </MotiView>
      <RoleModal user={roleTarget} visible={!!roleTarget} onClose={() => setRoleTarget(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminUsers() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useAdminUsers(search);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(text), 300);
  }, []);

  const filtered = applyFilter(data ?? [], filter);

  const total = data?.length ?? 0;
  const activeCount = (data ?? []).filter((u) => u.status === 'active').length;
  const suspendedCount = (data ?? []).filter((u) => u.status === 'suspended').length;

  return (
    <View style={{ gap: 12 }}>
      {/* Search bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Admin.card, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, paddingHorizontal: 14, height: 48 }}>
        <Search size={18} color={Admin.textMuted} />
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search name or email..."
          placeholderTextColor={Admin.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          maxLength={100}
          accessibilityLabel="Search users"
          style={{ flex: 1, fontFamily: Font.body, fontSize: 14, color: Admin.text }}
        />
        {query ? (
          <PressableScale onPress={() => { setQuery(''); setSearch(''); }} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.textMuted }}>Clear</Text>
          </PressableScale>
        ) : null}
      </View>

      {/* Stats banner */}
      {total > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>
            Total: <Text style={{ fontFamily: Font.semibold, color: Admin.text }}>{total}</Text>
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}> · </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>
            Active: <Text style={{ fontFamily: Font.semibold, color: Admin.success }}>{activeCount}</Text>
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}> · </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>
            Suspended: <Text style={{ fontFamily: Font.semibold, color: Admin.danger }}>{suspendedCount}</Text>
          </Text>
        </View>
      ) : null}

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <MotiView
              key={f.key}
              animate={{ backgroundColor: active ? Admin.brand : Admin.card, borderColor: active ? Admin.brand : Admin.border }}
              transition={{ type: 'timing', duration: 160 }}
              style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => { feedback.tap(); setFilter(f.key); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter: ${f.label}`}
                style={{ paddingHorizontal: 14, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Admin.textDim }}>{f.label}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
      </ScrollView>

      {/* List */}
      <SectionState loading={isLoading} error={isError} empty={!filtered.length} emptyText="No users found." Icon={Users} />
      {filtered.map((user, i) => (
        <UserRow key={user.id} user={user} index={i} />
      ))}

      {total > 0 && filter !== 'all' && filtered.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <UserCog size={22} color={Admin.textMuted} />
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.textDim, marginTop: 8 }}>No users match this filter.</Text>
        </Card>
      ) : null}
    </View>
  );
}
