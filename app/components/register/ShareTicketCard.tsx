/**
 * ShareTicketCard -- Share link generation and copy UI for users with multiple tickets.
 */

"use client";

import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";

type ShareTicketCardProps = {
  shareLoading: boolean;
  shareUrl: string | null;
  remainingClaims: number;
  myTickets: number;
  onCopy: () => void;
  onRegenerate: () => void;
  shareCopied: boolean;
};

export function ShareTicketCard({
  shareLoading,
  shareUrl,
  remainingClaims,
  myTickets,
  onCopy,
  onRegenerate,
  shareCopied,
}: ShareTicketCardProps) {
  const claimCount = shareUrl ? remainingClaims : myTickets - 1;

  return (
    <Card className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[#0a1927] p-4">
      <div>
        <p className="text-sm font-semibold text-white">
          Share your extra tickets
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Friends can claim up to {claimCount} ticket
          {claimCount === 1 ? "" : "s"} from this link.
        </p>
      </div>
      {shareLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Generating link...
        </p>
      ) : shareUrl ? (
        <div className="space-y-2">
          <Input
            value={shareUrl}
            readOnly
            className="bg-[#06111c] text-sm text-[var(--color-text-primary)]"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-full px-4"
              onClick={onCopy}
            >
              {shareCopied ? "Copied!" : "Copy link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-full px-4"
              onClick={onRegenerate}
            >
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full rounded-full"
          onClick={onRegenerate}
        >
          Generate share link
        </Button>
      )}
    </Card>
  );
}
