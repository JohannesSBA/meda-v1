import { uploadEventImage as uploadEventImageSupabase } from "./supabaseAdmin";

const hasSupabaseCreds =
  !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function uploadEventImageUnified(eventId: string, file: { buffer: Buffer; mimeType: string; ext: string }) {
  if (hasSupabaseCreds) {
    return uploadEventImageSupabase(eventId, file);
  }
  throw new Error("No storage credentials configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

export function storageTargetLabel() {
  if (hasSupabaseCreds) return `Supabase bucket ${process.env.SUPABASE_BUCKET_EVENTS ?? "event=picture"}`;
  return "None";
}
