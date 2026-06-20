import { Modal, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

interface DeleteAccountModalsProps {
  deleteStep: number;
  deleteInput: string;
  deleting: boolean;
  onDeleteInput: (v: string) => void;
  onStep1Cancel: () => void;
  onStep1Proceed: () => void;
  onStep2Cancel: () => void;
  onStep2Confirm: () => void;
}

export function DeleteAccountModals({
  deleteStep,
  deleteInput,
  deleting,
  onDeleteInput,
  onStep1Cancel,
  onStep1Proceed,
  onStep2Cancel,
  onStep2Confirm,
}: DeleteAccountModalsProps) {
  return (
    <>
      {/* Step 1 — "are you sure?" */}
      <Modal
        visible={deleteStep === 1}
        transparent
        animationType="fade"
        onRequestClose={onStep1Cancel}>
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
                color: Palette.danger,
              }}>
              are you sure?
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.textSecondary,
                lineHeight: 21,
              }}>
              This will permanently delete your Preppa account, including all
              orders, favorites, and earned rewards. This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PressableScale
                onPress={onStep1Cancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel account deletion"
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
                onPress={onStep1Proceed}
                accessibilityRole="button"
                accessibilityLabel="Proceed to delete account confirmation"
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: Palette.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                  yes, delete
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* Step 2 — type DELETE */}
      <Modal
        visible={deleteStep === 2}
        transparent
        animationType="fade"
        onRequestClose={onStep2Cancel}>
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
                color: Palette.danger,
              }}>
              this cannot be undone
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.textSecondary,
                lineHeight: 21,
              }}>
              Type{' '}
              <Text
                style={{ fontFamily: Font.semibold, color: Palette.danger }}>
                DELETE
              </Text>{' '}
              to confirm account deletion.
            </Text>
            <TextInput
              value={deleteInput}
              onChangeText={onDeleteInput}
              placeholder="Type DELETE here"
              placeholderTextColor={Palette.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              accessibilityLabel="Type DELETE to confirm"
              style={{
                fontFamily: Font.body,
                fontSize: 15,
                color: Palette.ink,
                backgroundColor: Palette.canvas,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor:
                  deleteInput.length > 0 && deleteInput !== 'DELETE'
                    ? Palette.danger
                    : Palette.border,
                minHeight: 44,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PressableScale
                onPress={onStep2Cancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel account deletion"
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
                onPress={onStep2Confirm}
                disabled={deleteInput !== 'DELETE' || deleting}
                accessibilityRole="button"
                accessibilityLabel="Confirm and delete account"
                accessibilityState={{
                  disabled: deleteInput !== 'DELETE' || deleting,
                }}
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: Palette.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: deleteInput !== 'DELETE' || deleting ? 0.4 : 1,
                }}>
                <Text
                  style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                  {deleting ? 'deleting…' : 'delete my account'}
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
