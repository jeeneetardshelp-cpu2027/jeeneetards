// supabaseClient.js
// One shared client for the whole app.
//
// Get these two values from your Supabase dashboard:
//   Project Settings -> API -> Project URL  and  anon public key
// Put them in a file named ".env" in your project root (see .env.example).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If .env is missing, createClient() throws — and because this file is
// imported at startup, that would blank out the WHOLE site rather than just
// breaking one panel. So we check first and let screens show a friendly
// message instead.
export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && supabaseUrl.startsWith("http");

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
