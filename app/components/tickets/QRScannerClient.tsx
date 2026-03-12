"use client";

import dynamic from "next/dynamic";

type QRScannerClientProps = {
  eventId: string;
  eventName: string;
};

const QRScanner = dynamic(() => import("./QRScanner"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
      Preparing scanner...
    </div>
  ),
});

export default function QRScannerClient(props: QRScannerClientProps) {
  return <QRScanner {...props} />;
}
