"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type OverlayPortalProps = {
  children: ReactNode;
};

export function OverlayPortal({ children }: OverlayPortalProps) {
  if (typeof document === "undefined") {
    return <>{children}</>;
  }

  return createPortal(children, document.body);
}
