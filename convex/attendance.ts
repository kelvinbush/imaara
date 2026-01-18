import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const markPresent = mutation({
  args: {
    memberId: v.union(v.id("members"), v.id("kids")),
    date: v.string(), // ISO date string e.g. 2026-01-10
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) =>
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { present: true, markedBy: identity.subject });
      return existing._id;
    }

    return await ctx.db.insert("attendance", {
      memberId: args.memberId,
      date: args.date,
      present: true,
      markedBy: identity.subject,
    });
  },
});

export const unmarkPresent = mutation({
  args: {
    memberId: v.union(v.id("members"), v.id("kids")),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) =>
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { present: false, markedBy: identity.subject });
      return existing._id;
    }

    // No existing record; do nothing (or create an explicit absent record if desired)
    return null;
  },
});

export const attendanceByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const statusForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const presentSet = new Set(records.filter((r) => r.present).map((r) => r.memberId));

    const [members, kids] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
    ]);

    const all = [...members, ...kids];
    return all.map((m) => ({ memberId: m._id, present: presentSet.has(m._id) }));
  },
});

export const historyForMember = query({
  args: { memberId: v.union(v.id("members"), v.id("kids")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const records = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId))
      .collect();

    // Sort by date descending (assuming ISO date string)
    return records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },
});

export const rosterForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [members, kids, todays] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
    ]);

    const presentSet = new Set(todays.filter((r) => r.present).map((r) => r.memberId));

    const all = [
      ...members.map((m) => ({ ...m, type: "member" as const })),
      ...kids.map((k) => ({ ...k, type: "kid" as const })),
    ];

    // For last attendance per member, query per member (acceptable for current scale)
    const withLast = await Promise.all(
      all.map(async (m) => {
        const last = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", m._id))
          .collect();
        last.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        return {
          memberId: m._id,
          name: m.name,
          contact: m.contact,
          residence: m.residence,
          gender: m.type === "member" ? m.gender : null,
          department: m.type === "member" ? (m as any).department : null,
          status: m.type === "member" ? (m as any).status : null,
          type: m.type,
          presentToday: presentSet.has(m._id),
          lastAttendance: mostRecent
            ? { date: mostRecent.date, present: mostRecent.present }
            : null,
        };
      })
    );

    return withLast;
  },
});

export const recentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(50, args.limit ?? 10));
    const records = await ctx.db.query("attendance").order("desc").take(limit);

    const result = await Promise.all(
      records.map(async (r) => {
        const m = await ctx.db.get(r.memberId);
        return {
          _id: r._id,
          date: r.date,
          present: r.present,
          memberId: r.memberId,
          memberName: m?.name ?? "Unknown",
          createdAt: r._creationTime,
        };
      })
    );
    return result;
  },
});

export const recentRollCalls = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(60, args.limit ?? 20));

    // Convex doesn't provide a native group-by; we build a small list of unique
    // dates from recent attendance rows, then compute per-date counts.
    const seed = await ctx.db.query("attendance").order("desc").take(2000);
    const uniqueDates: string[] = [];
    const seen = new Set<string>();
    for (const r of seed) {
      if (seen.has(r.date)) continue;
      seen.add(r.date);
      uniqueDates.push(r.date);
      if (uniqueDates.length >= limit) break;
    }

    const summaries = await Promise.all(
      uniqueDates.map(async (date) => {
        const rows = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", date))
          .collect();
        const total = rows.length;
        const present = rows.filter((r) => r.present).length;
        return { date, total, present, absent: Math.max(0, total - present) };
      })
    );

    // ISO date strings sort lexicographically.
    summaries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return summaries;
  },
});
