import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import { isAdmin, getEmpId } from "../auth";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { cn } from "../ui/ui";
import { useToast } from "../components/Toast";
import ChatPanel from "../components/ChatPanel";

const STATUS_CONFIG = {
    pending:  { label: "Pending",  cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
    start:    { label: "Started",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    doing:    { label: "Doing",    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    finished: { label: "Finished", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    failed:   { label: "Failed",   cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
    rejected: { label: "Rejected", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

const CARD_CONFIG = {
    pending:  "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
    start:    "border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/30",
    doing:    "border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30",
    finished: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30",
    failed:   "border-rose-200 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/30",
    rejected: "border-orange-200 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/30",
};

function adminCardStatus(task) {
    const total = Number(task.TOTAL_ASSIGNED || 0);
    const finished = Number(task.FINISHED_COUNT || 0);
    if (total === 0) return "pending";
    if (finished === total) return "finished";
    if (finished > 0) return "doing";
    return "pending";
}

function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const STATUSES = Object.keys(STATUS_CONFIG);

function StatusBadge({ status }) {
    const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
            {s.label}
        </span>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return String(d).slice(0, 10);
}

function minsToHours(m) {
    const n = Number(m || 0);
    if (!n) return "0";
    const h = n / 60;
    return h % 1 === 0 ? String(h) : h.toFixed(1);
}

function lockScroll() {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
}

// ---- User: task detail + update modal ----
function UserTaskModal({ task, onClose, onSave, ccMap }) {
    const toast = useToast();
    const [status, setStatus] = useState(task.STATUS || "pending");
    const [hours, setHours] = useState(minsToHours(task.TIME_SPENT_MINUTES));
    const [saving, setSaving] = useState(false);

    useEffect(lockScroll, []);

    async function save() {
        setSaving(true);
        try {
            const mins = Math.round(parseFloat(hours || 0) * 60);
            await api.patch(`/task-assignments/${task.ASSIGNMENT_ID}`, { status, timeSpentMinutes: mins });
            onSave({ ...task, STATUS: status, TIME_SPENT_MINUTES: mins });
            toast.success("Task updated");
        } catch (e) {
            toast.error(e?.response?.data?.error || "Failed to save");
            setSaving(false);
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-lg font-extrabold dark:text-slate-100">{task.TITLE}</div>
                        {task.COST_CENTER && (
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">CC: {ccMap.get(task.COST_CENTER) || task.COST_CENTER}</div>
                        )}
                    </div>
                    <button
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        onClick={onClose}
                    >✖</button>
                </div>

                {task.DESCRIPTION && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {task.DESCRIPTION}
                    </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Deadline</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(task.DEADLINE)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Created</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(task.CREATED_AT)}</div>
                    </div>
                </div>

                <div className="mt-4 grid gap-3">
                    <div>
                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Status</div>
                        <select
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                        >
                            {STATUSES.map(s => (
                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Time spent (hours)</div>
                        <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={hours}
                            onChange={e => setHours(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                </div>

                <ChatPanel taskId={task.TASK_ID} currentEmpId={getEmpId()} />

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ---- Admin: task detail modal with assignments list ----
function AdminTaskModal({ task, onClose, ccMap }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(lockScroll, []);

    useEffect(() => {
        api.get(`/tasks/${task.TASK_ID}/assignments`)
            .then(r => setAssignments(r.data.items || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [task.TASK_ID]);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-lg font-extrabold dark:text-slate-100">{task.TITLE}</div>
                        {task.COST_CENTER && (
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">CC: {ccMap.get(task.COST_CENTER) || task.COST_CENTER}</div>
                        )}
                    </div>
                    <button
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        onClick={onClose}
                    >✖</button>
                </div>

                {task.DESCRIPTION && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {task.DESCRIPTION}
                    </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Deadline</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(task.DEADLINE)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Created</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(task.CREATED_AT)}</div>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Assignments ({Number(task.FINISHED_COUNT || 0)}/{Number(task.TOTAL_ASSIGNED || 0)} finished)
                    </div>
                    {loading ? (
                        <div className="py-4 text-center text-sm text-slate-500">Loading...</div>
                    ) : assignments.length === 0 ? (
                        <div className="py-4 text-center text-sm text-slate-500">No assignments</div>
                    ) : (
                        <div className="max-h-52 overflow-y-auto grid gap-2">
                            {assignments.map(a => (
                                <div key={a.ASSIGNMENT_ID} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                            {a.FirstName} {a.LastName}
                                            <span className="ml-1 text-xs font-normal text-slate-500">({a.EMP_ID})</span>
                                        </div>
                                        {Number(a.TIME_SPENT_MINUTES) > 0 && (
                                            <div className="text-xs text-slate-500">{minsToHours(a.TIME_SPENT_MINUTES)}h spent</div>
                                        )}
                                    </div>
                                    <StatusBadge status={a.STATUS} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <ChatPanel taskId={task.TASK_ID} currentEmpId={getEmpId()} />

                <div className="mt-4 flex justify-end">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ---- Admin: create task modal ----
function CreateTaskModal({ onClose, onCreated }) {
    const toast = useToast();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [costCenter, setCostCenter] = useState("");
    const [deadline, setDeadline] = useState("");
    const [users, setUsers] = useState([]);
    const [costCenters, setCostCenters] = useState([]);
    const [selectedEmpIds, setSelectedEmpIds] = useState([]);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(lockScroll, []);

    useEffect(() => {
        api.get("/users?limit=200").then(r => setUsers(r.data.items || [])).catch(() => {});
        api.get("/hana/cost-centers").then(r => setCostCenters(r.data.items || [])).catch(() => {});
    }, []);

    function toggleEmp(empId) {
        const id = String(empId);
        setSelectedEmpIds(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    }

    const filteredUsers = users.filter(u => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            String(u.EmpID).includes(q) ||
            (u.FirstName || "").toLowerCase().includes(q) ||
            (u.LastName || "").toLowerCase().includes(q)
        );
    });

    async function submit() {
        if (!title.trim()) return toast.error("Title is required");
        if (!selectedEmpIds.length) return toast.error("Select at least one employee");
        setSaving(true);
        try {
            await api.post("/tasks", {
                title: title.trim(),
                description: description.trim() || null,
                costCenter: costCenter || null,
                deadline: deadline || null,
                empIds: selectedEmpIds,
            });
            toast.success("Task created");
            onCreated();
        } catch (e) {
            toast.error(e?.response?.data?.error || "Failed to create task");
            setSaving(false);
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <div className="text-lg font-extrabold dark:text-slate-100">New Task</div>
                    <button
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        onClick={onClose}
                    >✖</button>
                </div>

                <div className="mt-4 grid gap-3">
                    <div>
                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Title *</div>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
                    </div>
                    <div>
                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Description</div>
                        <textarea
                            className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Optional description..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Cost Center</div>
                            <select
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                                value={costCenter}
                                onChange={e => setCostCenter(e.target.value)}
                            >
                                <option value="">— None —</option>
                                {costCenters.map(cc => (
                                    <option key={cc.code} value={cc.code}>{cc.name} ({cc.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Deadline</div>
                            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
                            Assign employees ({selectedEmpIds.length} selected)
                        </div>
                        <Input
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                            {filteredUsers.length === 0 ? (
                                <div className="py-3 text-center text-sm text-slate-500">No users found</div>
                            ) : (
                                filteredUsers.map(u => {
                                    const id = String(u.EmpID);
                                    const checked = selectedEmpIds.includes(id);
                                    return (
                                        <label
                                            key={id}
                                            className={cn(
                                                "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800",
                                                checked && "bg-slate-50 dark:bg-slate-800"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleEmp(id)}
                                                className="rounded"
                                            />
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                {u.FirstName} {u.LastName}
                                            </span>
                                            <span className="text-slate-500">({u.EmpID})</span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Task"}</Button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ---- Main Tasks page ----
export default function Tasks() {
    const toast = useToast();
    const admin = isAdmin();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [selectedTask, setSelectedTask] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [monthFilter, setMonthFilter] = useState(currentMonth());
    const [ccFilter, setCcFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [ccMap, setCcMap] = useState(new Map());

    const load = useCallback(() => {
        setLoading(true);
        api.get("/tasks")
            .then(r => setTasks(r.data.items || []))
            .catch(e => {
                toast.error(e?.response?.data?.error || "Failed to load tasks");
                setErr("Failed to load tasks");
            })
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        api.get("/hana/cost-centers")
            .then(r => setCcMap(new Map((r.data.items || []).map(c => [c.code, c.name]))))
            .catch(() => {});
    }, []);

    function handleUserSave(updated) {
        setTasks(prev => prev.map(t =>
            t.ASSIGNMENT_ID === updated.ASSIGNMENT_ID ? { ...t, ...updated } : t
        ));
        setSelectedTask(null);
    }

    // Derive unique cost centers from loaded tasks
    const ccOptions = [...new Set(tasks.map(t => t.COST_CENTER).filter(Boolean))];

    const filtered = tasks.filter(t => {
        const taskMonth = String(t.CREATED_AT || "").slice(0, 7);
        if (monthFilter && taskMonth !== monthFilter) return false;
        if (ccFilter !== "all" && t.COST_CENTER !== ccFilter) return false;
        if (statusFilter !== "all") {
            const s = admin ? adminCardStatus(t) : (t.STATUS || "pending");
            if (s !== statusFilter) return false;
        }
        return true;
    });

    return (
        <div className="mx-auto max-w-3xl px-4 py-4 pb-48">
            <div className="mb-4 flex items-center justify-between">
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {admin ? "All Tasks" : "My Tasks"}
                </div>
                {admin && (
                    <Button onClick={() => setCreateOpen(true)}>+ Add Task</Button>
                )}
            </div>

            {/* Filters */}
            <div className="mb-4 grid grid-cols-3 gap-3">
                <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Month</div>
                    <input
                        type="month"
                        value={monthFilter}
                        onChange={e => setMonthFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                    />
                </div>
                <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Cost Center</div>
                    <select
                        value={ccFilter}
                        onChange={e => setCcFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                    >
                        <option value="all">All</option>
                        {ccOptions.map(cc => (
                            <option key={cc} value={cc}>{ccMap.get(cc) || cc}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Status</div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                    >
                        <option value="all">All</option>
                        {STATUSES.map(s => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading...</div>
            ) : err ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>
            ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">No tasks.</div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map(task => {
                        const cardStatus = admin ? adminCardStatus(task) : (task.STATUS || "pending");
                        return (
                            <button
                                key={admin ? task.TASK_ID : task.ASSIGNMENT_ID}
                                onClick={() => setSelectedTask(task)}
                                className={cn(
                                    "w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md",
                                    CARD_CONFIG[cardStatus] || CARD_CONFIG.pending
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{task.TITLE}</div>
                                    {admin ? (
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                            {Number(task.FINISHED_COUNT || 0)}/{Number(task.TOTAL_ASSIGNED || 0)} done
                                        </span>
                                    ) : (
                                        <StatusBadge status={task.STATUS} />
                                    )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    {task.DEADLINE && <span>Deadline: {fmtDate(task.DEADLINE)}</span>}
                                    {task.COST_CENTER && <span>CC: {ccMap.get(task.COST_CENTER) || task.COST_CENTER}</span>}
                                    {!admin && Number(task.TIME_SPENT_MINUTES) > 0 && (
                                        <span>{minsToHours(task.TIME_SPENT_MINUTES)}h logged</span>
                                    )}
                                    <span>Created: {fmtDate(task.CREATED_AT)}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selectedTask && !admin && (
                <UserTaskModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onSave={handleUserSave}
                    ccMap={ccMap}
                />
            )}

            {selectedTask && admin && (
                <AdminTaskModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    ccMap={ccMap}
                />
            )}

            {createOpen && (
                <CreateTaskModal
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => { setCreateOpen(false); load(); }}
                />
            )}
        </div>
    );
}
