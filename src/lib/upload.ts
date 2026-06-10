import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export const uploadSupported = Platform.OS === 'web';

/**
 * Web image upload to a public Supabase Storage bucket. Opens the OS file
 * picker, validates type/size, and uploads to `<uid>/<unique>.<ext>` (the path
 * shape the storage RLS policy requires). Returns the public URL, null if the
 * user cancels, or throws on a real failure. Native picker is a separate dep
 * (expo-image-picker) — callers keep the URL field as the native fallback.
 */
export async function pickAndUploadImage(bucket: string, uid: string): Promise<string | null> {
  if (Platform.OS !== 'web') throw new Error('Upload is web-only for now — paste an image URL instead.');
  const file = await pickFile();
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_BYTES) throw new Error('Image is too large — keep it under 6 MB.');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message || 'Upload failed.');
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    let settled = false;
    const done = (f: File | null) => { if (!settled) { settled = true; resolve(f); } };
    input.onchange = () => done(input.files?.[0] ?? null);
    // If the dialog is dismissed, `change` never fires — resolve null on focus return.
    window.addEventListener('focus', () => setTimeout(() => done(null), 400), { once: true });
    input.click();
  });
}
