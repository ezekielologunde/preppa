import { supabase } from '@/lib/supabase';
import type { ListingForm, LocalPhoto } from '@/app/create-listing';

const BUCKET = 'listing-photos';

export type PublishStep =
  | { stage: 'uploading'; progress: number; total: number }
  | { stage: 'validating'; progress: number; total: number }
  | { stage: 'saving' }
  | { stage: 'done'; listingId: string };

export type PublishResult = {
  listingId: string;
  photoCount: number;
};

/**
 * Orchestrated publish pipeline (hardened):
 *   1. begin_upload RPC → quota check + reservation
 *   2. Upload to temp/ prefix in storage
 *   3. upload-pipeline edge function: magic bytes → EXIF strip → move to final path
 *   4. Atomic DB write via publish_listing RPC
 *   5. On failure: remove any successfully uploaded files
 *
 * Throws with a user-readable message on any failure.
 */
export async function publishListing(
  form: ListingForm,
  uid: string,
  onStep?: (step: PublishStep) => void,
): Promise<PublishResult> {
  const photoPaths = await uploadPhotosSecure(form.photos, uid, (i, total, stage) => {
    onStep?.({ stage, progress: i, total });
  });

  onStep?.({ stage: 'saving' });

  const pricePence = Math.round(parseFloat(form.price) * 100);
  const dailyPortions = form.dailyPortions ? parseInt(form.dailyPortions, 10) : null;

  const { data, error } = await supabase.rpc('publish_listing', {
    p_name:           form.name.trim(),
    p_tagline:        form.tagline.trim() || null,
    p_description:    form.description.trim() || null,
    p_price_pence:    pricePence,
    p_servings:       parseInt(form.servings, 10),
    p_daily_portions: dailyPortions,
    p_service_types:  form.serviceTypes,
    p_available_days: form.availableDays,
    p_use_cases:      form.useCases,
    p_dietary_tags:   form.dietaryTags,
    p_allergens:      form.allergens,
    p_photo_paths:    photoPaths,
  });

  if (error) {
    if (photoPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(photoPaths).catch(() => {});
    }
    throw new Error(error.message || 'Failed to publish listing. Please try again.');
  }

  const listingId = data as string;
  onStep?.({ stage: 'done', listingId });
  return { listingId, photoCount: photoPaths.length };
}

/**
 * Secure upload flow for each photo:
 *   1. Read file bytes + compute SHA-256 (client-side, sent as hint for dedup)
 *   2. begin_upload RPC → quota check, returns media_id
 *   3. Upload to temp/{uid}/{media_id} in storage
 *   4. POST to upload-pipeline edge function → validates, strips EXIF, moves to final path
 *   5. Returns the validated final storage_path
 */
async function uploadPhotosSecure(
  photos: LocalPhoto[],
  uid: string,
  onProgress: (i: number, total: number, stage: 'uploading' | 'validating') => void,
): Promise<string[]> {
  if (!photos.length) return [];

  const paths: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    onProgress(i, photos.length, 'uploading');

    // ── Fetch file bytes ──────────────────────────────────────────────────
    const response = await fetch(photo.uri);
    if (!response.ok) throw new Error(`Failed to read photo ${i + 1}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // ── Client-side SHA-256 (dedup hint — server re-computes authoritatively) ─
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const filename = photo.uri.split('/').pop() ?? `photo_${i}.jpg`;

    // ── 1. Reserve quota + get media_id ──────────────────────────────────
    const { data: mediaId, error: beginErr } = await supabase.rpc('begin_upload', {
      p_filename: filename,
      p_filesize:  bytes.length,
      p_sha256:    sha256,
    });

    if (beginErr) {
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
      const msg = beginErr.message.includes('quota_exceeded')
        ? 'Storage quota exceeded. Delete some photos and try again.'
        : `Upload failed: ${beginErr.message}`;
      throw new Error(msg);
    }

    // ── 2. Upload to temp path ────────────────────────────────────────────
    const tempPath = `temp/${uid}/${mediaId}`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(tempPath, bytes, { contentType: 'application/octet-stream', upsert: true });

    if (uploadErr) {
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    // ── 3. Validate + harden via edge function ────────────────────────────
    onProgress(i, photos.length, 'validating');

    const { data: pipelineResult, error: pipelineErr } = await supabase.functions.invoke<{ storage_path: string }>(
      'upload-pipeline',
      { body: { media_id: mediaId, temp_path: tempPath, filename } },
    );

    if (pipelineErr || !pipelineResult) {
      let errCode = 'validation_failed';
      if (pipelineErr && 'context' in pipelineErr) {
        const body = await (pipelineErr as { context: Response }).context.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
        errCode = (body.error as string) ?? errCode;
      }

      await supabase.storage.from(BUCKET).remove([tempPath]).catch(() => {});
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});

      const userMsg: Record<string, string> = {
        file_too_large:      'Photo is too large (max 6 MB).',
        unsupported_format:  'Unsupported image format. Use JPEG, PNG, WebP, or HEIC.',
        extension_mismatch:  'Photo file appears to be corrupted or misnamed.',
        quota_exceeded:      'Storage quota exceeded.',
        download_failed:     'Upload failed — please try again.',
      };
      throw new Error(userMsg[errCode] ?? 'Photo validation failed. Please try a different image.');
    }

    paths.push(pipelineResult.storage_path);
  }

  onProgress(photos.length, photos.length, 'validating');
  return paths;
}

/** Returns the public CDN URL for a validated storage path. */
export function getPhotoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
