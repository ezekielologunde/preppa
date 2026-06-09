/**
 * Placeholder Supabase schema types.
 *
 * Regenerate from your live project once you have tables:
 *   npx supabase login
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
