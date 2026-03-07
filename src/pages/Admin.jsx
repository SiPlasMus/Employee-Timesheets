import React, { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { api } from "../api";
import { ACTIVITY_TYPES } from "../components/activityTypes";
import { cn } from "../ui/ui";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useToast } from "../components/Toast";

const SELECT_CLS =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600";

const ACT_MAP = new Map(ACTIVITY_TYPES.map((a) => [String(a.id), a.name]));

// ---- helpers ----
function fmtDate(d) {
    if (!d) return "—";
    return String(d).slice(0, 10);
}

function fmtHours(h) {
    if (h == null || isNaN(h)) return "0.0";
    return Number(h).toFixed(1);
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
        const ss = String(Number(s)).padStart(4, "0");
        const hh = Number(ss.slice(0, 2));
        const mm = Number(ss.slice(2, 4));
        if (hh <= 23 && mm <= 59) return hh * 60 + mm;
        return Number(s);
    }
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return Math.max(0, parts[0] * 60 + parts[1]);
    if (parts.length === 2) return Math.max(0, parts[0]);
    return 0;
}

function netHoursFromLine(line) {
    if (Number(line.EffectHr) > 0) return Number(line.EffectHr);
    if (line.FullDay === "Y") return 8;
    const gross = sapIntToMinutes(line.EndTime) - sapIntToMinutes(line.StartTime);
    const br = breakToMinutes(line.Break);
    return Math.max(0, gross - br) / 60;
}

function hhmmFromSapInt(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "--:--";
    const s = String(Math.max(0, n)).padStart(4, "0");
    return `${s.slice(0, 2)}:${s.slice(2)}`;
}

