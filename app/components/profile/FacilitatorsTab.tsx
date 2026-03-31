"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type FacilitatorItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
};

export function FacilitatorsTab() {
  const [items, setItems] = useState<FacilitatorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadFacilitators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await browserApi.get<{ facilitators?: FacilitatorItem[] }>(
        "/api/profile/facilitators",
        { cache: "no-store" },
      );
      setItems(data.facilitators ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || "Failed to load facilitators");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFacilitators();
  }, [loadFacilitators]);

  const handleAddFacilitator = async () => {
    setSubmitting(true);
    try {
      await browserApi.post("/api/profile/facilitators", { email });
      toast.success("Facilitator added");
      setEmail("");
      await loadFacilitators();
    } catch (submitError) {
      toast.error(getErrorMessage(submitError) || "Failed to add facilitator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFacilitator = async (
    facilitatorId: string,
    isActive: boolean,
  ) => {
    setUpdatingId(facilitatorId);
    try {
      await browserApi.patch(`/api/profile/facilitators/${facilitatorId}`, {
        isActive,
      });
      toast.success(isActive ? "Facilitator enabled" : "Facilitator disabled");
      await loadFacilitators();
    } catch (updateError) {
      toast.error(
        getErrorMessage(updateError) || "Failed to update facilitator",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
          Facilitators
        </p>
        <h2 className="text-lg font-semibold text-white">Scan team</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Add existing Meda users who can scan tickets for your events.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label>
            <span className="field-label">Facilitator email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="facilitator@example.com"
            />
          </label>
          <div className="sm:self-end">
            <Button
              type="button"
              onClick={() => void handleAddFacilitator()}
              disabled={submitting}
              className="w-full rounded-full sm:w-auto"
            >
              {submitting ? "Adding..." : "Add facilitator"}
            </Button>
          </div>
        </div>
      </Card>

      <AsyncPanelState
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        loadingFallback={<Card className="p-5 text-sm text-[var(--color-text-secondary)]">Loading facilitators...</Card>}
        emptyTitle="No facilitators yet"
        emptyDescription="Facilitators you add here will be able to scan tickets for your events."
        onRetry={loadFacilitators}
      >
        <div className="grid gap-3">
          {items.map((facilitator) => (
            <Card key={facilitator.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {facilitator.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {facilitator.email}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Added {new Date(facilitator.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={facilitator.isActive ? "danger" : "secondary"}
                  disabled={updatingId === facilitator.id}
                  onClick={() =>
                    void handleToggleFacilitator(
                      facilitator.id,
                      !facilitator.isActive,
                    )
                  }
                >
                  {updatingId === facilitator.id
                    ? "Saving..."
                    : facilitator.isActive
                      ? "Disable"
                      : "Enable"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}
