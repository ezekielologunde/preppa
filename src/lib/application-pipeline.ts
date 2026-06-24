import { supabase } from '@/lib/supabase';
import type { ApplicationForm } from '@/app/apply/index';

// Private bucket — RLS enforces path starts with auth.uid() (see migration 031).
// Never expose signed URLs to the client; admin review uses service_role.
const BUCKET = 'compliance-docs';

export type SubmitStep =
  | { stage: 'uploading-photos'; progress: number; total: number }
  | { stage: 'uploading-cert' }
  | { stage: 'saving' };

async function uploadBytes(path: string, uri: string): Promise<void> {
  const resp = await fetch(uri);
  if (!resp.ok) throw new Error('Could not read file. Please try again.');
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/octet-stream', upsert: true });
  if (error) throw new Error(error.message);
}

function parseUkDate(val: string): string | null {
  if (val.length !== 10) return null;
  const [dd, mm, yyyy] = val.split('/');
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export async function submitApplication(
  form: ApplicationForm,
  uid: string,
  onStep?: (s: SubmitStep) => void,
): Promise<void> {
  const uploadedPaths: string[] = [];
  let certPath: string | null = null;

  try {
    for (let i = 0; i < form.kitchenPhotos.length; i++) {
      onStep?.({ stage: 'uploading-photos', progress: i, total: form.kitchenPhotos.length });
      const photo = form.kitchenPhotos[i];
      const ext = photo.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      // Path prefix must be uid/ — enforced by compliance-docs RLS (migration 031)
      const path = `${uid}/kitchen-${photo.id}.${ext}`;
      await uploadBytes(path, photo.uri);
      uploadedPaths.push(path);
    }

    if (form.foodSafetyCertUri) {
      onStep?.({ stage: 'uploading-cert' });
      const ext = form.foodSafetyCertUri.split('.').pop()?.toLowerCase() ?? 'pdf';
      certPath = `${uid}/food-safety-cert.${ext}`;
      await uploadBytes(certPath, form.foodSafetyCertUri);
    }

    onStep?.({ stage: 'saving' });

    const specialtiesArray = form.specialties
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const { error } = await supabase.from('prepper_applications').insert({
      user_id:                uid,
      legal_name:             form.legalName.trim(),
      postcode:               form.postcode.trim().toUpperCase(),
      kitchen_address:        form.kitchenAddress.trim() || null,
      bio:                    form.bio.trim() || null,
      experience_years:       form.experienceYears ? parseInt(form.experienceYears, 10) : null,
      specialties:            specialtiesArray,
      insurance_attested:     true,
      insurance_attested_at:  new Date().toISOString(),
      contractor_attested:    true,
      contractor_attested_at: new Date().toISOString(),
      kitchen_photos:         uploadedPaths,
      food_safety_cert_url:   certPath,
      cert_expiration_date:   parseUkDate(form.certExpirationDate),
      submitted_at:           new Date().toISOString(),
    });

    if (error) {
      const msg = error.message.includes('unique')
        ? 'You have already submitted an application. Contact support to update it.'
        : error.message || 'Submission failed. Please try again.';
      throw new Error(msg);
    }
  } catch (err) {
    const toRemove = [...uploadedPaths, ...(certPath ? [certPath] : [])];
    if (toRemove.length) {
      await supabase.storage.from(BUCKET).remove(toRemove).catch(() => {});
    }
    throw err;
  }
}
