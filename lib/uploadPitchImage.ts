/**
 * uploadPitchImage -- unified place image upload (Supabase-backed).
 */

import { uploadPitchImage as uploadPitchImageSupabase } from "./supabaseAdmin";

const hasSupabaseCreds = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function uploadPitchImageUnified(
  pitchId: string,
  file: { buffer: Buffer; mimeType: string; ext: string },
) {
  if (hasSupabaseCreds) {
    return uploadPitchImageSupabase(pitchId, file);
  }

  throw new Error(
    "No storage credentials configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}
