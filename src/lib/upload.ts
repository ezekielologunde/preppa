import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

// Both web (file input) and native (expo-image-picker) are now supported.
export const uploadSupported = true;

/**
 * Web image upload to a public Supabase Storage bucket. Opens the OS file
 * picker, validates type/size, and uploads to `<uid>/<unique>.<ext>` (the path
 * shape the storage RLS policy requires). Returns the public URL, null if the
 * user cancels, or throws on a real failure.
 */
export async function pickAndUploadImage(bucket: string, uid: string): Promise<string | null> {
  if (Platform.OS !== 'web') throw new Error('Use pickAndUploadImageNative on native platforms.');
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

/**
 * Native image upload using expo-image-picker. Requests media library permission,
 * opens the picker, fetches the chosen image as a blob, and uploads it to
 * Supabase Storage. Returns the public URL, null if the user cancels, or throws
 * on permission denial or upload failure.
 */
export async function pickAndUploadImageNative(bucket: string, path: string): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Photo library permission is required to upload images.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) return null;

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const fullPath = `${path}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message || 'Upload failed.');
  return supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
}

/**
 * Native camera capture and upload. Requests camera permission, opens the camera,
 * and uploads the captured photo to Supabase Storage. Returns the public URL,
 * null if the user cancels, or throws on permission denial or upload failure.
 */
export async function captureAndUploadImageNative(bucket: string, path: string): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Camera permission is required to take photos.');

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) return null;

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const fullPath = `${path}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message || 'Upload failed.');
  return supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
}

/**
 * Native multi-image upload. Opens the picker with allowsMultipleSelection, then
 * uploads every selected asset in parallel. Returns an array of public URLs (empty
 * if cancelled). Respects `remainingSlots` so the picker's selection limit matches
 * how many images the caller can still add.
 */
export async function pickAndUploadMultipleNative(bucket: string, uid: string, remainingSlots: number): Promise<string[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Photo library permission is required to upload images.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: remainingSlots,
    quality: 0.8,
  });

  if (result.canceled || !result.assets.length) return [];

  const uploads = result.assets.map(async (asset) => {
    if (!asset.uri) return null;
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fullPath = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
    if (error) throw new Error(error.message || 'Upload failed.');
    return supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
  });

  const results = await Promise.all(uploads);
  return results.filter((u): u is string => !!u);
}

/**
 * Web multi-image upload. Opens a file input with `multiple`, validates each file,
 * and uploads them to Supabase Storage in parallel. Returns an array of public URLs
 * (empty if cancelled). Respects `remainingSlots`.
 */
export async function pickAndUploadMultipleImages(bucket: string, uid: string, remainingSlots: number): Promise<string[]> {
  if (Platform.OS !== 'web') throw new Error('Use pickAndUploadMultipleNative on native platforms.');
  const files = await pickMultipleFiles(remainingSlots);
  if (!files.length) return [];

  const uploads = files.map(async (file) => {
    if (!file.type.startsWith('image/')) throw new Error('Please choose image files only.');
    if (file.size > MAX_BYTES) throw new Error(`"${file.name}" is too large — keep images under 6 MB.`);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message || 'Upload failed.');
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  });

  const results = await Promise.all(uploads);
  return results.filter((u): u is string => !!u);
}

/**
 * Native video upload using expo-image-picker. Requests media library permission,
 * opens the picker with video type, fetches the chosen video as a blob, and uploads
 * it to Supabase Storage. Returns the public URL, null if the user cancels, or
 * throws on permission denial or upload failure.
 */
export async function pickAndUploadVideoNative(bucket: string, path: string): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Photo library permission is required.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    quality: 0.8,
    videoMaxDuration: 120,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) return null;

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const ext = (asset.uri.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const fullPath = `${path}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { contentType: blob.type || 'video/mp4', upsert: false });
  if (error) throw new Error(error.message || 'Upload failed.');
  return supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
}

/**
 * Native multi-video upload. Opens the picker with video type and
 * allowsMultipleSelection, uploads each in parallel. Returns an array
 * of public URLs. Respects remainingSlots.
 */
export async function pickAndUploadMultipleVideosNative(
  bucket: string,
  uid: string,
  remainingSlots: number,
): Promise<string[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Photo library permission is required to upload videos.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsMultipleSelection: true,
    selectionLimit: remainingSlots,
    videoMaxDuration: 90,
  });

  if (result.canceled || !result.assets.length) return [];

  const uploads = result.assets.map(async (asset) => {
    if (!asset.uri) return null;
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = (asset.uri.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const fullPath = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, blob, { contentType: blob.type || 'video/mp4', upsert: false });
    if (error) throw new Error(error.message || 'Upload failed.');
    return supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
  });

  const results = await Promise.all(uploads);
  return results.filter((u): u is string => !!u);
}

/**
 * Native document upload using expo-document-picker. Opens the system document
 * picker for PDFs and images, uploads the selected file to Supabase Storage,
 * and returns its public URL and original filename. Returns null if cancelled
 * or throws on upload failure.
 */
export async function pickAndUploadDocument(
  bucket: string,
  uid: string,
  allowedTypes: string[] = ['application/pdf', 'image/*'],
): Promise<{ url: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: allowedTypes,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const ext = (asset.name.split('.').pop() ?? 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const fullPath = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, {
    contentType: blob.type || 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'Upload failed.');
  return {
    url: supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl,
    name: asset.name,
  };
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

function pickMultipleFiles(_limit: number): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    let settled = false;
    const done = (files: File[]) => { if (!settled) { settled = true; resolve(files); } };
    input.onchange = () => done(Array.from(input.files ?? []));
    window.addEventListener('focus', () => setTimeout(() => done([]), 400), { once: true });
    input.click();
  });
}
