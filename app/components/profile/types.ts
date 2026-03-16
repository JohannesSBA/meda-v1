/**
 * Types and helpers for the ProfileDashboard and related components.
 */

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
};

export type RegisteredEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  ticketCount: number;
  priceField?: number | null;
  addressLabel?: string | null;
  pictureUrl?: string | null;
};

export type SavedEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  addressLabel?: string | null;
};

export type AdminEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  eventEndtime: string;
  userId: string;
  isRecurring?: boolean;
  seriesId?: string | null;
  priceField?: number | null;
  capacity?: number | null;
  categoryId?: string;
  eventLocation?: string | null;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pictureUrl?: string | null;
  description?: string | null;
};

export type CategoryItem = { categoryId: string; categoryName: string };

export type UserTab = "registered" | "saved";
export type AdminTab = "users" | "events" | "stats" | "billing";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  authRole?: string;
  banned: boolean;
};

export type EventCreationFeeItem = {
  id: string;
  amountEtb: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export type PromoCodeItem = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  pitchOwnerUserId?: string | null;
  pitchOwnerName?: string | null;
  pitchOwnerEmail?: string | null;
  maxUses?: number | null;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
};

export function readUser(user: unknown): AdminUserRow {
  const row = user as Record<string, unknown>;
  return {
    id: String(row.id ?? row.userId ?? ""),
    name: String(row.name ?? row.displayName ?? "Unknown"),
    email: String(row.email ?? ""),
    role: String(row.role ?? "user"),
    authRole: row.authRole == null ? undefined : String(row.authRole),
    banned: Boolean(row.banned ?? row.isBanned ?? false),
  };
}
