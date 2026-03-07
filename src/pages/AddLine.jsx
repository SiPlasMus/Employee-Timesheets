import React, {useEffect, useMemo, useState} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { ACTIVITY_TYPES } from "../components/activityTypes";
import { cn } from "../ui/ui";
import { useToast } from "../components/Toast";

function yyyymm(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}
function ymd(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}
function minutesBetween(hhmm1, hhmm2) {
    const toMin = (s) => {
        const [h, m] = String(s || "00:00").split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    };
    return Math.max(0, toMin(hhmm2) - toMin(hhmm1));
}
function fmtHours(mins) {
    const h = mins / 60;
    return h.toFixed(h % 1 === 0 ? 0 : 2);
}

function hhmmToMinutes(s) {
    const [h, m] = String(s || "00:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

// SAP time ints like 800, 1530 -> minutes
function sapIntToMinutes(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    const s = String(Math.max(0, n)).padStart(4, "0");
    const hh = Number(s.slice(0, 2));
    const mm = Number(s.slice(2, 4));
    return hh * 60 + mm;
}

function minutesToHHMM(min) {
    const m = Math.max(0, Number(min) || 0);
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(Math.floor(m % 60)).padStart(2, "0");
    return `${hh}:${mm}`;
}

// overlap if start < otherEnd && end > otherStart
function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}

const HOURS = 24;
const PX_PER_HOUR = 22;
const TIMELINE_H = HOURS * PX_PER_HOUR; // 528px

function minToY(minutes) {
    return (minutes / (HOURS * 60)) * TIMELINE_H;
}

function DayTimeline({ entries, previewStart, previewEnd, date, loading }) {
    const previewStartMin = hhmmToMinutes(previewStart);
    const previewEndMin   = hhmmToMinutes(previewEnd);
    const previewTop      = minToY(previewStartMin);
    const previewHeight   = Math.max(0, minToY(previewEndMin) - previewTop);
    const hasPreview      = previewHeight > 2 && previewEndMin > previewStartMin;

    return (
        <div className="rounded-2xl border border-white/30 bg-white/40 backdrop-blur-xl shadow-lg
                        dark:border-slate-700/40 dark:bg-slate-800/40 p-4 lg:sticky lg:top-20 self-start">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{date}</div>
                {loading && (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                )}
            </div>

            {/* Timeline */}
            <div className="relative ml-7" style={{ height: TIMELINE_H }}>
                {/* Hour lines + labels */}
                {Array.from({ length: HOURS + 1 }, (_, h) => (
                    <div key={h} className="absolute left-0 right-0" style={{ top: h * PX_PER_HOUR }}>
                        <div className={cn(
                            "absolute left-0 right-0 border-t",
                            h % 6 === 0
                                ? "border-slate-300/80 dark:border-slate-600/70"
                                : "border-slate-100 dark:border-slate-800/70"
                        )} />
                        {h % 3 === 0 && (
                            <span
                                className="absolute text-[10px] font-medium text-slate-400 dark:text-slate-500"
                                style={{ left: -28, top: -7, width: 24, textAlign: "right" }}
                            >
                                {String(h).padStart(2, "0")}
                            </span>
                        )}
                    </div>
                ))}

                {/* Existing entries — red */}
                {entries.map((entry, i) => {
                    const startM = sapIntToMinutes(entry.StartTime);
                    const endM   = sapIntToMinutes(entry.EndTime);
                    const top    = minToY(startM);
                    const height = Math.max(6, minToY(endM) - top);
                    return (
                        <div
                            key={i}
                            className="absolute inset-x-0 rounded-md bg-rose-400/80 border border-rose-500/50
                                       backdrop-blur-sm overflow-hidden px-1.5"
                            style={{ top, height }}
                        >
                            {height >= 14 && (
                                <span className="text-[9px] font-bold text-white leading-tight whitespace-nowrap">
                                    {minutesToHHMM(startM)}–{minutesToHHMM(endM)}
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* New entry preview — indigo */}
                {hasPreview && (
                    <div
                        className="absolute inset-x-0 rounded-md bg-indigo-400/65 border border-indigo-500/60
                                   backdrop-blur-sm overflow-hidden px-1.5 ring-1 ring-inset ring-indigo-300/40"
                        style={{ top: previewTop, height: previewHeight }}
                    >
                        {previewHeight >= 14 && (
                            <span className="text-[9px] font-bold text-white leading-tight whitespace-nowrap">
                                {previewStart}–{previewEnd}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-3 flex gap-4 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-rose-400/80" />
                    Busy
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-indigo-400/65" />
                    New entry
                </div>
            </div>
        </div>
    );
}


export default function AddLine() {
    const nav = useNavigate();
    const toast = useToast();
    const [month, setMonth] = useState(yyyymm());
    const [date, setDate] = useState(ymd());
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("18:00");
    const [breakMin, setBreakMin] = useState(60);
    const [activityType, setActivityType] = useState(1);
    const [costCenter, setCostCenter] = useState("");
    const [memo, setMemo] = useState("");

    const [dayEntries, setDayEntries] = useState([]);
    const [loadingEntries, setLoadingEntries] = useState(false);

    const [costCenters, setCostCenters] = useState([]);
    const [loadingCC, setLoadingCC] = useState(false);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            setLoadingCC(true);
            try {
                const r = await api.get("/hana/cost-centers");
                setCostCenters(r.data?.items || []);
            } catch (e) {
                console.error("cost centers load err", e);
            } finally {
                setLoadingCC(false);
            }
        })();
    }, []);

    // Fetch entries for the selected date to show on the timeline
    useEffect(() => {
        const empId = Number(localStorage.getItem("et_empId") || 0);
        if (!empId) return;
        let cancelled = false;
        setLoadingEntries(true);
        const m = date.slice(0, 7);
        api.get(`/hana/timesheets/lines/${empId}`, { params: { month: m } })
            .then(r => {
                if (cancelled) return;
                const all = r.data?.items || [];
                setDayEntries(all.filter(x => String(x.Date || "").slice(0, 10) === date));
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoadingEntries(false); });
        return () => { cancelled = true; };
    }, [date]);

    const workMins = useMemo(() => {
        const raw = minutesBetween(startTime, endTime);
        return Math.max(0, raw - Number(breakMin || 0));
    }, [startTime, endTime, breakMin]);

    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            const empId = Number(localStorage.getItem("et_empId") || 0);
            if (!empId) throw new Error("empId missing, please login again");

            const rLines = await api.get(`/hana/timesheets/lines/${empId}`, { params: { month } });
            const all = rLines.data?.items || [];
            const day = all.filter(x => String(x.Date || "").slice(0, 10) === date);

            const reqStart = hhmmToMinutes(startTime);
            const reqEnd = hhmmToMinutes(endTime);
            if (reqEnd <= reqStart) throw new Error("End time must be after start time");

            const conflict = day.find(x => {
                const exStart = sapIntToMinutes(x.StartTime);
                const exEnd = sapIntToMinutes(x.EndTime);
                return overlaps(reqStart, reqEnd, exStart, exEnd);
            });

            if (conflict) {
                const a = minutesToHHMM(sapIntToMinutes(conflict.StartTime));
                const b = minutesToHHMM(sapIntToMinutes(conflict.EndTime));
                const memoText = conflict.U_memo ? ` — ${conflict.U_memo}` : "";
                throw new Error(`Can't add: overlaps with existing entry ${a}–${b}${memoText}`);
            }

            const r = await api.post("/timesheet/line", {
                month, date, startTime, endTime,
                breakMin: Number(breakMin || 0),
                activityType: Number(activityType),
                costCenter: costCenter || null,
                memo: memo || null,
            });

            if (r.data?.ok) {
                toast.success("Entry saved");
                nav(`/timesheet?month=${encodeURIComponent(month)}`, { replace: true });
            } else {
                throw new Error("Unexpected response from server");
            }
        } catch (e) {
            toast.error(
                e?.response?.data?.error ||
                e?.response?.data?.details?.error?.message?.value ||
                e?.message || "Save failed"
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-4 pb-48">
            <div className="grid gap-4 lg:grid-cols-[1fr_240px] items-start">
                {/* ── Form ── */}
                <div>
                    <Card>
                        <CardHeader>
                            <div className="text-xl font-extrabold dark:text-slate-100">Add Timesheet Entry</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Work time: <span className="font-semibold text-slate-700">{fmtHours(workMins)}h</span>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <form onSubmit={submit} className="grid gap-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Month</div>
                                        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Date</div>
                                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Start</div>
                                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">End</div>
                                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Break (minutes)</div>
                                        <Input
                                            inputMode="numeric"
                                            value={breakMin}
                                            onChange={(e) => setBreakMin(e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Activity Type</div>
                                        <select
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                                            value={activityType}
                                            onChange={(e) => setActivityType(Number(e.target.value))}
                                        >
                                            {ACTIVITY_TYPES.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Cost Center</div>
                                        <select
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                                            value={costCenter}
                                            onChange={(e) => setCostCenter(e.target.value)}
                                            disabled={loadingCC}
                                        >
                                            <option value="">— Not selected —</option>
                                            {costCenters.map((cc) => (
                                                <option key={cc.code} value={cc.code}>
                                                    {cc.name} ({cc.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Memo (optional)</div>
                                        <textarea
                                            className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                                            value={memo}
                                            onChange={(e) => setMemo(e.target.value)}
                                            placeholder="What did you do?"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={saving}>
                                        {saving ? "Saving..." : "Save"}
                                    </Button>
                                    <Button type="button" variant="secondary" onClick={() => nav("/timesheet")}>
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                </div>

                {/* ── Day Timeline ── */}
                <DayTimeline
                    entries={dayEntries}
                    previewStart={startTime}
                    previewEnd={endTime}
                    date={date}
                    loading={loadingEntries}
                />
            </div>
        </div>
    );
}
