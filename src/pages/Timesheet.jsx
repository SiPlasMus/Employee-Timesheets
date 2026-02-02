import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { ACTIVITY_TYPES } from "../components/activityTypes";

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

function fmtHours(mins) {
    const h = mins / 60;
    return h.toFixed(h % 1 === 0 ? 0 : 2);
}

function sapIntToMinutes(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    const s = String(Math.max(0, n)).padStart(4, "0");
    const hh = Number(s.slice(0, 2));
    const mm = Number(s.slice(2, 4));
    return hh * 60 + mm;
}

function minutesBetweenSapTimes(startInt, endInt) {
    const a = sapIntToMinutes(startInt);
    const b = sapIntToMinutes(endInt);
    return Math.max(0, b - a);
}

function calcLineMins(row) {
    const gross = minutesBetweenSapTimes(row.StartTime, row.EndTime);
    const br = breakToMinutes(row.Break); // from HANA select: L."Break"
    const net = Math.max(0, gross - br);
    return { gross, breakMins: br, net };
}

function fmtHoursSmart(mins) {
    const h = Number(mins || 0) / 60;
    const rounded = Math.round(h * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function fmtBreak(mins) {
    const m = Math.max(0, Number(mins || 0));
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    if (hh <= 0) return `${mm} min`;
    return `${hh}:${String(mm).padStart(2, "0")}`;
}

// "14:00" -> 1400 (for prefill from SAP ints)
function sapIntToHHmm(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    const s = String(Math.max(0, n)).padStart(4, "0");
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

// Break from HANA line: "00:10:00" -> 10
function breakToMinutes(v) {
    if (v == null) return 0;

    // If SAP/HANA gives numeric like 100, 110 (HHMM), convert properly
    if (typeof v === "number" && Number.isFinite(v)) {
        const n = Math.max(0, v);

        // Heuristic: if it's <= 2359 and looks like HHMM, parse as time-of-day
        // This will fix 100 -> 60 mins, 110 -> 70 mins.
        if (n <= 2359) {
            const s = String(Math.floor(n)).padStart(4, "0");
            const hh = Number(s.slice(0, 2));
            const mm = Number(s.slice(2, 4));
            if (hh <= 23 && mm <= 59) return hh * 60 + mm;
        }

        // otherwise treat as minutes
        return Math.max(0, Math.floor(n));
    }

    const s = String(v).trim();

    // If numeric string like "100" -> handle HHMM
    if (/^\d{1,4}$/.test(s)) {
        const n = Number(s);
        const ss = String(n).padStart(4, "0");
        const hh = Number(ss.slice(0, 2));
        const mm = Number(ss.slice(2, 4));
        if (hh <= 23 && mm <= 59) return hh * 60 + mm;
        return n;
    }

    // "HH:MM:SS"
    const parts = s.split(":").map((x) => Number(x));
    if (parts.some((x) => !Number.isFinite(x))) return 0;

    if (parts.length === 3) {
        const [hh, mm, ss] = parts;
        return Math.max(0, hh * 60 + mm + (ss >= 30 ? 1 : 0));
    }
    if (parts.length === 2) {
        const [mm, ss] = parts;
        return Math.max(0, mm + (ss >= 30 ? 1 : 0));
    }
    return 0;
}

function fmtDuration(mins) {
    const m = Math.max(0, Math.round(Number(mins || 0)));
    const h = Math.floor(m / 60);
    const mm = m % 60;

    if (h > 0 && mm > 0) return `${h} s ${mm} m`;
    if (h > 0) return `${h} s`;
    return `${mm} m`;
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
    const [ccMap, setCcMap] = useState(() => new Map());
    const [q, setQ] = useState("");                 // memo search
    const [actFilter, setActFilter] = useState("all"); // activity type id or "all"
    const [ccFilter, setCcFilter] = useState("all");   // cost center code or "all"

    const [editOpen, setEditOpen] = useState(false);
    const [editRow, setEditRow] = useState(null);

    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");
    const [editBreakMin, setEditBreakMin] = useState(0);
    const [editActType, setEditActType] = useState("");
    const [editCC, setEditCC] = useState("");
    const [editMemo, setEditMemo] = useState("");
    const [saving, setSaving] = useState(false);
    const [editErr, setEditErr] = useState("");

    const [busy, setBusy] = useState({ on: false, text: "" });

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get("/hana/cost-centers");
                const list = r.data?.items || [];
                setCcMap(new Map(list.map((x) => [String(x.code), String(x.name)])));
            } catch (e) {
                console.error("cc load failed", e);
            }
        })();
    }, []);

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

    const actMap = useMemo(() => new Map(ACTIVITY_TYPES.map(a => [a.id, a.name])), []);

    const filteredItems = useMemo(() => {
        const query = q.trim().toLowerCase();

        return items.filter((r) => {
            // memo search
            if (query) {
                const memo = String(r.U_memo || "").toLowerCase();
                if (!memo.includes(query)) return false;
            }

            // activity type
            if (actFilter !== "all") {
                if (String(r.ActType ?? "") !== String(actFilter)) return false;
            }

            // cost center
            if (ccFilter !== "all") {
                if (String(r.CostCenter ?? "") !== String(ccFilter)) return false;
            }

            return true;
        });
    }, [items, q, actFilter, ccFilter]);

    const grouped = useMemo(() => {
        const map = new Map();
        for (const row of filteredItems) {
            const d = ymdFromSap(row.Date);
            if (!map.has(d)) map.set(d, []);
            map.get(d).push(row);
        }
        return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [filteredItems]);

    const totals = useMemo(() => {
        return filteredItems.reduce(
            (acc, r) => {
                const { gross, breakMins, net } = calcLineMins(r);
                acc.gross += gross;
                acc.breaks += breakMins;
                acc.net += net;
                return acc;
            },
            { gross: 0, breaks: 0, net: 0 }
        );
    }, [filteredItems]);

    function openEdit(r) {
        setEditErr("");
        setEditRow(r);

        setEditStart(sapIntToHHmm(r.StartTime));
        setEditEnd(sapIntToHHmm(r.EndTime));
        setEditBreakMin(breakToMinutes(r.Break));
        setEditActType(String(r.ActType ?? ""));
        setEditCC(String(r.CostCenter ?? ""));
        setEditMemo(String(r.U_memo ?? ""));

        setEditOpen(true);
    }

    async function saveEdit() {
        if (!editRow) return;
        setEditErr("");

        // tiny validations
        if (!/^\d{2}:\d{2}$/.test(editStart)) return setEditErr("Start time must be HH:mm");
        if (!/^\d{2}:\d{2}$/.test(editEnd)) return setEditErr("End time must be HH:mm");
        if (!editActType || isNaN(Number(editActType))) return setEditErr("Activity type is required");

        setSaving(true);
        setBusy({ on: true, text: "Saving..." });
        try {
            await api.patch(`/timesheet/line/${editRow.LineID}`, {
                month,
                startTime: editStart,
                endTime: editEnd,
                breakMin: Number(editBreakMin || 0),
                activityType: Number(editActType),
                costCenter: editCC || null,
                memo: editMemo || null,
                // you can also send other fields later if you want
            });

            setEditOpen(false);
            setEditRow(null);
            await load(); // refresh list from HANA
        } catch (e) {
            setEditErr(e?.response?.data?.error || e?.response?.data?.details || e.message || "Save failed");
        } finally {
            setSaving(false);
            setBusy({ on: false, text: "" });
        }
    }

    async function deleteLine(r) {
        const ok = window.confirm("Delete this entry?");
        if (!ok) return;
        setBusy({ on: true, text: "Deleting..." });

        try {
            await api.delete(`/timesheet/line/${r.LineID}`, { params: { month } });
            await load();
        } catch (e) {
            alert(e?.response?.data?.error || e?.response?.data?.details || e.message || "Delete failed");
        } finally {
            setBusy({ on: false, text: "" });
        }
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-4 pb-48">
            <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                    <div className="mb-1 text-sm font-semibold text-slate-600">Search memo</div>
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="e.g. server, license..."
                    />
                </div>

                <div>
                    <div className="mb-1 text-sm font-semibold text-slate-600">Activity type</div>
                    <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                        value={actFilter}
                        onChange={(e) => setActFilter(e.target.value)}
                    >
                        <option value="all">All</option>
                        {ACTIVITY_TYPES.map((t) => (
                            <option key={t.id} value={String(t.id)}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <div className="mb-1 text-sm font-semibold text-slate-600">Cost center</div>
                    <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                        value={ccFilter}
                        onChange={(e) => setCcFilter(e.target.value)}
                    >
                        <option value="all">All</option>
                        {/* cost centers loaded from backend earlier */}
                        {[...ccMap.entries()].map(([code, name]) => (
                            <option key={code} value={code}>
                                {name} ({code})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setQ("");
                            setActFilter("all");
                            setCcFilter("all");
                        }}
                    >
                        Clear filters
                    </Button>
                </div>
            </div>
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

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <div className="rounded-full bg-slate-900 text-white px-3 py-1 font-semibold">
                            ⏱ Total: {fmtDuration(totals.net)}
                        </div>
                        <div className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-semibold">
                            ☕ Breaks: {fmtBreak(totals.breaks)}
                        </div>
                        <div className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-semibold">
                            🧾 {filteredItems.length} / {items.length} entries
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
                                    (acc, r) => {
                                        const { gross, breakMins, net } = calcLineMins(r);
                                        acc.gross += gross;
                                        acc.breaks += breakMins;
                                        acc.net += net;
                                        return acc;
                                    },
                                    { gross: 0, breaks: 0, net: 0 }
                                );

                                return (
                                    <div key={date} className="rounded-2xl border border-slate-200 p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="font-extrabold">{date}</div>
                                            <div className="text-sm font-semibold text-slate-700">
                                                🕒{fmtDuration(dayMins.net)}
                                                <span className="ml-2 text-slate-500">☕ {fmtBreak(dayMins.breaks)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-2 grid gap-2">
                                            {rows.map((r) => {
                                                const { gross, breakMins, net } = calcLineMins(r);
                                                return (
                                                    <div
                                                        key={r.LineID}
                                                        className="rounded-xl bg-slate-50 p-3"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <div className="font-semibold">
                                                                🕒{hhmmFromSapInt(r.StartTime)}–{hhmmFromSapInt(r.EndTime)}
                                                            </div>
                                                            <div className="text-sm text-slate-600">
                                                                ⏱ {fmtDuration(net)}
                                                                {breakMins > 0 && (
                                                                    <span className="ml-2 text-slate-500">☕ {fmtBreak(breakMins)}</span>
                                                                )}
                                                            </div>

                                                            {r.CostCenter && (
                                                                <div className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700">
                                                                    {r.CostCenter && (
                                                                        <div className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700">
                                                                            🏷 {ccMap.get(String(r.CostCenter)) || r.CostCenter}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="ml-auto flex items-center gap-2">
                                                                <div className="text-xs text-slate-500">
                                                                    📌{actMap.get(Number(r.ActType)) || `ActType: ${r.ActType ?? "-"}`}
                                                                </div>

                                                                <button
                                                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                    onClick={() => openEdit(r)}
                                                                    title="Edit"
                                                                >
                                                                    ✏️ Edit
                                                                </button>

                                                                <button
                                                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                                                    onClick={() => deleteLine(r)}
                                                                    title="Delete"
                                                                >
                                                                    🗑 Delete
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {r.U_memo && (
                                                            <div className="mt-2 text-sm text-slate-800">
                                                                📝{r.U_memo}
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

            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="text-lg font-extrabold">Edit entry</div>
                            <button
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold"
                                onClick={() => setEditOpen(false)}
                            >
                                ✖
                            </button>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Start</div>
                                <Input value={editStart} onChange={(e) => setEditStart(e.target.value)} placeholder="HH:mm" />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">End</div>
                                <Input value={editEnd} onChange={(e) => setEditEnd(e.target.value)} placeholder="HH:mm" />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Break (minutes)</div>
                                <Input
                                    type="number"
                                    value={editBreakMin}
                                    onChange={(e) => setEditBreakMin(Number(e.target.value || 0))}
                                    min={0}
                                />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Activity type</div>
                                <select
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                                    value={editActType}
                                    onChange={(e) => setEditActType(e.target.value)}
                                >
                                    <option value="">Select…</option>
                                    {ACTIVITY_TYPES.map((t) => (
                                        <option key={t.id} value={String(t.id)}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <div className="mb-1 text-sm font-semibold text-slate-600">Cost center</div>
                                <select
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                                    value={editCC}
                                    onChange={(e) => setEditCC(e.target.value)}
                                >
                                    <option value="">— None —</option>
                                    {[...ccMap.entries()].map(([code, name]) => (
                                        <option key={code} value={code}>
                                            {name} ({code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <div className="mb-1 text-sm font-semibold text-slate-600">Memo</div>
                                <Input value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder="..." />
                            </div>
                        </div>

                        {editErr && (
                            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm font-semibold text-rose-700">
                                {editErr}
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={saveEdit} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {busy.on && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
                    <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                        <div className="text-sm font-semibold text-slate-800">
                            {busy.text || "Working..."}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
