"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { Card } from "./card";
import { OverlayPortal } from "./overlay-portal";

type ConfirmTone = "default" | "danger";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
};

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(2,6,23,0.68)] backdrop-blur-sm"
        aria-label="Close confirmation dialog"
        onClick={onCancel}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 w-full max-w-lg rounded-[var(--radius-xl)] p-6 sm:p-7"
      >
        <div className="space-y-3">
          <p id="confirm-dialog-title" className="text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
            {title}
          </p>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );

  return <OverlayPortal>{dialog}</OverlayPortal>;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...options, resolve });
    });
  }, []);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const dialog = useMemo(
    () => (
      <ConfirmDialog
        open={state != null}
        title={state?.title ?? ""}
        description={state?.description ?? ""}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        tone={state?.tone}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    ),
    [close, state],
  );

  return { confirm, dialog };
}
