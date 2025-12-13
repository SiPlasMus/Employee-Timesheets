import React, {useEffect, useMemo, useState} from "react";
import { useNavigate } from "react-router-dom";
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


export default function AddLine() {
    const nav = useNavigate();
    const [month, setMonth] = useState(yyyymm());
    const [date, setDate] = useState(ymd());
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("18:00");
    const [breakMin, setBreakMin] = useState(60);
    const [activityType, setActivityType] = useState(1);
    const [costCenter, setCostCenter] = useState("");
    const [memo, setMemo] = useState("");

    const [okMsg, setOkMsg] = useState("");

    const [costCenters, setCostCenters] = useState([]);
    const [loadingCC, setLoadingCC] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

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

    const workMins = useMemo(() => {
        const raw = minutesBetween(startTime, endTime);
        return Math.max(0, raw - Number(breakMin || 0));
    }, [startTime, endTime, breakMin]);

    async function submit(e) {
        e.preventDefault();
        setError("");
        setOkMsg("");
        setSaving(true);

        try {
            const empId = Number(localStorage.getItem("et_empId") || 0);
            if (!empId) throw new Error("empId missing, please login again");

            // load month lines
            const rLines = await api.get(`/hana/timesheets/lines/${empId}`, { params: { month } });
            const all = rLines.data?.items || [];

            // only selected date
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
                throw new Error(`Can't add: overlaps with existing task ${a}–${b}${memoText}`);
            }

            const payload = {
                month,
                date,
                startTime,
                endTime,
                breakMin: Number(breakMin || 0),
                activityType: Number(activityType),
                costCenter: costCenter || null,
                memo: memo || null,
            };

            const r = await api.post("/timesheet/line", payload);

            if (r.data?.ok) {
                setOkMsg("Saved ✅");
                nav(`/timesheet?month=${encodeURIComponent(month)}`, { replace: true });
            } else {
                throw new Error("Unexpected response from server");
            }
        } catch (e) {
            const msg =
                e?.response?.data?.error ||
                e?.response?.data?.details?.error?.message?.value ||
                e?.message ||
                "Save failed";
            setError(msg);
            setTimeout(() => setError(""), 3500);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-4 pb-48">
            <Card>
                <CardHeader>
                    <div className="text-xl font-extrabold">Add Timesheet Entry</div>
                    <div className="text-sm text-slate-500">
                        Work time: <span className="font-semibold text-slate-700">{fmtHours(workMins)}h</span>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={submit} className="grid gap-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Month</div>
                                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Date</div>
                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Start</div>
                                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">End</div>
                                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Break (minutes)</div>
                                <Input
                                    inputMode="numeric"
                                    value={breakMin}
                                    onChange={(e) => setBreakMin(e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <div className="mb-1 text-sm font-semibold text-slate-600">Activity Type</div>
                                <select
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
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
                                <div className="mb-1 text-sm font-semibold text-slate-600">Cost Center</div>
                                <select
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
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
                                <div className="mb-1 text-sm font-semibold text-slate-600">Memo (optional)</div>
                                <textarea
                                    className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="What did you do?"
                                />
                            </div>
                        </div>

                        {okMsg && <div className="text-sm font-semibold text-emerald-700">{okMsg}</div>}

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
            {error && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                    {error}
                </div>
            )}
            {okMsg && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                    {okMsg}
                </div>
            )}

        </div>
    );
}
