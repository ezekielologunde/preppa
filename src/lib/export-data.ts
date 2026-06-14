import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

import { supabase } from './supabase';

/**
 * GDPR Art. 20 / CCPA right-to-access: fetch the signed-in user's complete
 * personal dataset (via the read-only `export_my_data` RPC) and deliver it as a
 * real JSON file.
 *   - Web (the live product): triggers an immediate browser download.
 *   - Native: writes the archive to the app document dir, then opens the share sheet.
 */
export async function exportMyData(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) return { error: error.message };

  const json = JSON.stringify(data, null, 2);
  const filename = 'preppa-data-export.json';

  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      const uri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Share.share({ url: uri, title: filename });
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save your data export.' };
  }
}
