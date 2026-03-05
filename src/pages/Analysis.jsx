import React, { useEffect, useMemo, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
    ReferenceLine, LabelList,
} from "recharts";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { ACTIVITY_TYPES } from "../components/activityTypes";
import ClaudeAnalysis from "../components/ClaudeAnalysis";
import { useTheme } from "../hooks/useTheme";

// ─── Utilities ────────────────────────────────────────────────────────────────

function yyyymm(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ymdFromSap(dt) {
    return String(dt || "").slice(0, 10);
}

function sapIntToMinutes(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    const s = String(Math.max(0, n)).padStart(4, "0");
    return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4));
}

function breakToMinutes(v) {
    if (v == null) return 0;
    if (typeof v === "number" && Number.isFinite(v)) {
        const n = Math.max(0, v);
        if (n <= 2359) {
            const s = String(Math.floor(n)).padStart(4, "0");
            const hh = Number(s.slice(0, 2));
            const mm = Number(s.slice(2, 4));
            if (hh <= 23 && mm <= 59) return hh * 60 + mm;
        }
        return Math.max(0, Math.floor(n));
    }
    const s = String(v).trim();
    if (/^\d{1,4}$/.test(s)) {
        const n = Number(s);
        const ss = String(n).padStart(4, "0");
        const hh = Number(ss.slice(0, 2));
        const mm = Number(ss.slice(2, 4));
        if (hh <= 23 && mm <= 59) return hh * 60 + mm;
        return n;
    }
    const parts = s.split(":").map(Number);
    if (parts.some((x) => !Number.isFinite(x))) return 0;
    if (parts.length === 3) return Math.max(0, parts[0] * 60 + parts[1] + (parts[2] >= 30 ? 1 : 0));
    if (parts.length === 2) return Math.max(0, parts[0] + (parts[1] >= 30 ? 1 : 0));
    return 0;
}

function calcLineMins(row) {
    const gross = Math.max(0, sapIntToMinutes(row.EndTime) - sapIntToMinutes(row.StartTime));
    const br = breakToMinutes(row.Break);
    return { gross, breakMins: br, net: Math.max(0, gross - br) };
}

