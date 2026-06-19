/**
 * ExpandableBio — collapses to 3 lines with a "read more" / "read less" toggle.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

interface ExpandableBioProps {
  bio: string;
}

export function ExpandableBio({ bio }: ExpandableBioProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <Text
        numberOfLines={expanded ? undefined : 3}
        style={{
          fontFamily: Font.body,
          fontSize: 15,
          color: Palette.textSecondary,
          lineHeight: 22,
        }}>
        {bio}
      </Text>
      <PressableScale
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Show less bio' : 'Read full bio'}
        style={{ marginTop: 4 }}>
        <Text style={{
          fontFamily: Font.semibold, fontSize: 13.5, color: Palette.brand,
        }}>
          {expanded ? 'read less' : 'read more'}
        </Text>
      </PressableScale>
    </View>
  );
}
