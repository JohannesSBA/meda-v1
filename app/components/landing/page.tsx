"use client";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative isolate flex h-[min(760px,100vh)] w-full items-center overflow-hidden rounded-3xl bg-[#0B1C2D]">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(90%_70%_at_50%_-10%,#00E5FF22,transparent_70%),radial-gradient(80%_80%_at_80%_40%,#22FF8830,transparent_60%),linear-gradient(120deg,#071321,#0B1C2D_40%,#071321_100%)]" />
      <div className="absolute inset-6 -z-20 rounded-[32px] border border-[#1c2f42] bg-[#0f1f31]/60 blur-[1px]" />
      {/* Pitch arc motif */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 opacity-70">
        <div className="absolute inset-0 rounded-[320px_320px_60px_60px] border-10 border-[#00E5FF] blur-[0.2px]" />
        <div className="absolute inset-10 rounded-[280px_280px_48px_48px] border-2 border-[#00E5FF]/60" />
        <div className="absolute inset-24 rounded-[240px_240px_40px_40px] border-2 border-[#22FF88]/50" />
        <div className="absolute left-1/2 top-6 h-12 w-12 -translate-x-1/2 rounded-full border-[6px] border-[#00E5FF] bg-[#0B1C2D]" />
        <div className="absolute inset-y-16 left-1/2 w-[2px] -translate-x-1/2 bg-linear-to-b from-[#00E5FF]/80 via-[#22FF88]/80 to-transparent" />
      </div>

      <div className="relative z-20 flex w-full justify-start">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16 text-left text-white sm:px-10 lg:px-16">
          <span className="max-w-fit rounded-full border border-[#124068] bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#89e7ff]">
            Meda Football
          </span>
          <h1 className="font-extrabold text-4xl leading-tight text-white sm:text-[54px] sm:leading-[1.05] lg:text-[64px]">
            Find a pitch. Pay your part. Play.
          </h1>
          <p className="max-w-2xl text-base text-[#d7e9ff] sm:text-lg">
            Organize pickup matches, split the pitch cost per player, and lock
            in games near you. Built for Ethiopia’s night football and weekend
            runs.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#00E5FF] to-[#22FF88] px-8 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#001021] shadow-lg shadow-[#00E5FF40] transition duration-200 hover:-translate-y-0.5 hover:shadow-[#22FF8840] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00E5FF]/60"
            >
              Join a Match
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
