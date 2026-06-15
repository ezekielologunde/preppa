import { ToggleLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useAdminFlags, useSetFeatureFlag } from '@/lib/queries/admin';
import { Admin, Card, SectionState } from './ui';

function Switch({ on }: { on: boolean }) {
  return (
    <MotiView
      animate={{ backgroundColor: on ? Admin.success : 'rgba(255,255,255,0.12)' }}
      transition={{ type: 'timing', duration: 200 }}
      style={{ width: 48, height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 3 }}>
      <MotiView
        animate={{ translateX: on ? 20 : 0 }}
        transition={{ type: 'timing', duration: 200 }}
        style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
    </MotiView>
  );
}

export function AdminFeatures() {
  const { data, isLoading, isError } = useAdminFlags();
  const setFlag = useSetFeatureFlag();
  const [flagErr, setFlagErr] = useState<string | null>(null);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.textDim, lineHeight: 19 }}>
        Turn platform capabilities on or off for everyone. Changes apply immediately across the app.
      </Text>

      {flagErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Admin.danger, textAlign: 'center' }}>{flagErr}</Text> : null}

      <SectionState loading={isLoading} error={isError} empty={!data?.length} emptyText="No feature flags. Run migration 0004." Icon={ToggleLeft} />

      {(data ?? []).map((f) => (
        <Card key={f.key}>
          <PressableScale
            onPress={() => {
              setFlagErr(null);
              setFlag.mutate({ key: f.key, enabled: !f.enabled }, {
                onError: () => { feedback.error(); setFlagErr(`Could not update '${f.label}'. Please try again.`); },
              });
            }}
            disabled={setFlag.isPending}
            accessibilityRole="switch"
            accessibilityState={{ checked: f.enabled }}
            accessibilityLabel={f.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text }}>{f.label}</Text>
              {f.description ? (
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, marginTop: 2, lineHeight: 17 }}>{f.description}</Text>
              ) : null}
              <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Admin.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.category}</Text>
            </View>
            <Switch on={f.enabled} />
          </PressableScale>
        </Card>
      ))}
    </View>
  );
}
