import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
// Supabase renamed "anon key" to "publishable key"; support both so older
// and newer projects both work without touching this file.
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars are missing. Copy .env.example to .env and fill in your project URL and publishable key."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "");
