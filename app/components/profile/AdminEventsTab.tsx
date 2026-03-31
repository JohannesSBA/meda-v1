/**
 * AdminEventsTab -- Event moderation table with search, edit, delete, and inline editor.
 */

"use client";

import { type Dispatch, type SetStateAction } from "react";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ResponsiveTableCard } from "@/app/components/ui/responsive-table-card";
import { Select } from "@/app/components/ui/select";
import { Table } from "@/app/components/ui/table";
import { TableSkeleton } from "@/app/components/ui/skeleton";
import type { AdminEventItem, CategoryItem } from "./types";

type AdminEventsTabProps = {
  adminEvents: AdminEventItem[];
  adminEventsLoading: boolean;
  adminEventsError?: string | null;
  eventSearch: string;
  setEventSearch: (v: string) => void;
  onSearch: () => void;
  adminUserNameById: Map<string, string>;
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  editingEvent: AdminEventItem | null;
  setEditingEvent: Dispatch<SetStateAction<AdminEventItem | null>>;
  categories: CategoryItem[];
  applyToSeries: boolean;
  setApplyToSeries: (v: boolean) => void;
  seriesCount: number;
  savingEvent: boolean;
  onSaveChanges: () => void;
  onRetry?: () => void;
};

export function AdminEventsTab({
  adminEvents,
  adminEventsLoading,
  adminEventsError,
  eventSearch,
  setEventSearch,
  onSearch,
  adminUserNameById,
  onEdit,
  onDelete,
  editingEvent,
  setEditingEvent,
  categories,
  applyToSeries,
  setApplyToSeries,
  seriesCount,
  savingEvent,
  onSaveChanges,
  onRetry,
}: AdminEventsTabProps) {
  return (
    <section
      id="admin-tabpanel-events"
      role="tabpanel"
      aria-label="Event moderation"
      className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-white">Event moderation</h2>
        <div className="flex gap-2">
          <Input
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search events"
            className="bg-[#0a1927]"
          />
          <Button onClick={() => void onSearch()} variant="primary" size="sm">
            Search
          </Button>
        </div>
      </div>
      <AsyncPanelState
        loading={adminEventsLoading}
        error={adminEventsError}
        isEmpty={adminEvents.length === 0}
        loadingFallback={<TableSkeleton rows={6} cols={5} />}
        emptyTitle="No events found"
        emptyDescription="Adjust your filters or create a new event."
        onRetry={onRetry}
      >
        <ResponsiveTableCard
          table={
            <Table className="table-shell">
              <thead className="text-[var(--color-brand)]">
                <tr>
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Host</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[var(--color-text-secondary)]">
                {adminEvents.map((event) => (
                  <tr key={event.eventId} className="border-t border-white/10">
                    <td className="py-3 pr-4 text-white">{event.eventName}</td>
                    <td className="py-3 pr-4">
                      {new Date(event.eventDatetime).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      {adminUserNameById.get(event.userId) ?? event.userId}
                    </td>
                    <td className="py-3 pr-4">ETB {event.priceField ?? 0}</td>
                    <td className="py-3 pr-4">
                      <EventRowActions
                        event={event}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          mobileCards={adminEvents.map((event) => (
            <div
              key={event.eventId}
              className="rounded-[var(--radius-md)] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">{event.eventName}</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {new Date(event.eventDatetime).toLocaleString()}
                </p>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                <p>Host: {adminUserNameById.get(event.userId) ?? event.userId}</p>
                <p>Price: ETB {event.priceField ?? 0}</p>
              </div>
              <div className="mt-4">
                <EventRowActions event={event} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
          ))}
        />
      </AsyncPanelState>

      {editingEvent ? (
        <div
          id="admin-event-editor"
          className="space-y-3 rounded-xl border border-white/10 bg-[#0a1927] p-4"
        >
          <h3 className="text-lg font-semibold text-white">Edit event details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={editingEvent.eventName}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev ? { ...prev, eventName: e.target.value } : prev,
                )
              }
              placeholder="Event name"
              className="bg-[#08111c]"
            />
            <Input
              value={editingEvent.pictureUrl ?? ""}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev ? { ...prev, pictureUrl: e.target.value } : prev,
                )
              }
              placeholder="Picture URL"
              className="bg-[#08111c]"
            />
            <Input
              type="datetime-local"
              value={editingEvent.eventDatetime.slice(0, 16)}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev
                    ? { ...prev, eventDatetime: new Date(e.target.value).toISOString() }
                    : prev,
                )
              }
              className="bg-[#08111c]"
            />
            <Input
              type="datetime-local"
              value={editingEvent.eventEndtime.slice(0, 16)}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev
                    ? { ...prev, eventEndtime: new Date(e.target.value).toISOString() }
                    : prev,
                )
              }
              className="bg-[#08111c]"
            />
            <Input
              type="number"
              value={editingEvent.priceField ?? 0}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev ? { ...prev, priceField: Number(e.target.value) } : prev,
                )
              }
              placeholder="Price ETB"
              className="bg-[#08111c]"
            />
            <Input
              type="number"
              value={editingEvent.capacity ?? 0}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev ? { ...prev, capacity: Number(e.target.value) } : prev,
                )
              }
              placeholder="Capacity"
              className="bg-[#08111c]"
            />
            <Select
              value={editingEvent.categoryId ?? ""}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev ? { ...prev, categoryId: e.target.value } : prev,
                )
              }
              className="bg-[#08111c]"
            >
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </Select>
            <Input
              value={editingEvent.eventLocation ?? ""}
              onChange={(e) =>
                setEditingEvent((prev) =>
                  prev ? { ...prev, eventLocation: e.target.value } : prev,
                )
              }
              placeholder="Event location"
              className="bg-[#08111c]"
            />
          </div>
          <textarea
            rows={4}
            value={editingEvent.description ?? ""}
            onChange={(e) =>
              setEditingEvent((prev) =>
                prev ? { ...prev, description: e.target.value } : prev,
              )
            }
            className="w-full rounded-xl border border-white/10 bg-[#08111c] px-4 py-3 text-base text-white sm:text-sm"
            placeholder="Description"
          />
          {editingEvent.isRecurring && editingEvent.seriesId ? (
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={applyToSeries}
                onChange={(e) => setApplyToSeries(e.target.checked)}
              />
              Apply changes to all occurrences in this recurring series
            </label>
          ) : null}
          {editingEvent.isRecurring &&
          editingEvent.seriesId &&
          applyToSeries ? (
            <p className="rounded-lg border border-[#22FF88]/40 bg-[#22FF88]/10 px-4 py-3 text-sm text-[#d9ffea]">
              This will update {seriesCount} occurrence
              {seriesCount === 1 ? "" : "s"} in this series.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={savingEvent}
              onClick={() => void onSaveChanges()}
              variant="primary"
            >
              {savingEvent ? "Saving..." : "Save changes"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setApplyToSeries(false);
              }}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EventRowActions({
  event,
  onEdit,
  onDelete,
}: {
  event: AdminEventItem;
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => void onEdit(event.eventId)}
      >
        Edit
      </Button>
      <Button
        type="button"
        size="sm"
        variant="danger"
        onClick={() => void onDelete(event.eventId)}
      >
        Delete
      </Button>
    </div>
  );
}
