import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  AdminEventItem,
  AdminTab,
  AdminOwnerPayoutSummary,
  EventCreationFeeItem,
  AdminUserRow,
  CategoryItem,
  PromoCodeItem,
} from "./types";
import { readUser } from "./types";

export function useProfileAdminData(isAdmin: boolean, adminTab: AdminTab) {
  const router = useRouter();
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const [adminEvents, setAdminEvents] = useState<AdminEventItem[]>([]);
  const [adminEventsLoading, setAdminEventsLoading] = useState(false);
  const [adminEventsError, setAdminEventsError] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState("");

  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [fee, setFee] = useState<EventCreationFeeItem | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeAmountDraft, setFeeAmountDraft] = useState("");
  const [savingFee, setSavingFee] = useState(false);

  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [promoCodesLoading, setPromoCodesLoading] = useState(false);
  const [promoCodesError, setPromoCodesError] = useState<string | null>(null);
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discountType: "full" as const,
    discountValue: "100",
    pitchOwnerUserId: "",
    maxUses: "",
    expiresAt: "",
  });

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [payoutOwners, setPayoutOwners] = useState<AdminOwnerPayoutSummary[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [ticketSurchargeEtb, setTicketSurchargeEtb] = useState(15);
  const [commissionPercent, setCommissionPercent] = useState(0.05);
  const [payoutDraftByOwner, setPayoutDraftByOwner] = useState<Record<string, string>>({});
  const [payingOutOwnerId, setPayingOutOwnerId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AdminEventItem | null>(null);
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [seriesCount, setSeriesCount] = useState<number>(1);
  const [savingEvent, setSavingEvent] = useState(false);

  const deleteEventDialog = useConfirmDialog();
  const applyToSeriesDialog = useConfirmDialog();

  const adminUserNameById = useMemo(
    () => new Map(adminUsers.map((entry) => [entry.id, entry.name])),
    [adminUsers],
  );
  const pitchOwners = useMemo(
    () => adminUsers.filter((entry) => entry.role === "pitch_owner"),
    [adminUsers],
  );

  const loadAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    setAdminUsersLoading(true);
    setAdminUsersError(null);
    try {
      const query = userSearch ? `?search=${encodeURIComponent(userSearch)}` : "";
      const data = await browserApi.get<{ users?: unknown[] }>(
        `/api/admin/users${query}`,
        { cache: "no-store" },
      );
      setAdminUsers((data.users ?? []).map(readUser));
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load users";
      setAdminUsersError(message);
      toast.error(message);
    } finally {
      setAdminUsersLoading(false);
    }
  }, [isAdmin, userSearch]);

  const loadAdminEvents = useCallback(async () => {
    if (!isAdmin) return;
    setAdminEventsLoading(true);
    setAdminEventsError(null);
    try {
      const query = eventSearch ? `?search=${encodeURIComponent(eventSearch)}` : "";
      const data = await browserApi.get<{ items?: AdminEventItem[] }>(
        `/api/admin/events${query}`,
        { cache: "no-store" },
      );
      setAdminEvents(data.items ?? []);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load events";
      setAdminEventsError(message);
      toast.error(message);
    } finally {
      setAdminEventsLoading(false);
    }
  }, [eventSearch, isAdmin]);

  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await browserApi.get<Record<string, unknown>>(
        "/api/admin/stats",
        { cache: "no-store" },
      );
      setStats(data);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load statistics";
      setStatsError(message);
      toast.error(message);
    } finally {
      setStatsLoading(false);
    }
  }, [isAdmin]);

  const loadEventCreationFee = useCallback(async () => {
    if (!isAdmin) return;
    setFeeLoading(true);
    setFeeError(null);
    try {
      const data = await browserApi.get<{ fee?: EventCreationFeeItem | null }>(
        "/api/admin/event-creation-fee",
        { cache: "no-store" },
      );
      const nextFee = data.fee ?? null;
      setFee(nextFee);
      setFeeAmountDraft(nextFee ? String(nextFee.amountEtb) : "0");
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load event creation fee";
      setFeeError(message);
      toast.error(message);
    } finally {
      setFeeLoading(false);
    }
  }, [isAdmin]);

  const loadPromoCodes = useCallback(async () => {
    if (!isAdmin) return;
    setPromoCodesLoading(true);
    setPromoCodesError(null);
    try {
      const data = await browserApi.get<{ promoCodes?: PromoCodeItem[] }>(
        "/api/admin/promo-codes",
        { cache: "no-store" },
      );
      setPromoCodes(data.promoCodes ?? []);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load promo codes";
      setPromoCodesError(message);
      toast.error(message);
    } finally {
      setPromoCodesLoading(false);
    }
  }, [isAdmin]);

  const loadAdminPayouts = useCallback(async () => {
    if (!isAdmin) return;
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const data = await browserApi.get<{
        owners?: AdminOwnerPayoutSummary[];
        ticketSurchargeEtb?: number;
        commissionPercent?: number;
      }>("/api/admin/payouts", {
        cache: "no-store",
      });
      const nextOwners = data.owners ?? [];
      setPayoutOwners(nextOwners);
      setTicketSurchargeEtb(Number(data.ticketSurchargeEtb) || 15);
      setCommissionPercent(Number(data.commissionPercent) || 0.05);
      setPayoutDraftByOwner(
        Object.fromEntries(
          nextOwners.map((owner) => [
            owner.ownerId,
            owner.availablePayoutEtb ? owner.availablePayoutEtb.toFixed(2) : "",
          ]),
        ),
      );
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load payouts";
      setPayoutsError(message);
      toast.error(message);
    } finally {
      setPayoutsLoading(false);
    }
  }, [isAdmin]);

  const loadCategories = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await browserApi.get<{ categories?: CategoryItem[] }>(
        "/api/categories/get",
      );
      setCategories(data.categories ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to load categories");
    }
  }, [isAdmin]);

  const handleSetRole = useCallback(
    async (
      targetUserId: string,
      role: "admin" | "user" | "pitch_owner",
    ) => {
      try {
        await browserApi.patch(`/api/admin/users/${targetUserId}/role`, { role });
        toast.success(`Role updated to ${role}`);
        await loadAdminUsers();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Role update failed");
      }
    },
    [loadAdminUsers],
  );

  const handleBanToggle = useCallback(
    async (targetUserId: string, banned: boolean) => {
      try {
        await browserApi.patch(`/api/admin/users/${targetUserId}/ban`, {
          banned,
          banReason: banned ? "Moderation action from admin panel" : undefined,
        });
        toast.success(banned ? "User banned" : "User unbanned");
        await loadAdminUsers();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Ban update failed");
      }
    },
    [loadAdminUsers],
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      const confirmed = await deleteEventDialog.confirm({
        title: "Delete event?",
        description:
          "This permanently removes the event and its related data. This action cannot be undone.",
        confirmLabel: "Delete event",
        tone: "danger",
      });
      if (!confirmed) return;

      try {
        await browserApi.delete(`/api/admin/events/${eventId}`);
        toast.success("Event deleted");
        await loadAdminEvents();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Delete failed");
      }
    },
    [deleteEventDialog, loadAdminEvents],
  );

  const startEditEvent = useCallback(
    (eventId: string) => {
      router.push(`/admin/events/${eventId}/edit`);
    },
    [router],
  );

  const handleSaveEventChanges = useCallback(async () => {
    if (!editingEvent) return;
    if (applyToSeries && seriesCount > 1) {
      const confirmed = await applyToSeriesDialog.confirm({
        title: "Update recurring series?",
        description: `This will update ${seriesCount} occurrences in this recurring series. Continue only if every upcoming occurrence should change.`,
        confirmLabel: "Update series",
      });
      if (!confirmed) return;
    }

    setSavingEvent(true);
    try {
      const data = await browserApi.patch<{
        bulkUpdated?: boolean;
        updatedCount?: number;
      }>(`/api/admin/events/${editingEvent.eventId}`, {
        eventName: editingEvent.eventName,
        description: editingEvent.description ?? null,
        pictureUrl: editingEvent.pictureUrl ?? null,
        eventDatetime: editingEvent.eventDatetime,
        eventEndtime: editingEvent.eventEndtime,
        eventLocation: editingEvent.eventLocation ?? null,
        capacity: editingEvent.capacity ?? null,
        priceField: editingEvent.priceField ?? null,
        categoryId: editingEvent.categoryId,
        applyToSeries,
      });

      if (data?.bulkUpdated) {
        const count = Number(data.updatedCount) || seriesCount;
        toast.success(`Updated ${count} occurrences successfully`);
      } else {
        toast.success("Event updated");
      }

      setEditingEvent(null);
      setApplyToSeries(false);
      setSeriesCount(1);
      await loadAdminEvents();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update event");
    } finally {
      setSavingEvent(false);
    }
  }, [
    editingEvent,
    applyToSeries,
    seriesCount,
    applyToSeriesDialog,
    loadAdminEvents,
  ]);

  const handleSaveEventCreationFee = useCallback(async () => {
    setSavingFee(true);
    try {
      const data = await browserApi.patch<{ fee?: EventCreationFeeItem }>(
        "/api/admin/event-creation-fee",
        {
          amountEtb: Number(feeAmountDraft || "0"),
        },
      );
      if (data.fee) {
        setFee(data.fee);
        setFeeAmountDraft(String(data.fee.amountEtb));
      }
      toast.success("Event creation fee updated");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update event creation fee");
    } finally {
      setSavingFee(false);
    }
  }, [feeAmountDraft]);

  const handlePromoFieldChange = useCallback(
    (
      field:
        | "code"
        | "discountType"
        | "discountValue"
        | "pitchOwnerUserId"
        | "maxUses"
        | "expiresAt",
      value: string,
    ) => {
      setPromoForm((current) => ({
        ...current,
        [field]: field === "discountType" ? (value as "full" | "partial") : value,
        ...(field === "discountType" && value === "full"
          ? { discountValue: "100" }
          : {}),
      }));
    },
    [],
  );

  const handleCreatePromoCode = useCallback(async () => {
    setCreatingPromo(true);
    try {
      await browserApi.post("/api/admin/promo-codes", {
        code: promoForm.code,
        discountType: promoForm.discountType,
        discountValue:
          promoForm.discountType === "full"
            ? 100
            : Number(promoForm.discountValue || "0"),
        pitchOwnerUserId: promoForm.pitchOwnerUserId || null,
        maxUses: promoForm.maxUses ? Number(promoForm.maxUses) : null,
        expiresAt: promoForm.expiresAt,
      });
      toast.success("Promo code created");
      setPromoForm({
        code: "",
        discountType: "full",
        discountValue: "100",
        pitchOwnerUserId: "",
        maxUses: "",
        expiresAt: "",
      });
      await loadPromoCodes();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to create promo code");
    } finally {
      setCreatingPromo(false);
    }
  }, [loadPromoCodes, promoForm]);

  const handleTogglePromoCode = useCallback(
    async (promoId: string, isActive: boolean) => {
      try {
        await browserApi.patch(`/api/admin/promo-codes/${promoId}`, {
          isActive,
        });
        toast.success(isActive ? "Promo code activated" : "Promo code deactivated");
        await loadPromoCodes();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Failed to update promo code");
      }
    },
    [loadPromoCodes],
  );

  const handlePayoutDraftChange = useCallback((ownerId: string, value: string) => {
    setPayoutDraftByOwner((current) => ({
      ...current,
      [ownerId]: value,
    }));
  }, []);

  const handleCreatePayout = useCallback(
    async (ownerId: string) => {
      setPayingOutOwnerId(ownerId);
      try {
        const draft = payoutDraftByOwner[ownerId]?.trim() ?? "";
        await browserApi.post("/api/admin/payouts", {
          ownerId,
          amountEtb: draft ? Number(draft) : undefined,
        });
        toast.success("Payout transfer created");
        await loadAdminPayouts();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Failed to create payout");
      } finally {
        setPayingOutOwnerId(null);
      }
    },
    [loadAdminPayouts, payoutDraftByOwner],
  );

  const loadBillingData = useCallback(async () => {
    await Promise.all([
      loadEventCreationFee(),
      loadPromoCodes(),
      loadAdminUsers(),
      loadAdminPayouts(),
    ]);
  }, [loadAdminPayouts, loadAdminUsers, loadEventCreationFee, loadPromoCodes]);

  useEffect(() => {
    if (!isAdmin) return;
    if (adminTab === "users") {
      void loadAdminUsers();
      return;
    }
    if (adminTab === "events") {
      void Promise.all([loadAdminEvents(), loadCategories(), loadAdminUsers()]);
      return;
    }
    if (adminTab === "stats") {
      void loadStats();
      return;
    }
    if (adminTab === "billing") {
      void loadBillingData();
    }
  }, [
    adminTab,
    isAdmin,
    loadAdminEvents,
    loadAdminUsers,
    loadCategories,
    loadBillingData,
    loadEventCreationFee,
    loadAdminPayouts,
    loadPromoCodes,
    loadStats,
  ]);

  return {
    adminUsers,
    adminUsersLoading,
    adminUsersError,
    userSearch,
    setUserSearch,
    loadAdminUsers,
    adminEvents,
    adminEventsLoading,
    adminEventsError,
    eventSearch,
    setEventSearch,
    loadAdminEvents,
    stats,
    statsLoading,
    statsError,
    loadStats,
    loadBillingData,
    fee,
    feeLoading,
    feeError,
    feeAmountDraft,
    setFeeAmountDraft,
    savingFee,
    loadEventCreationFee,
    promoCodes,
    promoCodesLoading,
    promoCodesError,
    loadPromoCodes,
    payoutOwners,
    payoutsLoading,
    payoutsError,
    ticketSurchargeEtb,
    commissionPercent,
    payoutDraftByOwner,
    payingOutOwnerId,
    loadAdminPayouts,
    promoForm,
    creatingPromo,
    pitchOwners,
    categories,
    editingEvent,
    setEditingEvent,
    applyToSeries,
    setApplyToSeries,
    seriesCount,
    setSeriesCount,
    savingEvent,
    adminUserNameById,
    handleSetRole,
    handleBanToggle,
    handleDeleteEvent,
    startEditEvent,
    handleSaveEventChanges,
    handleSaveEventCreationFee,
    handlePromoFieldChange,
    handleCreatePromoCode,
    handleTogglePromoCode,
    handlePayoutDraftChange,
    handleCreatePayout,
    deleteEventDialog: deleteEventDialog.dialog,
    applyToSeriesDialog: applyToSeriesDialog.dialog,
  };
}
