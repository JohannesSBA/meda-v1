import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_BUCKET_EVENTS = process.env.SUPABASE_BUCKET_EVENTS || "event=picture";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Supabase env vars missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export async function uploadEventImage(eventId: string, file: { buffer: Buffer; mimeType: string; ext: string }) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");

  const path = `event/${eventId}/cover.${file.ext}`;
  const { error } = await supabaseAdmin.storage
    .from(SUPABASE_BUCKET_EVENTS)
    .upload(path, file.buffer, {
      contentType: file.mimeType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(SUPABASE_BUCKET_EVENTS).getPublicUrl(path);
  return data.publicUrl;
}