function fmtH(mins) {
    const m = Math.max(0, Math.round(Number(mins || 0)));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0 && mm > 0) return `${h}h ${mm}m`;
    if (h > 0) return `${h}h`;
    return `${mm}m`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
    "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
    "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
    "#84cc16", "#f97316",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, bgClass, textClass }) {
    return (
        <Card className="overflow-hidden">
            <div className="p-4">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ${bgClass} ${textClass}`}>
                    {icon}
                </div>
                <div className="truncate text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {value}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {label}
                </div>
            </div>
        </Card>
    );
}

function ChartCard({ title, subtitle, children }) {
    return (
        <Card>
            <CardHeader>
                <div className="font-extrabold text-slate-900 dark:text-slate-100">{title}</div>
                {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>}
            </CardHeader>
            <CardContent className="pt-1">{children}</CardContent>
        </Card>
    );
}

// Custom recharts tooltip
function CustomTooltip({ active, payload, label, tooltipStyle }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ ...tooltipStyle, padding: "8px 12px", fontSize: 13 }}>
            {label && (
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
            )}
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color }}>
                    {p.name}: <strong>{p.value}h</strong>
                </div>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Analysis() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const [month, setMonth] = useState(yyyymm());
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [items, setItems] = useState([]);
    const [ccMap, setCcMap] = useState(() => new Map());

    const empId = Number(localStorage.getItem("et_empId") || 0);

    const actMap = useMemo(
        () => new Map(ACTIVITY_TYPES.map((a) => [String(a.id), a.name])),
        []
    );

    async function load() {
        setErr("");
        if (!empId) return setErr("empId missing. Please login again.");
        setLoading(true);
        try {
            if (ccMap.size === 0) {
                try {
                    const rcc = await api.get("/hana/cost-centers");
                    const list = rcc.data?.items || [];
                    setCcMap(new Map(list.map((x) => [String(x.code), String(x.name)])));
                } catch (_) {}
            }
            const r = await api.get(`/hana/timesheets/lines/${empId}`, { params: { month } });
            setItems(r.data?.items || []);
        } catch (e) {
            setErr(e?.response?.data?.error || e.message || "Error");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month]);

    // ── Aggregations ──────────────────────────────────────────────────────────

    const totals = useMemo(() =>
        items.reduce(
            (acc, r) => {
                const { gross, breakMins, net } = calcLineMins(r);
                acc.gross += gross; acc.breaks += breakMins; acc.net += net;
                return acc;
            },
            { gross: 0, breaks: 0, net: 0 }
        ), [items]);

    const byAct = useMemo(() => {
        const map = new Map();
        for (const r of items) {
            const key = String(r.ActType ?? "");
            const { net } = calcLineMins(r);
            map.set(key, (map.get(key) || 0) + net);
        }
        return Array.from(map.entries())
            .map(([k, mins]) => ({ key: k, name: actMap.get(k) || `ActType ${k}`, mins }))
            .sort((a, b) => b.mins - a.mins);
    }, [items, actMap]);

    const byCC = useMemo(() => {
        const map = new Map();
        for (const r of items) {
            const key = String(r.CostCenter || "");
            if (!key) continue;
            const { net } = calcLineMins(r);
            map.set(key, (map.get(key) || 0) + net);
        }
        return Array.from(map.entries())
            .map(([k, mins]) => ({
                key: k,
                name: ccMap.get(k) ? `${ccMap.get(k)} (${k})` : k,
                mins,
            }))
            .sort((a, b) => b.mins - a.mins);
    }, [items, ccMap]);

    const byDay = useMemo(() => {
        const map = new Map();
        for (const r of items) {
            const d = ymdFromSap(r.Date);
            const { net } = calcLineMins(r);
            map.set(d, (map.get(d) || 0) + net);
        }
        return Array.from(map.entries())
            .map(([d, mins]) => ({ date: d, mins }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
    }, [items]);

    // ── Chart data ────────────────────────────────────────────────────────────

    const dailyChartData = useMemo(() =>
        [...byDay]
            .sort((a, b) => (a.date > b.date ? 1 : -1))
            .map((d) => ({
                day: d.date.slice(8),
                label: d.date,
                hours: parseFloat((d.mins / 60).toFixed(2)),
            })),
        [byDay]
    );

    const actChartData = useMemo(() =>
        byAct.slice(0, 8).map((x) => ({
            name: x.name,
            hours: parseFloat((x.mins / 60).toFixed(1)),
        })),
        [byAct]
    );

    const ccChartData = useMemo(() =>
        byCC.slice(0, 6).map((x) => ({
            name: x.name.length > 20 ? x.name.slice(0, 17) + "…" : x.name,
            hours: parseFloat((x.mins / 60).toFixed(1)),
        })),
        [byCC]
    );

    const avgDailyMins = byDay.length ? totals.net / byDay.length : 0;
    const avgDailyHours = parseFloat((avgDailyMins / 60).toFixed(2));

    // ── Theme tokens for charts ───────────────────────────────────────────────

    const gridStroke = isDark ? "#334155" : "#e2e8f0";
    const tickColor = isDark ? "#94a3b8" : "#64748b";
    const tooltipStyle = {
        background: isDark ? "#1e293b" : "#fff",
        border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        borderRadius: 12,
        color: isDark ? "#f1f5f9" : "#0f172a",
    };
    const cursorStyle = { fill: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)" };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="mx-auto max-w-5xl px-3 py-4 pb-32">

            {/* ── Header ── */}
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                        Dashboard
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {month} · {items.length} entries
                    </div>
                </div>
                <div className="flex items-end gap-2">
                    <div>
                        <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Month</div>
                        <Input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-40 h-9 text-sm"
                        />
                    </div>
                    <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
                        {loading ? "Loading…" : "Refresh"}
                    </Button>
                </div>
            </div>

            {err && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                    {err}
                </div>
            )}

            {/* ── KPI Cards ── */}
            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Total hours"
                    value={fmtH(totals.net)}
                    icon="⏱"
                    bgClass="bg-indigo-100 dark:bg-indigo-900/30"
                    textClass="text-indigo-600 dark:text-indigo-400"
                />
                <KpiCard
                    label="Working days"
                    value={String(byDay.length || "—")}
                    icon="📅"
                    bgClass="bg-sky-100 dark:bg-sky-900/30"
                    textClass="text-sky-600 dark:text-sky-400"
                />
                <KpiCard
                    label="Avg per day"
                    value={byDay.length ? fmtH(Math.round(avgDailyMins)) : "—"}
                    icon="⚡"
                    bgClass="bg-emerald-100 dark:bg-emerald-900/30"
                    textClass="text-emerald-600 dark:text-emerald-400"
                />
                <KpiCard
                    label="Top activity"
                    value={byAct[0]?.name || "—"}
                    icon="📌"
                    bgClass="bg-amber-100 dark:bg-amber-900/30"
                    textClass="text-amber-600 dark:text-amber-400"
                />
            </div>

            {/* ── Daily Hours Chart ── */}
            {dailyChartData.length > 0 && (
                <div className="mb-3">
                    <ChartCard
                        title="Daily Hours"
                        subtitle={`Avg ${avgDailyHours}h/day · dashed line = average`}
                    >
                        <ResponsiveContainer width="100%" height={210}>
                            <BarChart
                                data={dailyChartData}
                                margin={{ top: 6, right: 8, bottom: 4, left: -18 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={gridStroke}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="day"
                                    tick={{ fill: tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={dailyChartData.length > 20 ? 4 : 1}
                                />
                                <YAxis
                                    tick={{ fill: tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `${v}h`}
                                />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    cursor={cursorStyle}
                                    formatter={(v) => [`${v}h`, "Hours"]}
                                    labelFormatter={(l) => `Day ${l}`}
                                />
                                <ReferenceLine
                                    y={avgDailyHours}
                                    stroke="#6366f1"
                                    strokeDasharray="5 3"
                                    strokeWidth={1.5}
                                />
                                <Bar
                                    dataKey="hours"
                                    name="Hours"
                                    fill="#6366f1"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={30}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
            )}

            {/* ── Activity + Cost Center Row ── */}
            <div className="mb-3 grid gap-3 md:grid-cols-2">

                {/* Activity Donut */}
                {actChartData.length > 0 && (
                    <ChartCard title="By Activity" subtitle="Time distribution">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={actChartData}
                                    dataKey="hours"
                                    nameKey="name"
                                    cx="50%"
                                    cy="42%"
                                    innerRadius={52}
                                    outerRadius={80}
                                    paddingAngle={2}
                                >
                                    {actChartData.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    formatter={(v, name) => [`${v}h`, name]}
                                />
                                <Legend
                                    iconType="circle"
                                    iconSize={7}
                                    wrapperStyle={{ fontSize: 11, color: tickColor, paddingTop: 4 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {/* Cost Center Horizontal Bars */}
                {ccChartData.length > 0 && (
                    <ChartCard
                        title="By Cost Center"
                        subtitle={`Top ${ccChartData.length}`}
                    >
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart
                                layout="vertical"
                                data={ccChartData}
                                margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={gridStroke}
                                    horizontal={false}
                                />
                                <XAxis
                                    type="number"
                                    tick={{ fill: tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `${v}h`}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={88}
                                    tick={{ fill: tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    cursor={cursorStyle}
                                    formatter={(v) => [`${v}h`, "Hours"]}
                                />
                                <Bar
                                    dataKey="hours"
                                    name="Hours"
                                    fill="#10b981"
                                    radius={[0, 4, 4, 0]}
                                    maxBarSize={22}
                                >
                                    <LabelList
                                        dataKey="hours"
                                        position="right"
                                        style={{ fill: tickColor, fontSize: 11 }}
                                        formatter={(v) => `${v}h`}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            {/* ── Activity Breakdown List (fallback / no CC) ── */}
            {actChartData.length === 0 && ccChartData.length === 0 && !loading && !err && items.length === 0 && (
                <Card className="mb-3">
                    <CardContent>
                        <div className="py-10 text-center">
                            <div className="mb-3 text-5xl">📊</div>
                            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                No data for {month}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Claude ── */}
            <ClaudeAnalysis
                month={month}
                totals={totals}
                byAct={byAct}
                byCC={byCC}
                byDay={byDay}
            />
        </div>
    );
}
