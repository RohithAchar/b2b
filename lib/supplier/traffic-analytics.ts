// Supplier traffic analytics: storefront views, returning visitors and
// device mix from storefront_events. View events only — order counts are
// never treated as traffic. Pure helpers are unit-tested.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DAY_MS,
  addBucket,
  bucketLabel,
  bucketStart,
  earliestDate,
  resolvePreviousBounds,
  resolveRangeBounds,
  windowDays,
  type DashboardRange,
  type ChartGranularity,
} from "@/lib/supplier/analytics";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { changePct, type DeltaMetric } from "@/lib/supplier/sales-analytics";

export type TrafficPoint = {
  key: string;
  label: string;
  views: number;
  visitors: number;
};

export type DeviceShare = {
  label: string;
  views: number;
  sharePct: number;
};

export type TrafficAnalytics = {
  range: DashboardRange;
  totalViews: DeltaMetric;
  totalVisitors: DeltaMetric;
  avgViewsPerDay: DeltaMetric;
  returningVisitors: {
    count: number;
    sharePct: number;
    changePct: number | null;
  };
  viewsSeries: { label: string; views: number }[];
  visitorsSeries: { label: string; visitors: number }[];
  deviceShares: DeviceShare[];
  sourceShares: { label: string; sessions: number; sharePct: number }[];
};

type ViewEventRow = {
  session_id: string;
  device: string | null;
  source: string | null;
  created_at: string;
};


/**
 * Fold view events into a continuous series — every bucket appears, even
 * empty ones. Lifetime windows start at the earliest event.
 */
