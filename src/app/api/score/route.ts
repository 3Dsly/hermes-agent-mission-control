/**
 * Momentum Score — Weekly Performance Score (last 7 days)
 *
 * Components:
 *   X Performance   40%  — Weekly tweet views + engagement
 *   YouTube Growth  25%  — New subscribers this week
 *   Content Output  35%  — Posts made + quality this week
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);

  // ── 1. X Performance (40%) ─────────────────────────────────
  let weeklyViews    = parseInt(process.env.X_WEEKLY_VIEWS || "0");
  let weeklyPosts    = 0;
  let bestTweetViews = parseInt(process.env.X_BEST_TWEET_VIEWS || "0");

  if (weeklyViews === 0 || weeklyPosts === 0) {
    try {
      const drafts = await prisma.draft.findMany({ where: { postedAt: { gte: weekAgo } } });
      weeklyPosts = drafts.length;
      for (const d of drafts) {
        const m = d.metrics as Record<string, unknown> | null;
        const v = typeof m?.views === "number" ? m.views : 0;
        if (weeklyViews === 0) weeklyViews += v;
        if (v > bestTweetViews) bestTweetViews = v;
      }
    } catch { /* Prisma may be unavailable */ }
  } else {
    try {
      weeklyPosts = await prisma.draft.count({ where: { postedAt: { gte: weekAgo } } });
    } catch { weeklyPosts = 0; } // honest: no fake substitute when the DB read fails
  }

  const xScore = weeklyViews >= 1_000_000 ? 100
    : weeklyViews >= 500_000  ? 92
    : weeklyViews >= 200_000  ? 82
    : weeklyViews >= 100_000  ? 72
    : weeklyViews >= 50_000   ? 60
    : weeklyViews >= 10_000   ? 45
    : weeklyViews >= 1_000    ? 25
    : 10;

  // ── 2. YouTube Growth (25%) ────────────────────────────────
  const currentYtSubs = parseInt(process.env.YT_SUBSCRIBERS || "0");
  let ytGrowth    = parseInt(process.env.YT_WEEK_NEW_SUBS || "0");
  let ytSubsWeekAgo = ytGrowth > 0 ? currentYtSubs - ytGrowth : currentYtSubs;

  if (ytGrowth === 0) {
    try {
      const row = await prisma.dataStore.findUnique({ where: { key: "score-snapshots" } });
      const snapshots = (row?.data as any[]) ?? [];
      const target = new Date(weekAgo).toISOString().slice(0, 10);
      const past = snapshots.filter((s: any) => s.date <= target).sort((a: any, b: any) => b.date.localeCompare(a.date));
      if (past.length > 0) {
        ytSubsWeekAgo = past[0].ytSubscribers;
        ytGrowth = Math.max(0, currentYtSubs - ytSubsWeekAgo);
      }
    } catch { /* ignore */ }
  }

  const ytGrowthPct = ytSubsWeekAgo > 0 ? (ytGrowth / ytSubsWeekAgo) * 100 : 0;

  const ytScoreFromGrowth = ytGrowth >= 1000 ? 100
    : ytGrowth >= 500 ? 90
    : ytGrowth >= 200 ? 80
    : ytGrowth >= 100 ? 70
    : ytGrowth >= 50  ? 58
    : ytGrowth >= 20  ? 45
    : ytGrowth >= 5   ? 30
    : ytGrowth >= 1   ? 15
    : 5;

  const ytGrowthBonus = ytGrowthPct >= 200 ? 15
    : ytGrowthPct >= 100 ? 10
    : ytGrowthPct >= 50  ? 5
    : 0;

  const ytScore = Math.min(100, ytScoreFromGrowth + ytGrowthBonus);

  // ── 3. Content Output (35%) ───────────────────────────────
  const consistencyScore = weeklyPosts >= 7 ? 100
    : weeklyPosts >= 5 ? 88
    : weeklyPosts >= 3 ? 75
    : weeklyPosts >= 2 ? 62
    : weeklyPosts >= 1 ? 50
    : 10;

  const viralBonus = bestTweetViews >= 1_000_000 ? 12
    : bestTweetViews >= 500_000 ? 8
    : bestTweetViews >= 100_000 ? 4
    : 0;

  const contentScore = Math.min(100, consistencyScore + viralBonus);

  // ── Final score ────────────────────────────────────────────
  const raw   = xScore * 0.40 + ytScore * 0.25 + contentScore * 0.35;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";
  const label = score >= 90 ? "Legendary" : score >= 80 ? "On Fire 🔥" : score >= 70 ? "Crushing It" : score >= 60 ? "Solid" : score >= 50 ? "Building" : "Slow Week";
  const color = score >= 75 ? "emerald" : score >= 55 ? "yellow" : "red";

  return NextResponse.json({
    score, grade, label, color,
    period: "last 7 days",
    components: {
      x:       { score: Math.round(xScore),       weight: 0.40, label: "X Performance",    detail: weeklyViews > 0 ? `${(weeklyViews/1000).toFixed(0)}K views` : "No data" },
      youtube: { score: Math.round(ytScore),      weight: 0.25, label: "YouTube Growth",   detail: ytGrowth > 0 ? `+${ytGrowth} subs (${ytGrowthPct.toFixed(0)}%)` : "Tracking..." },
      content: { score: Math.round(contentScore), weight: 0.35, label: "Content Output",   detail: `${weeklyPosts} posts${bestTweetViews > 100000 ? ` · ${(bestTweetViews/1000000).toFixed(1)}M best` : ""}` },
    },
    inputs: {
      weeklyViews, weeklyPosts, bestTweetViews,
      currentYtSubs, ytSubsWeekAgo, ytGrowth, ytGrowthPct,
    },
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
