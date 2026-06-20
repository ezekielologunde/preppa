import { Check, FileText, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { pickAndUploadDocument } from '@/lib/upload';

export type DocState = { url: string | null; name: string | null; uploading: boolean; error: string | null };
export const emptyDoc = (): DocState => ({ url: null, name: null, uploading: false, error: null });

interface DocRowProps {
  label: string;
  subtext: string;
  optional?: boolean;
  doc: DocState;
  onPick: () => void;
  onRemove: () => void;
}

function DocRow({ label, subtext, optional, doc, onPick, onRemove }: DocRowProps) {
  const hasDoc = !!doc.url;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.ink }}>{label}</Text>
        {optional && (
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>(optional)</Text>
        )}
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19, marginBottom: 10 }}>
        {subtext}
      </Text>

      {hasDoc ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: Palette.canvas, borderRadius: 12,
          borderWidth: 1.5, borderColor: Palette.success,
          paddingHorizontal: 14, paddingVertical: 12,
        }}>
          <Check size={16} color={Palette.success} />
          <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13, color: Palette.success }} numberOfLines={1}>
            {doc.name}
          </Text>
          <PressableScale
            onPress={() => { feedback.tap(); onRemove(); }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} color={Palette.textSecondary} />
          </PressableScale>
        </View>
      ) : (
        <PressableScale
          onPress={() => { feedback.tap(); onPick(); }}
          accessibilityRole="button"
          accessibilityLabel={`Upload ${label}`}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            borderWidth: 1.5, borderColor: doc.error ? Palette.danger : Palette.brand,
            borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16,
            backgroundColor: doc.uploading ? Palette.brandTint : 'transparent',
          }}
        >
          {doc.uploading ? (
            <ActivityIndicator size="small" color={Palette.brand} />
          ) : (
            <FileText size={16} color={doc.error ? Palette.danger : Palette.brand} />
          )}
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: doc.error ? Palette.danger : Palette.brand }}>
            {doc.uploading ? 'Uploading…' : doc.error ? 'Upload failed — try again' : '+ Upload doc'}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}

interface Props {
  userId: string;
  foodHandler: DocState;
  setFoodHandler: (d: DocState) => void;
  insurance: DocState;
  setInsurance: (d: DocState) => void;
  bizLicense: DocState;
  setBizLicense: (d: DocState) => void;
}

export function CertificationsStep({
  userId,
  foodHandler, setFoodHandler,
  insurance, setInsurance,
  bizLicense, setBizLicense,
}: Props) {
  async function pick(setter: (d: DocState) => void) {
    setter({ url: null, name: null, uploading: true, error: null });
    try {
      const result = await pickAndUploadDocument('certifications', userId);
      if (!result) {
        setter(emptyDoc());
        return;
      }
      setter({ url: result.url, name: result.name, uploading: false, error: null });
      feedback.success();
    } catch (e) {
      setter({ url: null, name: null, uploading: false, error: e instanceof Error ? e.message : 'Upload failed.' });
      feedback.error();
    }
  }

  return (
    <View>
      <DocRow
        label="food handler certificate"
        subtext="Required by law in most states. Upload your food handler or food safety certificate."
        doc={foodHandler}
        onPick={() => { void pick(setFoodHandler); }}
        onRemove={() => setFoodHandler(emptyDoc())}
      />
      <DocRow
        label="liability insurance"
        subtext="Not required but adds a Verified badge to your profile. Upload your liability insurance certificate."
        optional
        doc={insurance}
        onPick={() => { void pick(setInsurance); }}
        onRemove={() => setInsurance(emptyDoc())}
      />
      <DocRow
        label="business license"
        subtext="Upload if you operate as a registered food business."
        optional
        doc={bizLicense}
        onPick={() => { void pick(setBizLicense); }}
        onRemove={() => setBizLicense(emptyDoc())}
      />
    </View>
  );
}
