import { createBrowserClient } from '@supabase/ssr';

// Check if Supabase is configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create a single supabase client for browser-side operations
// Returns null if Supabase is not configured
export function createClient() {
    if (!isSupabaseConfigured) {
        return null;
    }

    return createBrowserClient(
        supabaseUrl!,
        supabaseAnonKey!
    );
}
