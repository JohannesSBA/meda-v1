/**
 * AdminUsersTab -- User administration table with search, role, and ban toggles.
 */

"use client";

import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Table } from "@/app/components/ui/table";
import { TableSkeleton } from "@/app/components/ui/skeleton";
import type { AdminUserRow } from "./types";

type AdminUsersTabProps = {
  adminUsers: AdminUserRow[];
  adminUsersLoading: boolean;
  adminUsersError?: string | null;
  userSearch: string;
  setUserSearch: (v: string) => void;
  onSearch: () => void;
  onSetRole: (userId: string, role: "admin" | "user") => void;
  onBanToggle: (userId: string, banned: boolean) => void;
  onRetry?: () => void;
};

export function AdminUsersTab({
  adminUsers,
  adminUsersLoading,
  adminUsersError,
  userSearch,
  setUserSearch,
  onSearch,
  onSetRole,
  onBanToggle,
  onRetry,
}: AdminUsersTabProps) {
  return (
    <section
      id="admin-tabpanel-users"
      role="tabpanel"
      aria-label="User administration"
      className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-white">User administration</h2>
        <div className="flex gap-2">
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by email/name"
            className="bg-[#0a1927]"
          />
          <Button onClick={() => void onSearch()} variant="primary" size="sm">
            Search
          </Button>
        </div>
      </div>
      <AsyncPanelState
        loading={adminUsersLoading}
        error={adminUsersError}
        isEmpty={adminUsers.length === 0}
        loadingFallback={<TableSkeleton rows={6} cols={4} />}
        emptyTitle="No users found"
        emptyDescription="Adjust your search terms or try again."
        onRetry={onRetry}
      >
        <div className="overflow-x-auto">
          <Table className="table-shell">
            <thead className="text-[var(--color-brand)]">
              <tr>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[var(--color-text-secondary)]">
              {adminUsers.map((row) => (
                <tr key={row.id || row.email} className="border-t border-white/10">
                  <td className="py-3 pr-4">
                    <p className="text-white">{row.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{row.email}</p>
                  </td>
                  <td className="py-3 pr-4">{row.role}</td>
                  <td className="py-3 pr-4">{row.banned ? "Banned" : "Active"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void onSetRole(row.id, row.role === "admin" ? "user" : "admin")
                        }
                      >
                        {row.role === "admin" ? "Remove admin" : "Make admin"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => void onBanToggle(row.id, !row.banned)}
                      >
                        {row.banned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </AsyncPanelState>
    </section>
  );
}
