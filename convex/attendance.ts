import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const markPresent = mutation({
  args: {
    memberId: v.id("members"),
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
    memberId: v.id("members"),
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

    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    return members.map((m) => ({ memberId: m._id, present: presentSet.has(m._id) }));
  },
});

export const historyForMember = query({
  args: { memberId: v.id("members") },
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

    const [members, todays] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
    ]);

    const presentSet = new Set(todays.filter((r) => r.present).map((r) => r.memberId));

    // For last attendance per member, query per member (acceptable for current scale)
    const withLast = await Promise.all(
      members.map(async (m) => {
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
          gender: m.gender,
          department: (m as any).department,
          status: (m as any).status,
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
