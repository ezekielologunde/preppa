// Fresh start — types will be added as the new schema is built.
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
