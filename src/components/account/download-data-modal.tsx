import { Modal, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

interface DownloadDataModalProps {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DownloadDataModal({ visible, loading, onClose, onConfirm }: DownloadDataModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
        <View
          style={{
            backgroundColor: Palette.surface,
            borderRadius: 24,
            padding: 24,
            width: '100%',
            maxWidth: 360,
            gap: 16,
          }}>
          <Text
            style={{
              fontFamily: Font.heading,
              fontSize: 18,
              color: Palette.ink,
            }}>
            download my data
          </Text>
          <Text
            style={{
              fontFamily: Font.body,
              fontSize: 14,
              color: Palette.textSecondary,
              lineHeight: 21,
            }}>
            Download a copy of your Preppa data — your profile, orders,
            addresses, reviews, subscriptions, and preferences — as a JSON file.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel data download"
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                backgroundColor: Palette.chip,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontFamily: Font.semibold,
                  fontSize: 14,
                  color: Palette.inkSoft,
                }}>
                cancel
              </Text>
            </PressableScale>
            <PressableScale
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Download my data"
              accessibilityState={{ disabled: loading }}
              style={{
                flex: 2,
                height: 48,
                borderRadius: Radius.pill,
                backgroundColor: Palette.brand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.6 : 1,
              }}>
              <Text
                style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                {loading ? 'preparing…' : 'download'}
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}