export function buildTrafficSeries(args: {
  views: { created_at: string; session_id: string }[];
  from: Date | null;
  to: Date;
}): TrafficPoint[] {
  const { views, to } = args;
  const times = views
    .map((v) => new Date(v.created_at).getTime())
    .filter((t) => Number.isFinite(t) && t <= to.getTime());
  const windowStart = args.from ?? (times.length > 0 ? new Date(Math.min(...times)) : to);

  const spanMs = Math.max(to.getTime() - windowStart.getTime(), 0);
  const granularity: ChartGranularity =
    spanMs <= 2 * DAY_MS ? "hour" : spanMs <= 120 * DAY_MS ? "day" : "month";

  const first = bucketStart(windowStart, granularity);
  const points: TrafficPoint[] = [];
  const indexByKey = new Map<string, TrafficPoint>();
  for (let i = 0; ; i++) {
    const start = addBucket(first, granularity, i);
    if (start.getTime() > to.getTime()) break;
    if (points.length >= 366) break;
    const key = start.toISOString();
    const point: TrafficPoint = { key, label: bucketLabel(start, granularity), views: 0, visitors: 0 };
    points.push(point);
    indexByKey.set(key, point);
  }

  const visitorsByBucket = new Map<string, Set<string>>();
  for (const view of views) {
    const at = new Date(view.created_at);
    if (at < windowStart || at > to) continue;
    const key = bucketStart(at, granularity).toISOString();
    const point = indexByKey.get(key);
    if (!point) continue;
    point.views += 1;
    if (!visitorsByBucket.has(key)) visitorsByBucket.set(key, new Set());
    visitorsByBucket.get(key)?.add(view.session_id);
  }
  for (const point of points) {
    point.visitors = visitorsByBucket.get(point.key)?.size ?? 0;
  }
  return points;
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

function windowedViews(
  supabase: SupabaseClient,
  supplierId: string,
  from: Date | null,
  to: Date,
  label: string,
): Promise<ViewEventRow[]> {
  return fetchAllRows<ViewEventRow>(label, (offset, limit) => {
    let query = supabase
      .from("storefront_events")
      .select("session_id, device, source, created_at")
      .eq("supplier_id", supplierId)
      .eq("event", "view")
      .lt("created_at", to.toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, limit);
    if (from) query = query.gte("created_at", from.toISOString());
    return query;
  });
}

function sessionsBefore(
  supabase: SupabaseClient,
  supplierId: string,
  before: Date,
  label: string,
): Promise<{ session_id: string }[]> {
  return fetchAllRows<{ session_id: string }>(label, (offset, limit) =>
    supabase
      .from("storefront_events")
      .select("session_id")
      .eq("supplier_id", supplierId)
      .lt("created_at", before.toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, limit),
  );
}

/**
 * Fetch traffic analytics for the window plus the previous equal-length
 * window (skipped for lifetime — deltas are null there). Throws on query
 * failure so the page can render its error state.
 */
export async function getTrafficAnalytics(
  supabase: SupabaseClient,
  supplierId: string,
  range: DashboardRange,
  now: Date = new Date(),
): Promise<TrafficAnalytics> {
  const { from, to } = resolveRangeBounds(range, now);
  const previous = resolvePreviousBounds(range, now);
  const prevFrom = previous?.from ?? null;
  const prevTo = previous?.to ?? null;

  const [views, prevViews, priorSessions, prevPriorSessions] = await Promise.all([
    windowedViews(supabase, supplierId, from, to, "Traffic analytics views"),
    prevFrom && prevTo
      ? windowedViews(
          supabase,
          supplierId,
          prevFrom,
          prevTo,
          "Traffic analytics previous views",
        )
      : Promise.resolve([] as ViewEventRow[]),
    from
      ? sessionsBefore(supabase, supplierId, from, "Traffic analytics prior sessions")
      : Promise.resolve([] as { session_id: string }[]),
    prevFrom
      ? sessionsBefore(
          supabase,
          supplierId,
          prevFrom,
          "Traffic analytics previous prior sessions",
        )
      : Promise.resolve([] as { session_id: string }[]),
  ]);

  const priorSessionIds = new Set(priorSessions.map((row) => row.session_id));
  const prevPriorSessionIds = new Set(
    prevPriorSessions.map((row) => row.session_id),
  );
  const daysInWindow = windowDays(
    from,
    to,
    earliestDate(views.map((view) => view.created_at)),
  );
  const prevDaysInWindow = windowDays(
    prevFrom,
    prevTo ?? to,
    earliestDate(prevViews.map((view) => view.created_at)),
  );

  const summarize = (rows: ViewEventRow[], seenBefore: Set<string>) => {
    const visitors = new Set(rows.map((r) => r.session_id));
    let returning = 0;
    for (const session of visitors) {
      if (seenBefore.has(session)) returning += 1;
    }
    return {
      views: rows.length,
      visitors: visitors.size,
      returning,
      returningShare: visitors.size === 0 ? 0 : Math.round((returning / visitors.size) * 1000) / 10,
    };
  };

  const cur = summarize(views, priorSessionIds);
  const prev = summarize(prevViews, prevPriorSessionIds);
  const hasPrevious = prevFrom !== null;

  const byDevice = new Map<string, number>();
  for (const view of views) {
    if (!view.device) continue;
    byDevice.set(view.device, (byDevice.get(view.device) ?? 0) + 1);
  }
  const deviceTotal = [...byDevice.values()].reduce((sum, v) => sum + v, 0);
  const deviceShares = [...byDevice.entries()]
    .map(([key, viewCount]) => ({
      label: DEVICE_LABELS[key] ?? key,
      views: viewCount,
      sharePct: deviceTotal === 0 ? 0 : Math.round((viewCount / deviceTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.views - a.views);

  const SOURCE_LABELS: Record<string, string> = {
    direct: "Direct",
    search: "Search",
    social: "Social",
    referral: "Referral",
  };
  const sessionsBySource = new Map<string, Set<string>>();
  for (const view of views) {
    if (!view.source) continue;
    if (!sessionsBySource.has(view.source)) sessionsBySource.set(view.source, new Set());
    sessionsBySource.get(view.source)?.add(view.session_id);
  }
  const sourceSessionTotal = [...sessionsBySource.values()].reduce((sum, s) => sum + s.size, 0);
  const sourceShares = [...sessionsBySource.entries()]
    .map(([key, sessions]) => ({
      label: SOURCE_LABELS[key] ?? key,
      sessions: sessions.size,
      sharePct: sourceSessionTotal === 0 ? 0 : Math.round((sessions.size / sourceSessionTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const series = buildTrafficSeries({ views, from, to });

  return {
    range,
    totalViews: { value: cur.views, changePct: hasPrevious ? changePct(cur.views, prev.views) : null },
    totalVisitors: { value: cur.visitors, changePct: hasPrevious ? changePct(cur.visitors, prev.visitors) : null },
    avgViewsPerDay: {
      value: Math.round((cur.views / daysInWindow) * 10) / 10,
      changePct: hasPrevious ? changePct(cur.views / daysInWindow, prev.views / prevDaysInWindow) : null,
    },
    returningVisitors: {
      count: cur.returning,
      sharePct: cur.returningShare,
      changePct: hasPrevious ? changePct(cur.returning, prev.returning) : null,
    },
    viewsSeries: series.map((p) => ({ label: p.label, views: p.views })),
    visitorsSeries: series.map((p) => ({ label: p.label, visitors: p.visitors })),
    deviceShares,
    sourceShares,
  };
}
