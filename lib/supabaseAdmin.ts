/**
 * Supabase admin client -- storage for event images.
 */

import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_BUCKET_EVENTS = process.env.SUPABASE_BUCKET_EVENTS || "event=picture";
export const SUPABASE_BUCKET_PITCHES =
  process.env.SUPABASE_BUCKET_PITCHES || SUPABASE_BUCKET_EVENTS;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.warn("Supabase env vars missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

type UploadableImage = {
  buffer: Buffer;
  mimeType: string;
  ext: string;
};

async function uploadPublicImage(bucket: string, path: string, file: UploadableImage) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");

  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, file.buffer, {
    contentType: file.mimeType,
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadEventImage(eventId: string, file: UploadableImage) {
  return uploadPublicImage(SUPABASE_BUCKET_EVENTS, `event/${eventId}/cover.${file.ext}`, file);
}

export async function uploadPitchImage(pitchId: string, file: UploadableImage) {
  return uploadPublicImage(SUPABASE_BUCKET_PITCHES, `pitch/${pitchId}/cover.${file.ext}`, file);
}
