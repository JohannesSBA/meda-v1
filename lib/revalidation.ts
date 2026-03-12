import { revalidatePath, revalidateTag } from "next/cache";
import { cacheTags } from "./cacheTags";

export function revalidateEventData(eventId: string, userIds: string[] = []) {
  revalidateTag(cacheTags.events, "max");
  revalidateTag(cacheTags.event(eventId), "max");
  revalidateTag(cacheTags.landing, "max");
  revalidateTag(cacheTags.adminEvents, "max");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueUserIds) {
    revalidateTag(cacheTags.profile(userId), "max");
  }

  if (uniqueUserIds.length > 0) {
    revalidatePath("/profile");
    revalidatePath("/my-tickets");
  }
}

export function revalidateCategoriesData() {
  revalidateTag(cacheTags.categories, "max");
}

export function revalidateAdminStats() {
  revalidateTag(cacheTags.adminStats, "max");
  revalidatePath("/profile");
}
