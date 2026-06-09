import { z } from 'zod';

/**
 * Validated, type-safe environment access.
 *
 * Only `EXPO_PUBLIC_*` vars are inlined into the client bundle by Expo, so any
 * value referenced here is safe to ship to the device. Never put service-role
 * keys or other server secrets in here.
 */
const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration. Check your .env file:\n${issues}\n` +
      'Copy .env.example to .env and fill in your Supabase project values.',
  );
}

export const env = parsed.data;
