"use client";

import { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QuickAddMember from "@/components/QuickAddMember";
import MemberEditor, { MemberSummary } from "@/components/MemberEditor";
import { formatDate, formatIsoDate } from "@/lib/date";

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AttendancePage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [tab, setTab] = useState<"all" | "male" | "female">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20>(20);

  const roster = useQuery(
    api.attendance.rosterForDate,
    isAuthenticated ? { date: todayIso } : "skip"
  );
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const members = roster ?? [];
  const presentTodayCount = useMemo(
    () => members.filter((m) => m.presentToday).length,
    [members]
  );

  const filtered = useMemo(() => {
    if (tab === "all") return members;
    return members.filter((m) => (m.gender ?? "").toLowerCase() === tab);
  }, [members, tab]);

  // Apply client-side search
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    const terms = q.split(/\s+/).filter(Boolean);
    return filtered.filter((m: any) => {
      const hay = `${m.name ?? ""} ${m.contact ?? ""} ${m.residence ?? ""} ${m.department ?? ""} ${m.status ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [filtered, query]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(searched.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searched.slice(start, start + pageSize);
  }, [searched, currentPage, pageSize]);

  // Reset page when dependencies change
  useEffect(() => { setPage(1); }, [query, tab, pageSize]);

  const handleToggleAttendance = async (
    memberId: string,
    isPresent: boolean
  ) => {
    const payload = { memberId: memberId as any, date: todayIso } as any;
    if (isPresent) await unmarkPresent(payload);
    else await markPresent(payload);
  };

  return (
    <div
      className="text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <SignedOut>
        <div className="max-w-3xl mx-auto p-8">
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
            <p className="mb-4 text-zinc-700">Please sign in to mark attendance.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Header - glass effect */}
        <div className="backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <div>
              <h1 className="text-3xl md:text-[2.1rem] font-light tracking-tight text-zinc-900">Attendance</h1>
              <p className="text-sm text-zinc-600">Mark arrivals quickly and accurately</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
          {/* Highlights */}
          <HighlightsPanel
            dateStr={formatDate(new Date())}
            dateIso={todayIso}
            total={members.length}
            present={presentTodayCount}
          />

          {/* Gender Tabs */}
          <div className="border-b border-white/20">
            <div className="flex items-center gap-6 overflow-x-auto">
              {([
                { key: "all", label: "All" },
                { key: "male", label: "Male" },
                { key: "female", label: "Female" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`pb-2 -mb-px text-sm whitespace-nowrap transition-colors border-b-2 ${
                    tab === t.key
                      ? "text-[#303030] border-[#303030]"
                      : "text-[#89888a] border-transparent hover:text-[#303030]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + page size (client-side) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, residence, department, status"
              className="w-full md:max-w-md px-4 py-2.5 rounded-full border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex items-center justify-between md:justify-start gap-2 text-sm text-zinc-700">
              <span>Per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize((Number(e.target.value) as 10 | 20))}
                className="px-3 py-1.5 rounded-full border border-zinc-200 bg-white/70 backdrop-blur text-sm outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          {/* Mobile roster (cards) */}
          {searched.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white/30 backdrop-blur-xl text-center">
              <EmptyState icon="👥" title="No members found" description={"No members available for this tab."} />
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {paged.map((m) => {
                  const wasPresentToday = m.presentToday;
                  return (
                    <div
                      key={m.memberId as any}
                      className="rounded-2xl bg-white/60 backdrop-blur-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                wasPresentToday ? "bg-emerald-500" : "bg-zinc-400"
                              }`}
                            />
                            <div className="text-sm font-light text-zinc-900 truncate">
                              {m.name}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            {m.contact ?? "-"}
                            {m.residence ? ` • ${m.residence}` : ""}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-white/40 text-xs text-zinc-900 capitalize">
                            {m.gender ?? "-"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-zinc-700">
                          {m.lastAttendance ? (
                            <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/40">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  m.lastAttendance.present ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span
                                className={
                                  m.lastAttendance.present
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }
                              >
                                {m.lastAttendance.present ? "Present" : "Absent"}
                              </span>
                              <span className="text-zinc-500">{formatIsoDate(m.lastAttendance.date)}</span>
                            </span>
                          ) : (
                            <span className="italic text-zinc-500">No records</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          className={`w-full px-3 py-2 rounded-full text-sm font-light transition-colors ${
                            wasPresentToday
                              ? "bg-zinc-900/80 text-white hover:bg-zinc-900"
                              : "bg-amber-300/70 text-zinc-900 hover:bg-amber-300"
                          }`}
                          onClick={() =>
                            handleToggleAttendance(
                              m.memberId as any,
                              Boolean(wasPresentToday)
                            )
                          }
                        >
                          {wasPresentToday ? "Unmark" : "Mark Present"}
                        </button>
                        <button
                          className="w-full px-3 py-2 rounded-full text-sm font-light bg-white/70 text-zinc-900 hover:bg-white"
                          onClick={() => {
                            setEditingMember({
                              memberId: m.memberId as any,
                              name: m.name,
                              contact: m.contact ?? null,
                              residence: m.residence ?? null,
                              gender: m.gender ?? null,
                              department: (m as any).department ?? null,
                              status: (m as any).status ?? null,
                            });
                            setEditorOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-2xl bg-white/60 backdrop-blur-xl">
                <table className="min-w-full table-auto border-separate border-spacing-y-1 border-spacing-x-0">
                  <thead className="sticky top-0 z-10 bg-white/70 backdrop-blur-xl">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Name</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Phone</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Residence</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Gender</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Last Attendance</th>
                      <th className="px-5 py-4 text-right text-xs font-light tracking-wide text-zinc-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((m) => {
                      const wasPresentToday = m.presentToday;
                      return (
                        <tr key={m.memberId as any} className="hover:bg-white/35 transition-colors">
                          <td className="px-5 py-3 text-sm font-light text-zinc-900 rounded-l-xl">
                            <span className="inline-flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${wasPresentToday ? "bg-emerald-500" : "bg-zinc-400"}`} />
                              {m.name}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-800">{m.contact ?? "-"}</td>
                          <td className="px-5 py-3 text-sm text-zinc-800">{m.residence ?? "-"}</td>
                          <td className="px-5 py-3 text-sm text-zinc-800 capitalize">
                            <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900">{m.gender ?? "-"}</span>
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-800">
                            {m.lastAttendance ? (
                              <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl">
                                <span className={`h-2 w-2 rounded-full ${m.lastAttendance.present ? "bg-emerald-500" : "bg-rose-500"}`} />
                                <span className={m.lastAttendance.present ? "text-emerald-700" : "text-rose-700"}>
                                  {m.lastAttendance.present ? "Present" : "Absent"}
                                </span>
                                <span className="text-zinc-500">{formatIsoDate(m.lastAttendance.date)}</span>
                              </span>
                            ) : (
                              <span className="italic text-zinc-500">No records</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm rounded-r-xl">
                            <div className="flex justify-end">
                              <button
                                className={`px-3 py-2 rounded-full text-sm font-light transition-colors cursor-pointer hover:scale-105 transition-transform ${
                                  wasPresentToday
                                    ? "bg-zinc-900/80 text-white hover:bg-zinc-900"
                                    : "bg-amber-300/70 text-zinc-900 hover:bg-amber-300"
                                }`}
                                onClick={() => handleToggleAttendance(m.memberId as any, Boolean(wasPresentToday))}
                              >
                                {wasPresentToday ? "Unmark" : "Mark Present"}
                              </button>
                              <button
                                className="ml-2 px-3 py-2 rounded-full text-sm font-light bg-white/60 text-zinc-900 hover:bg-white cursor-pointer"
                                onClick={() => {
                                  setEditingMember({
                                    memberId: m.memberId as any,
                                    name: m.name,
                                    contact: m.contact ?? null,
                                    residence: m.residence ?? null,
                                    gender: m.gender ?? null,
                                    department: (m as any).department ?? null,
                                    status: (m as any).status ?? null,
                                  });
                                  setEditorOpen(true);
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination controls */}
          {searched.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm text-zinc-700">
              <div>
                Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, searched.length)} of {searched.length}
              </div>
              <div className="flex items-center justify-between md:justify-end gap-2">
                <button
                  className="px-3 py-2 rounded-full bg-white/70 backdrop-blur border border-zinc-200 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  className="px-3 py-2 rounded-full bg-white/70 backdrop-blur border border-zinc-200 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
      {editingMember && (
        <MemberEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          member={editingMember}
          onSaved={() => setToast("Member updated")}
        />
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[11000] px-3 py-2 rounded-full bg-emerald-500 text-white text-sm shadow">
          {toast}
        </div>
      )}
    </div>
  );
}

function HighlightsPanel({ dateStr, dateIso, total, present }: { dateStr: string; dateIso: string; total: number; present: number }) {
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  const absent = total - present;
  return (
    <div className="rounded-2xl p-4 md:p-5 bg-zinc-900/90 text-white">
      {/* Top chips condensed */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">{dateStr}</span>
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Members: {total}</span>
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Present Today: {present}</span>
        </div>
        <div className="w-full sm:w-auto">
          <QuickAddMember dateIso={dateIso} />
        </div>
      </div>

      {/* Stats + rate */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-8">
          <Stat label="Today" value={`${present} / ${total}`} />
          <Stat label="Absent" value={`${absent}`} />
        </div>
        <div className="flex-1 max-w-xl">
          <div className="text-sm mb-1">ATTENDANCE RATE</div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${rate}%` }} />
          </div>
          <div className="text-xs mt-1">{rate}%</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/70">{label}</span>
      <span className="text-xl font-medium">{value}</span>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-3xl">{icon}</div>
      <div className="text-zinc-900">{title}</div>
      <div className="text-sm text-zinc-600">{description}</div>
    </div>
  );
}
