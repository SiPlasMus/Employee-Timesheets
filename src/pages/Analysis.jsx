import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { ACTIVITY_TYPES } from "../components/activityTypes";

function yyyymm(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function ymdFromSap(dt) {
    // "2025-12-02 00:00:00.000..." -> "2025-12-02"
    return String(dt || "").slice(0, 10);
}

function sapIntToMinutes(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    const s = String(Math.max(0, n)).padStart(4, "0");
    const hh = Number(s.slice(0, 2));
    const mm = Number(s.slice(2, 4));
    return hh * 60 + mm;
}

function minutesBetweenSapTimes(st, en) {
    const a = sapIntToMinutes(st);
    const b = sapIntToMinutes(en);
    return Math.max(0, b - a);
}

function fmtHours(mins) {
    return (Number(mins || 0) / 60).toFixed(2);
}

export default function Analysis() {
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
            // load cost centers (optional but nice)
            if (ccMap.size === 0) {
                try {
                    const rcc = await api.get("/hana/cost-centers");
                    const list = rcc.data?.items || [];
                    setCcMap(new Map(list.map((x) => [String(x.code), String(x.name)])));
                } catch (_) {}
            }

            const r = await api.get(`/hana/timesheets/lines/${empId}`, {
                params: { month },
            });
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

    const totalMins = useMemo(() => {
        return items.reduce(
            (sum, r) => sum + minutesBetweenSapTimes(r.StartTime, r.EndTime),
            0
        );
    }, [items]);

    const byAct = useMemo(() => {
        const map = new Map(); // actType -> minutes
        for (const r of items) {
            const key = String(r.ActType ?? "");
            const mins = minutesBetweenSapTimes(r.StartTime, r.EndTime);
            map.set(key, (map.get(key) || 0) + mins);
        }
        return Array.from(map.entries())
            .map(([k, mins]) => ({
                key: k,
                name: actMap.get(k) || `ActType ${k}`,
                mins,
            }))
            .sort((a, b) => b.mins - a.mins);
    }, [items, actMap]);

    const byCC = useMemo(() => {
        const map = new Map(); // costCenter -> minutes
        for (const r of items) {
            const key = String(r.CostCenter || "");
            if (!key) continue;
            const mins = minutesBetweenSapTimes(r.StartTime, r.EndTime);
            map.set(key, (map.get(key) || 0) + mins);
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
        const map = new Map(); // date -> minutes
        for (const r of items) {
            const d = ymdFromSap(r.Date);
            const mins = minutesBetweenSapTimes(r.StartTime, r.EndTime);
            map.set(d, (map.get(d) || 0) + mins);
        }
        return Array.from(map.entries())
            .map(([d, mins]) => ({ date: d, mins }))
            .sort((a, b) => (a.date < b.date ? 1 : -1)); // desc
    }, [items]);

    return (
        <div className="mx-auto max-w-5xl px-4 py-4 pb-48">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="text-xl font-extrabold">Analysis</div>
                    <div className="text-sm text-slate-500">Monthly summary</div>
                </div>

                <div className="flex items-end gap-2">
                    <div className="w-40">
                        <div className="mb-1 text-xs font-semibold text-slate-600">Month</div>
                        <Input
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            placeholder="YYYY-MM"
                        />
                    </div>

                    <Button className="h-11" variant="secondary" onClick={load} disabled={loading}>
                        {loading ? "Loading..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {err && (
                <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                    {err}
                </div>
            )}

            {/* Top cards */}
            <div className="grid gap-3 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <div className="text-sm text-slate-500">Total hours</div>
                        <div className="text-2xl font-extrabold">⏱ {fmtHours(totalMins)}h</div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-slate-600">Entries: {items.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="text-sm text-slate-500">Top activity</div>
                        <div className="text-xl font-extrabold">
                            {byAct[0]?.name || "—"}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-slate-600">
                            {byAct[0] ? `${fmtHours(byAct[0].mins)}h` : "—"}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="text-sm text-slate-500">Top cost center</div>
                        <div className="text-xl font-extrabold">
                            {byCC[0]?.name || "—"}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-slate-600">
                            {byCC[0] ? `${fmtHours(byCC[0].mins)}h` : "—"}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lists */}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="text-lg font-extrabold">📌 By activity type</div>
                        <div className="text-sm text-slate-500">Top 8</div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {byAct.slice(0, 8).map((x) => (
                                <div key={x.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="font-semibold text-slate-800">{x.name}</div>
                                    <div className="font-semibold text-slate-900">{fmtHours(x.mins)}h</div>
                                </div>
                            ))}
                            {!byAct.length && <div className="text-sm text-slate-500">No data</div>}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="text-lg font-extrabold">🏷 By cost center</div>
                        <div className="text-sm text-slate-500">Top 8</div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {byCC.slice(0, 8).map((x) => (
                                <div key={x.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="font-semibold text-slate-800">{x.name}</div>
                                    <div className="font-semibold text-slate-900">{fmtHours(x.mins)}h</div>
                                </div>
                            ))}
                            {!byCC.length && <div className="text-sm text-slate-500">No cost centers</div>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-3">
                <Card>
                    <CardHeader>
                        <div className="text-lg font-extrabold">📅 Daily totals</div>
                        <div className="text-sm text-slate-500">Newest first</div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {byDay.map((d) => (
                                <div key={d.date} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="font-semibold text-slate-900">{d.date}</div>
                                    <div className="font-semibold text-slate-900">{fmtHours(d.mins)}h</div>
                                </div>
                            ))}
                            {!byDay.length && <div className="text-sm text-slate-500">No days</div>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
