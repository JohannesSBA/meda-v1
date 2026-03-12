"use client";

import dynamic from "next/dynamic";

type StaticEventMapProps = {
  latitude: number;
  longitude: number;
};

const StaticEventMap = dynamic(() => import("./StaticEventMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-2xl bg-[#0b1624]" />
  ),
});

export default function StaticEventMapClient(props: StaticEventMapProps) {
  return <StaticEventMap {...props} />;
}