// ============================================================
// Users Tab
// ============================================================
function UsersTab() {
    const toast = useToast();
    const [filters, setFilters] = useState({ search: "", isActive: "", page: 1 });
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);

    const setSearch   = (v) => setFilters((f) => ({ ...f, search: v, page: 1 }));
    const setIsActive = (v) => setFilters((f) => ({ ...f, isActive: v, page: 1 }));
    const setPage     = (v) => setFilters((f) => ({ ...f, page: v }));

    useEffect(() => {
        let cancelled = false;
        const delay = filters.search ? 350 : 0;
        const t = setTimeout(async () => {
            setLoading(true);
            setErr("");
            try {
                const params = { page: filters.page, limit: 20 };
                if (filters.search.trim()) params.search = filters.search.trim();
                if (filters.isActive) params.isActive = filters.isActive;
                const r = await api.get("/users", { params });
                if (!cancelled) setData(r.data);
            } catch (e) {
                if (!cancelled) toast.error(e?.response?.data?.error || e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, delay);
        return () => { cancelled = true; clearTimeout(t); };
    }, [filters]);

    const items      = data?.items || [];
    const totalPages = data?.pages || 1;
    const total      = data?.total || 0;

    const TH = ({ children, cls = "" }) => (
        <th className={cn(
            "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
            cls,
        )}>
            {children}
        </th>
    );

    return (
        <div className="grid gap-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <Input
                    placeholder="Search name or ID…"
                    value={filters.search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-48"
                />
                <select
                    value={filters.isActive}
                    onChange={(e) => setIsActive(e.target.value)}
                    className={cn(SELECT_CLS, "w-40")}
                >
                    <option value="">All Status</option>
                    <option value="Y">Active</option>
                    <option value="N">Inactive</option>
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                            <TH>ID</TH>
                            <TH>Name / Email</TH>
                            <TH cls="hidden sm:table-cell">Department</TH>
                            <TH cls="hidden md:table-cell">Job Title</TH>
                            <TH>Status</TH>
                            <TH cls="hidden lg:table-cell">Last Login</TH>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading && !items.length ? (
                            <tr>
                                <td colSpan={6} className="py-14 text-center text-sm text-slate-400">
                                    Loading…
                                </td>
                            </tr>
                        ) : !items.length ? (
                            <tr>
                                <td colSpan={6} className="py-14 text-center text-sm text-slate-400">
                                    No users found
                                </td>
                            </tr>
                        ) : items.map((u) => (
                            <tr
                                key={u.EmpID}
                                className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            >
                                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {u.EmpID}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                                        {[u.FirstName, u.LastName].filter(Boolean).join(" ") || "—"}
                                    </div>
                                    {u.Email && (
                                        <div className="max-w-[180px] truncate text-xs text-slate-400 dark:text-slate-500">
                                            {u.Email}
                                        </div>
                                    )}
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-slate-600 dark:text-slate-300 sm:table-cell">
                                    {u.Department || u.DeptCode || "—"}
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-slate-600 dark:text-slate-300 md:table-cell">
                                    {u.JobTitle || "—"}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold",
                                        u.IsActive === "Y"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                            : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                                    )}>
                                        {u.IsActive === "Y" ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="hidden px-4 py-3 text-xs text-slate-400 dark:text-slate-500 lg:table-cell">
                                    {fmtDate(u.LastLoginAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > 0 && (
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{total} users · Page {filters.page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <Button variant="secondary" disabled={filters.page <= 1 || loading}
                            onClick={() => setPage(filters.page - 1)}>Prev</Button>
                        <Button variant="secondary" disabled={filters.page >= totalPages || loading}
                            onClick={() => setPage(filters.page + 1)}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Hours Tab
// ============================================================
function HoursTab() {
    const toast = useToast();
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const [actFilter, setActFilter] = useState("");
    const [ccFilter,  setCcFilter]  = useState("");

    const [costCenters, setCostCenters] = useState([]);

    const [rawUsers,   setRawUsers]   = useState([]);
    const [rawLinesMap, setRawLinesMap] = useState(null);

    const [loading,  setLoading]  = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const abortRef = useRef(false);

    // Load cost centers once
    useEffect(() => {
        api.get("/hana/cost-centers")
            .then((r) => setCostCenters(r.data?.items || []))
            .catch(() => {});
    }, []);

    // Auto-load on first mount
    const hasAutoLoaded = useRef(false);
    useEffect(() => {
        if (!hasAutoLoaded.current) {
            hasAutoLoaded.current = true;
            loadData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadData() {
        setLoading(true);
        setRawLinesMap(null);
        setRawUsers([]);
        abortRef.current = false;

        try {
            const ur = await api.get("/users", { params: { limit: 200, isActive: "Y" } });
            const users = ur.data?.items || [];
            setProgress({ done: 0, total: users.length });

            const CONCURRENCY = 8;
            const linesMap = new Map();

            for (let i = 0; i < users.length; i += CONCURRENCY) {
                if (abortRef.current) break;
                const batch = users.slice(i, i + CONCURRENCY);

                const batchResults = await Promise.all(
                    batch.map((u) =>
                        api.get(`/hana/timesheets/lines/${u.EmpID}`, { params: { month } })
                            .then((r) => ({ empId: u.EmpID, lines: r.data?.items || [] }))
                            .catch(() => ({ empId: u.EmpID, lines: [] }))
                    )
                );

                for (const { empId, lines } of batchResults) {
                    linesMap.set(empId, lines);
                }
                setProgress({ done: Math.min(i + CONCURRENCY, users.length), total: users.length });
            }

            setRawUsers(users);
            setRawLinesMap(linesMap);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }

    // Derived: apply filters reactively (no refetch)
    const results = useMemo(() => {
        if (!rawLinesMap) return null;

        return rawUsers.map((u) => {
            let lines = rawLinesMap.get(u.EmpID) || [];

            if (actFilter) {
                lines = lines.filter((l) => String(l.ActType) === actFilter);
            }
            if (ccFilter) {
                lines = lines.filter((l) => l.CostCenter === ccFilter);
            }

            // Per-activity breakdown
            const actHours = {};
            for (const l of lines) {
                const key = String(l.ActType ?? "");
                actHours[key] = (actHours[key] || 0) + netHoursFromLine(l);
            }

            const totalHrs   = Object.values(actHours).reduce((s, h) => s + h, 0);
            const dates      = [...new Set(lines.map((l) => String(l.Date || "").slice(0, 10)).filter(Boolean))];
            const workDays   = dates.length;
            const ccs        = [...new Set(lines.map((l) => l.CostCenter).filter(Boolean))];

            return {
                empId:    u.EmpID,
                name:     [u.FirstName, u.LastName].filter(Boolean).join(" ") || String(u.EmpID),
                dept:     u.Department || u.DeptCode || "",
                jobTitle: u.JobTitle || "",
                hours:    totalHrs,
                workDays,
                lineCount: lines.length,
                actHours,  // { "1": 8.5, "2": 4.0, ... }
                ccs,
                rawLines: lines, // for Excel detail sheet
            };
        }).filter((r) => r.hours > 0).sort((a, b) => b.hours - a.hours);
    }, [rawLinesMap, rawUsers, actFilter, ccFilter]);

    // ---- Excel export ----
    async function exportExcel() {
        if (!results) return;

        const wb = new ExcelJS.Workbook();
        wb.creator = "Employee Timesheets";
        wb.created = new Date();

        // Colors
        const INDIGO     = "FF4F46E5";
        const INDIGO_950 = "FF1E1B4B";
        const INDIGO_50  = "FFEEF2FF";
        const INDIGO_100 = "FFE0E7FF";
        const WHITE      = "FFFFFFFF";
        const GRAY_50    = "FFF8FAFC";
        const GRAY_200   = "FFE2E8F0";
        const GRAY_600   = "FF475569";

        const borderThin = (color = INDIGO_100) => ({
            top:    { style: "thin",   color: { argb: color } },
            bottom: { style: "thin",   color: { argb: color } },
            left:   { style: "thin",   color: { argb: color } },
            right:  { style: "thin",   color: { argb: color } },
        });

        // ── Sheet 1: Summary ──────────────────────────────────────
        const ws = wb.addWorksheet("Hours Summary", {
            views: [{ state: "frozen", ySplit: 4 }],
        });

        const colCount = 6 + ACTIVITY_TYPES.length;

        // Row 1 – title
        ws.mergeCells(1, 1, 1, colCount);
        const r1 = ws.getRow(1);
        const t1 = r1.getCell(1);
        t1.value     = `Hours Summary — ${month}`;
        t1.font      = { bold: true, size: 14, color: { argb: WHITE } };
        t1.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
        t1.alignment = { horizontal: "center", vertical: "middle" };
        r1.height    = 32;

        // Row 2 – filter info
        ws.mergeCells(2, 1, 2, colCount);
        const r2 = ws.getRow(2);
        const t2 = r2.getCell(1);
        const actName = actFilter ? (ACTIVITY_TYPES.find((a) => String(a.id) === actFilter)?.name || actFilter) : "All";
        const ccName  = ccFilter  ? (costCenters.find((c) => c.code === ccFilter)?.name || ccFilter) : "All";
        t2.value     = `Activity: ${actName}   |   Cost Center: ${ccName}   |   ${results.length} employees`;
        t2.font      = { size: 10, italic: true, color: { argb: INDIGO } };
        t2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_50 } };
        t2.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        r2.height    = 20;

        // Row 3 – spacer
        ws.getRow(3).height = 8;

        // Row 4 – headers
        const headerLabels = [
            "#", "EmpID", "Name", "Department",
            "Total Hours", "Working Days",
            ...ACTIVITY_TYPES.map((a) => a.name),
        ];
        ws.columns = [
            { width: 6 }, { width: 10 }, { width: 28 }, { width: 22 },
            { width: 14 }, { width: 14 },
            ...ACTIVITY_TYPES.map(() => ({ width: 20 })),
        ];

        const r4 = ws.getRow(4);
        headerLabels.forEach((h, i) => {
            const cell = r4.getCell(i + 1);
            cell.value     = h;
            cell.font      = { bold: true, size: 10, color: { argb: WHITE } };
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_950 } };
            cell.alignment = { horizontal: i >= 4 ? "right" : "center", vertical: "middle" };
            cell.border    = borderThin(INDIGO);
        });
        r4.height = 24;

        // Data rows
        results.forEach((r, idx) => {
            const rowNum = idx + 5;
            const row    = ws.getRow(rowNum);
            const bg     = idx % 2 === 0 ? WHITE : INDIGO_50;

            const values = [
                idx + 1,
                r.empId,
                r.name,
                r.dept || "—",
                r.hours,
                r.workDays,
                ...ACTIVITY_TYPES.map((a) => r.actHours[String(a.id)] || 0),
            ];

            values.forEach((v, i) => {
                const cell = row.getCell(i + 1);
                cell.value  = v;
                cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
                cell.border = borderThin(GRAY_200);

                if (i === 0) {
                    cell.font      = { color: { argb: GRAY_600 } };
                    cell.alignment = { horizontal: "center" };
                } else if (i === 4) {
                    // Total Hours
                    cell.numFmt = "0.00";
                    cell.font   = { bold: true, color: { argb: INDIGO } };
                    cell.alignment = { horizontal: "right" };
                } else if (i === 5) {
                    cell.alignment = { horizontal: "right" };
                } else if (i >= 6) {
                    // Activity hours
                    cell.numFmt    = v > 0 ? "0.0" : "—";
                    cell.alignment = { horizontal: "right" };
                    if (v === 0) cell.value = "";
                }
            });

            row.height = 20;
        });

        // Total row
        if (results.length > 0) {
            const totRowNum = results.length + 5;
            const totRow    = ws.getRow(totRowNum);
            ws.mergeCells(totRowNum, 1, totRowNum, 4);
            const tc = totRow.getCell(1);
            tc.value     = `Total — ${results.length} employees`;
            tc.font      = { bold: true, size: 10, color: { argb: INDIGO } };
            tc.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_100 } };
            tc.alignment = { horizontal: "left", indent: 1, vertical: "middle" };

            const totalHrsCell = totRow.getCell(5);
            totalHrsCell.value  = results.reduce((s, r) => s + r.hours, 0);
            totalHrsCell.numFmt = "0.00";
            totalHrsCell.font   = { bold: true, size: 12, color: { argb: INDIGO } };
            totalHrsCell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_100 } };
            totalHrsCell.alignment = { horizontal: "right" };

            ACTIVITY_TYPES.forEach((a, i) => {
                const c = totRow.getCell(7 + i);
                c.value  = results.reduce((s, r) => s + (r.actHours[String(a.id)] || 0), 0);
                c.numFmt = "0.0";
                c.font   = { bold: true, color: { argb: INDIGO } };
                c.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_100 } };
                c.alignment = { horizontal: "right" };
            });

            for (let i = 1; i <= colCount; i++) {
                const c = totRow.getCell(i);
                c.border = {
                    top:    { style: "medium", color: { argb: INDIGO } },
                    bottom: { style: "thin",   color: { argb: INDIGO } },
                    left:   { style: "thin",   color: { argb: INDIGO_100 } },
                    right:  { style: "thin",   color: { argb: INDIGO_100 } },
                };
                if (!c.fill?.fgColor) {
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_100 } };
                }
            }
            totRow.height = 26;
        }

        // ── Sheet 2: Daily Details ────────────────────────────────
        const ds = wb.addWorksheet("Daily Details", {
            views: [{ state: "frozen", ySplit: 1 }],
        });
        ds.columns = [
            { header: "EmpID",      key: "empId",    width: 10 },
            { header: "Name",       key: "name",     width: 28 },
            { header: "Department", key: "dept",     width: 22 },
            { header: "Date",       key: "date",     width: 14 },
            { header: "Start",      key: "start",    width: 10 },
            { header: "End",        key: "end",      width: 10 },
            { header: "Break min",  key: "breakMin", width: 12 },
            { header: "Net Hours",  key: "netHrs",   width: 12 },
            { header: "Activity",   key: "activity", width: 26 },
            { header: "Cost Center",key: "cc",       width: 22 },
            { header: "Memo",       key: "memo",     width: 40 },
        ];

        // Style detail header row
        const dh = ds.getRow(1);
        dh.eachCell((cell) => {
            cell.font      = { bold: true, size: 10, color: { argb: WHITE } };
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border    = borderThin(INDIGO_950);
        });
        dh.height = 22;

        let detailRowIdx = 2;
        for (const r of results) {
            for (const l of r.rawLines) {
                const row = ds.getRow(detailRowIdx);
                const bg  = detailRowIdx % 2 === 0 ? WHITE : GRAY_50;
                const netH = netHoursFromLine(l);

                row.getCell(1).value  = r.empId;
                row.getCell(2).value  = r.name;
                row.getCell(3).value  = r.dept || "—";
                row.getCell(4).value  = String(l.Date || "").slice(0, 10);
                row.getCell(5).value  = hhmmFromSapInt(l.StartTime);
                row.getCell(6).value  = hhmmFromSapInt(l.EndTime);
                row.getCell(7).value  = breakToMinutes(l.Break);
                row.getCell(8).value  = netH;
                row.getCell(9).value  = ACT_MAP.get(String(l.ActType ?? "")) || String(l.ActType ?? "—");
                row.getCell(10).value = l.CostCenter || "—";
                row.getCell(11).value = l.U_memo || "";

                row.eachCell((cell, colNum) => {
                    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
                    cell.border = borderThin(GRAY_200);
                    if (colNum === 8) {
                        cell.numFmt    = "0.0";
                        cell.font      = { color: { argb: INDIGO } };
                        cell.alignment = { horizontal: "right" };
                    }
                });

                row.height = 18;
                detailRowIdx++;
            }
        }

        // Write
        const buffer = await wb.xlsx.writeBuffer();
        const blob   = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = `hours-${month}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const pct       = progress.total ? (progress.done / progress.total) * 100 : 0;
    const maxHours  = results?.length ? Math.max(...results.map((r) => r.hours), 1) : 1;

    return (
        <div className="grid gap-5">
            {/* Filters + actions */}
            <div className="flex flex-wrap gap-2">
                <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className={cn(SELECT_CLS, "w-40")}
                />
                <select
                    value={actFilter}
                    onChange={(e) => setActFilter(e.target.value)}
                    className={cn(SELECT_CLS, "flex-1 min-w-40")}
                >
                    <option value="">All Activities</option>
                    {ACTIVITY_TYPES.map((t) => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                </select>
                <select
                    value={ccFilter}
                    onChange={(e) => setCcFilter(e.target.value)}
                    className={cn(SELECT_CLS, "flex-1 min-w-40")}
                >
                    <option value="">All Cost Centers</option>
                    {costCenters.map((cc) => (
                        <option key={cc.code} value={cc.code}>{cc.name || cc.code}</option>
                    ))}
                </select>
                <Button onClick={loadData} disabled={loading}>
                    {loading ? `${progress.done}/${progress.total}…` : "Reload"}
                </Button>
                {results && results.length > 0 && (
                    <Button variant="secondary" onClick={exportExcel}>Export Excel</Button>
                )}
            </div>

            {/* Progress bar */}
            {loading && progress.total > 0 && (
                <div>
                    <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>Fetching timesheets…</span>
                        <span>{progress.done} / {progress.total} users</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                            className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Summary stats */}
            {results && results.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    {[
                        {
                            label: "Total Hours",
                            value: fmtHours(results.reduce((s, r) => s + r.hours, 0)),
                            sub: "across all employees",
                            color: "text-indigo-600 dark:text-indigo-400",
                        },
                        {
                            label: "Employees",
                            value: results.length,
                            sub: "with hours logged",
                            color: "text-sky-600 dark:text-sky-400",
                        },
                        {
                            label: "Avg Hours",
                            value: fmtHours(results.reduce((s, r) => s + r.hours, 0) / results.length),
                            sub: "per employee",
                            color: "text-emerald-600 dark:text-emerald-400",
                        },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className="flex-1 min-w-32 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                        >
                            <div className={cn("text-2xl font-extrabold tabular-nums", kpi.color)}>
                                {kpi.value}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {kpi.label}
                            </div>
                            <div className="text-xs text-slate-400">{kpi.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Employee cards */}
            {results && results.length > 0 && (
                <div className="grid gap-3">
                    {results.map((r) => {
                        const topActs = Object.entries(r.actHours)
                            .filter(([, h]) => h > 0)
                            .sort((a, b) => b[1] - a[1]);

                        return (
                            <div
                                key={r.empId}
                                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                            >
                                {/* Header row */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                            {r.name}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-400 dark:text-slate-500">
                                            {r.dept && <span>{r.dept}</span>}
                                            {r.jobTitle && <span>{r.jobTitle}</span>}
                                            <span>ID {r.empId}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-2xl font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400">
                                            {fmtHours(r.hours)}
                                        </div>
                                        <div className="text-xs text-slate-400">hours total</div>
                                    </div>
                                </div>

                                {/* Bar */}
                                <div className="my-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                        className="h-1.5 rounded-full bg-indigo-500"
                                        style={{ width: `${(r.hours / maxHours) * 100}%` }}
                                    />
                                </div>

                                {/* Stats row */}
                                <div className="flex flex-wrap gap-3 text-xs">
                                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{r.workDays}</span>
                                        <span className="text-slate-400">working days</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{r.lineCount}</span>
                                        <span className="text-slate-400">entries</span>
                                    </div>
                                    {r.workDays > 0 && (
                                        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                {fmtHours(r.hours / r.workDays)}
                                            </span>
                                            <span className="text-slate-400">avg/day</span>
                                        </div>
                                    )}
                                    {r.ccs.length > 0 && (
                                        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800">
                                            <span className="text-slate-400">{r.ccs.join(", ")}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Activity breakdown */}
                                {topActs.length > 0 && (
                                    <div className="mt-3 grid gap-1.5">
                                        {topActs.slice(0, 5).map(([actId, h]) => {
                                            const pct = (h / r.hours) * 100;
                                            return (
                                                <div key={actId} className="flex items-center gap-2">
                                                    <div className="w-32 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {ACT_MAP.get(actId) || actId}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" style={{ height: 5 }}>
                                                        <div
                                                            className="h-full rounded-full bg-indigo-400 dark:bg-indigo-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <div className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                                                        {fmtHours(h)}h
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty states */}
            {results && results.length === 0 && (
                <div className="py-14 text-center text-slate-400">
                    No hours logged for the selected filters.
                </div>
            )}
            {!loading && rawLinesMap === null && (
                <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400 dark:border-slate-700">
                    Loading data…
                </div>
            )}
        </div>
    );
}

// ============================================================
// Admin Page
// ============================================================
export default function Admin() {
    const [tab, setTab] = useState(0);

    return (
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-32">
            <h1 className="mb-5 text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Admin Panel
            </h1>

            {/* Tab switcher */}
            <div className="mb-7 flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                {["Users", "Hours Summary"].map((t, i) => (
                    <button
                        key={t}
                        onClick={() => setTab(i)}
                        className={cn(
                            "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
                            tab === i
                                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
                        )}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 0 ? <UsersTab /> : <HoursTab />}
        </div>
    );
}
