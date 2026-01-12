"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";

export default function RollCallDetailPage() {
  const params = useParams<{ date: string }>();
  const date = decodeURIComponent(params.date);

  const { isAuthenticated } = useConvexAuth();
  const roster = useQuery(
    api.attendance.rosterForDate,
    isAuthenticated ? { date } : "skip"
  );

  const members = roster ?? [];
  const present = members.filter((m) => m.presentToday).length;
  const total = members.length;
  const absent = Math.max(0, total - present);

  const presentMen = members.filter(
    (m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "male"
  );
  const presentWomen = members.filter(
    (m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "female"
  );
  const presentUnknown = members.filter(
    (m: any) => m.presentToday && !["male", "female"].includes((m.gender ?? "").toLowerCase())
  );

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <SignedOut>
        <div className="max-w-3xl mx-auto p-8">
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
            <p className="mb-4 text-zinc-700">Please sign in to view roll call details.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-zinc-900 font-light tracking-tight text-xl">Roll Call</div>
              <div className="text-xs text-zinc-600">{formatIsoDate(date)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/attendance/history"
                className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
              >
                Back
              </Link>
              <Link
                href="/attendance"
                className="inline-flex px-3 py-1.5 rounded-full bg-zinc-900/90 text-white hover:bg-zinc-900 text-xs sm:text-sm"
              >
                Mark Attendance
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <div className="rounded-2xl p-4 bg-zinc-900/90 text-white">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Total: {total}</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Present: {present}</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Absent: {absent}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Men Present ({presentMen.length})</div>
              {presentMen.length === 0 ? (
                <div className="text-sm text-zinc-600">None</div>
              ) : (
                <ul className="divide-y divide-white/60">
                  {presentMen.map((m: any) => (
                    <li key={m.memberId as any} className="py-2 text-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-zinc-900 truncate">{m.name}</div>
                        <div className="text-xs text-zinc-600 truncate">
                          {m.contact ?? "-"}
                          {m.residence ? ` • ${m.residence}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/40 text-xs text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Present
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Women Present ({presentWomen.length})</div>
              {presentWomen.length === 0 ? (
                <div className="text-sm text-zinc-600">None</div>
              ) : (
                <ul className="divide-y divide-white/60">
                  {presentWomen.map((m: any) => (
                    <li key={m.memberId as any} className="py-2 text-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-zinc-900 truncate">{m.name}</div>
                        <div className="text-xs text-zinc-600 truncate">
                          {m.contact ?? "-"}
                          {m.residence ? ` • ${m.residence}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/40 text-xs text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Present
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {presentUnknown.length > 0 && (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Present (Unknown gender) ({presentUnknown.length})</div>
              <ul className="divide-y divide-white/60">
                {presentUnknown.map((m: any) => (
                  <li key={m.memberId as any} className="py-2 text-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-zinc-900 truncate">{m.name}</div>
                      <div className="text-xs text-zinc-600 truncate">
                        {m.contact ?? "-"}
                        {m.residence ? ` • ${m.residence}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/40 text-xs text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Present
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            {members.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-600">No members found for this date.</div>
            ) : (
              <ul className="divide-y divide-white/60">
                {members.map((m) => (
                  <li key={m.memberId as any} className="py-2 text-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-zinc-900 truncate">{m.name}</div>
                      <div className="text-xs text-zinc-600 truncate">
                        {m.contact ?? "-"}
                        {m.residence ? ` • ${m.residence}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/40 text-xs ${
                          m.presentToday ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${m.presentToday ? "bg-emerald-500" : "bg-rose-500"}`}
                        />
                        {m.presentToday ? "Present" : "Absent"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SignedIn>
    </div>
  );
}
