import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Plus, ShieldCheck, X } from 'lucide-react-native';
import { ActivityIndicator, Image, Text, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

export type UploadItem = { localUri: string; storagePath: string | null; uploading: boolean; error: boolean };

async function uploadDoc(localUri: string, userId: string, label: string): Promise<string> {
  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const path = `${userId}/application/${label}_${Date.now()}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { data, error } = await supabase.storage
    .from('certifications')
    .upload(path, decode(base64), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
  if (error) throw error;
  return data.path;
}

export function DocUploadGrid({ label, items, setItems, max, userId, allowMultiple }: {
  label: string;
  items: UploadItem[];
  setItems: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  max: number;
  userId: string;
  allowMultiple?: boolean;
}) {
  const { width } = useWindowDimensions();
  const thumbW = Math.floor((width - 48 - 20) / 3);
  const thumbH = Math.round(thumbW * 1.3);

  async function pick() {
    const remaining = max - items.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.88,
      allowsMultipleSelection: !!allowMultiple,
    });
    if (result.canceled || !result.assets.length) return;
    const assets = result.assets.slice(0, remaining);
    const startIdx = items.length;
    setItems((prev) => [
      ...prev,
      ...assets.map((a) => ({ localUri: a.uri, storagePath: null, uploading: true, error: false })),
    ]);
    await Promise.all(
      assets.map(async (asset, i) => {
        try {
          const path = await uploadDoc(asset.uri, userId, label.toLowerCase().replace(/\s+/g, '-'));
          setItems((prev) => prev.map((d, idx) => idx === startIdx + i ? { ...d, storagePath: path, uploading: false } : d));
        } catch {
          setItems((prev) => prev.map((d, idx) => idx === startIdx + i ? { ...d, uploading: false, error: true } : d));
          feedback.error();
        }
      })
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
      {items.map((item, idx) => (
        <View key={`${idx}-${item.localUri}`}
          style={{ width: thumbW, height: thumbH, borderRadius: 16, overflow: 'hidden', backgroundColor: Palette.canvas }}>
          <Image source={{ uri: item.localUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

          {item.uploading && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={{ fontFamily: Font.medium, fontSize: 10, color: '#fff' }}>uploading…</Text>
            </View>
          )}
          {item.error && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(220,38,38,0.52)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: Font.semibold, fontSize: 11 }}>Failed</Text>
            </View>
          )}
          {item.storagePath && !item.uploading && (
            <View style={{ position: 'absolute', bottom: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
              <ShieldCheck size={11} color="#fff" />
            </View>
          )}
          <PressableScale onPress={() => { feedback.tap(); setItems((p) => p.filter((_, i) => i !== idx)); }}
            accessibilityRole="button" accessibilityLabel={`Remove ${label} photo`}
            style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="#fff" />
          </PressableScale>
        </View>
      ))}

      {items.length < max && (
        <PressableScale onPress={() => { feedback.tap(); void pick(); }}
          accessibilityRole="button" accessibilityLabel={`Add ${label} photo`}
          style={{ width: thumbW, height: thumbH, borderRadius: 16, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.canvas, gap: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color={Palette.brand} />
          </View>
          <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textSecondary, textAlign: 'center' }}>
            {allowMultiple ? 'Add photos' : 'Add photo'}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}
