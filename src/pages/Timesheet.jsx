import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";

function yyyymm(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

// SAP stores times like 1530, 920, 5 etc. -> "15:30"
function hhmmFromSapInt(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "--:--";
    const s = String(Math.max(0, n)).padStart(4, "0");
    return `${s.slice(0, 2)}:${s.slice(2)}`;
}

// date "2025-12-01 00:00:00.000000000" -> "2025-12-01"
function ymdFromSap(v) {
    const s = String(v || "");
    return s.slice(0, 10);
}

// duration minutes from start/end ints like 1530 -> 17:00
function minutesBetweenSapTimes(startInt, endInt) {
    const toMin = (x) => {
        const s = String(Math.max(0, Number(x) || 0)).padStart(4, "0");
        const hh = Number(s.slice(0, 2));
        const mm = Number(s.slice(2, 4));
        return hh * 60 + mm;
    };
    const a = toMin(startInt);
    const b = toMin(endInt);
    return Math.max(0, b - a);
}

function fmtHours(mins) {
    const h = mins / 60;
    return h.toFixed(h % 1 === 0 ? 0 : 2);
}

export default function Timesheet() {
    const [month, setMonth] = useState(yyyymm());
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [items, setItems] = useState([]);
    const [userId, setUserId] = useState(() => {
        // simplest: token payload decode is extra; for now let user enter, or store after login
        // If you already know empId equals userId, store it in localStorage during login later.
        return Number(localStorage.getItem("et_empId") || 0) || 0;
    });

    async function load() {
        setErr("");
        setLoading(true);
        try {
            if (!userId) throw new Error("No userId. Save empId after login (or set it manually).");

            const r = await api.get(`/hana/timesheets/lines/${userId}`, {
                params: { month },
            });
            setItems(r.data?.items || []);
        } catch (e) {
            setErr(e?.response?.data?.error || e.message);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month]);

    const grouped = useMemo(() => {
        const map = new Map();
        for (const row of items) {
            const d = ymdFromSap(row.Date);
            if (!map.has(d)) map.set(d, []);
            map.get(d).push(row);
        }
        return Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1));
    }, [items]);

    const totalMins = useMemo(() => {
        return items.reduce((sum, r) => sum + minutesBetweenSapTimes(r.StartTime, r.EndTime), 0);
    }, [items]);

    return (
        <div className="mx-auto max-w-3xl px-4 py-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[180px]">
                            <div className="text-sm font-semibold text-slate-600">Month</div>
                            <Input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>

                        {/*<div className="min-w-[140px]">
                            <div className="text-sm font-semibold text-slate-600">UserID</div>
                            <Input
                                value={userId || ""}
                                onChange={(e) => {
                                    const v = Number(e.target.value || 0);
                                    setUserId(v);
                                    localStorage.setItem("et_empId", String(v || ""));
                                }}
                                placeholder="e.g. 13"
                            />
                        </div>*/}

                        <div className="ml-auto flex items-center gap-2">
                            <Button variant="secondary" onClick={load} disabled={loading}>
                                {loading ? "Loading..." : "Refresh"}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm">
                        <div className="font-semibold text-slate-700">
                            Total: {fmtHours(totalMins)}h
                        </div>
                        <div className="text-slate-500">
                            ({items.length} entries)
                        </div>
                    </div>

                    {err && <div className="mt-2 text-sm font-semibold text-rose-600">{err}</div>}
                </CardHeader>

                <CardContent>
                    {grouped.length === 0 && !loading ? (
                        <div className="text-sm text-slate-500">No entries for this month.</div>
                    ) : (
                        <div className="grid gap-3">
                            {grouped.map(([date, rows]) => {
                                const dayMins = rows.reduce(
                                    (s, r) => s + minutesBetweenSapTimes(r.StartTime, r.EndTime),
                                    0
                                );
                                return (
                                    <div key={date} className="rounded-2xl border border-slate-200 p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="font-extrabold">{date}</div>
                                            <div className="text-sm font-semibold text-slate-700">
                                                {fmtHours(dayMins)}h
                                            </div>
                                        </div>

                                        <div className="mt-2 grid gap-2">
                                            {rows.map((r) => {
                                                const mins = minutesBetweenSapTimes(r.StartTime, r.EndTime);
                                                return (
                                                    <div
                                                        key={r.LineID}
                                                        className="rounded-xl bg-slate-50 p-3"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <div className="font-semibold">
                                                                {hhmmFromSapInt(r.StartTime)}–{hhmmFromSapInt(r.EndTime)}
                                                            </div>
                                                            <div className="text-sm text-slate-600">
                                                                {fmtHours(mins)}h
                                                            </div>

                                                            {r.CostCenter && (
                                                                <div className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700">
                                                                    {r.CostCenter}
                                                                </div>
                                                            )}

                                                            <div className="ml-auto text-xs text-slate-500">
                                                                ActType: {r.ActType ?? "-"}
                                                            </div>
                                                        </div>

                                                        {r.U_memo && (
                                                            <div className="mt-2 text-sm text-slate-800">
                                                                {r.U_memo}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
