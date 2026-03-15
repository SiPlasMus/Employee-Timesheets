import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Info, Plus, Search, HelpCircle, X, ChevronDown, Code2, Image, Film, FileText, Pin, MessageSquare, Palette } from "lucide-react";
import { api } from "../api";
import { isAdmin, getEmpId } from "../auth";
import { getSocket } from "../socket";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { cn } from "../ui/ui";
import { useToast } from "../components/Toast";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    pending:  { label: "Pending",  cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
    start:    { label: "Started",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    doing:    { label: "Doing",    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    finished: { label: "Finished", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    failed:   { label: "Failed",   cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
    rejected: { label: "Rejected", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

const AVATAR_COLOR = {
    pending:  "bg-slate-400",
    start:    "bg-blue-500",
    doing:    "bg-amber-500",
    finished: "bg-emerald-500",
    failed:   "bg-rose-500",
    rejected: "bg-orange-500",
};

function adminCardStatus(task) {
    const total    = Number(task.TOTAL_ASSIGNED || 0);
    const finished = Number(task.FINISHED_COUNT || 0);
    if (total === 0)           return "pending";
    if (finished === total)    return "finished";
    if (finished > 0)          return "doing";
    return "pending";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) {
    if (!d) return "—";
    return String(d).slice(0, 10);
}

function fmtMsgTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtListTime(ts) {
    if (!ts) return "";
    const d   = new Date(ts);
    if (isNaN(d)) return "";
    const now  = new Date();
    const diff = (now - d) / 86400000;
    if (diff < 1)  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 2)  return "Yesterday";
    if (diff < 7)  return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDayLabel(d) {
    const now       = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === now.toDateString())       return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function minsToHours(m) {
    const n = Number(m || 0);
    if (!n) return "0";
    const h = n / 60;
    return h % 1 === 0 ? String(h) : h.toFixed(1);
}

// Groups consecutive same-sender messages (within 5 min), inserts day dividers
function buildItems(messages, currentEmpId) {
    const result    = [];
    let lastDay     = null;
    let lastGroup   = null;

    for (const msg of messages) {
        const d   = new Date(msg.created_at);
        const day = d.toDateString();

        if (day !== lastDay) {
            result.push({ type: "divider", label: getDayLabel(d) });
            lastDay   = day;
            lastGroup = null;
        }

        const mine = String(msg.sender_emp_id) === String(currentEmpId);
        const gap  = lastGroup
            ? d - new Date(lastGroup.msgs.at(-1).created_at)
            : Infinity;

        if (lastGroup && lastGroup.empId === msg.sender_emp_id && gap < 5 * 60 * 1000) {
            lastGroup.msgs.push(msg);
        } else {
            lastGroup = { type: "group", empId: msg.sender_emp_id, name: msg.sender_name, mine, msgs: [msg] };
            result.push(lastGroup);
        }
    }
    return result;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
            {s.label}
        </span>
    );
}

// ─── TaskItem (left panel row) ────────────────────────────────────────────────

function TaskItem({ task, summary, isSelected, onClick, admin, ccMap }) {
    const cardStatus = admin ? adminCardStatus(task) : (task.STATUS || "pending");
    const lastMsg    = summary?.last_message;
    const unread     = summary?.unread_count || 0;
    const avatarCls  = AVATAR_COLOR[cardStatus] || "bg-slate-400";

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-800",
                isSelected
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
            )}
        >
            {/* Avatar */}
            <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white",
                avatarCls
            )}>
                {task.TITLE.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {task.TITLE}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {lastMsg ? fmtListTime(lastMsg.created_at) : fmtDate(task.CREATED_AT)}
                    </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {lastMsg
                            ? `${lastMsg.sender_name || lastMsg.sender_emp_id}: ${lastMsg.message}`
                            : admin
                                ? `${task.TOTAL_ASSIGNED || 0} assigned · ${task.FINISHED_COUNT || 0} done`
                                : STATUS_CONFIG[task.STATUS]?.label || "Pending"
                        }
                    </span>
                    {unread > 0 && (
                        <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[10px] font-bold text-white">
                            {unread > 99 ? "99+" : unread}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

// ─── TaskInfoEmployee ─────────────────────────────────────────────────────────

function TaskInfoEmployee({ task, ccMap, onUpdated }) {
    const toast   = useToast();
    const [status, setStatus] = useState(task.STATUS || "pending");
    const [hours,  setHours]  = useState(minsToHours(task.TIME_SPENT_MINUTES));
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        try {
            const mins = Math.round(parseFloat(hours || 0) * 60);
            await api.patch(`/task-assignments/${task.ASSIGNMENT_ID}`, { status, timeSpentMinutes: mins });
            onUpdated({ ...task, STATUS: status, TIME_SPENT_MINUTES: mins });
            toast.success("Task updated");
        } catch (e) {
            toast.error(e?.response?.data?.error || "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="grid gap-3">
            {task.DESCRIPTION && (
                <p className="text-sm text-slate-600 dark:text-slate-300">{task.DESCRIPTION}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Status</div>
                    <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Time spent (h)</div>
                    <input
                        type="number" min={0} step={0.5}
                        value={hours}
                        onChange={e => setHours(e.target.value)}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
            </div>
            {(task.DEADLINE || task.COST_CENTER) && (
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {task.DEADLINE   && <span>Deadline: <b className="text-slate-700 dark:text-slate-200">{fmtDate(task.DEADLINE)}</b></span>}
                    {task.COST_CENTER && <span>CC: <b className="text-slate-700 dark:text-slate-200">{ccMap.get(task.COST_CENTER) || task.COST_CENTER}</b></span>}
                </div>
            )}
            <Button onClick={save} disabled={saving} className="w-full">
                {saving ? "Saving…" : "Save Changes"}
            </Button>
        </div>
    );
}

// ─── TaskInfoAdmin ────────────────────────────────────────────────────────────

function TaskInfoAdmin({ task, ccMap }) {
    const [assignments, setAssignments] = useState([]);
    const [loading,     setLoading]     = useState(true);

    useEffect(() => {
        api.get(`/tasks/${task.TASK_ID}/assignments`)
            .then(r => setAssignments(r.data.items || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [task.TASK_ID]);

    return (
        <div className="grid gap-3">
            {task.DESCRIPTION && (
                <p className="text-sm text-slate-600 dark:text-slate-300">{task.DESCRIPTION}</p>
            )}
            {(task.DEADLINE || task.COST_CENTER) && (
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {task.DEADLINE    && <span>Deadline: <b className="text-slate-700 dark:text-slate-200">{fmtDate(task.DEADLINE)}</b></span>}
                    {task.COST_CENTER && <span>CC: <b className="text-slate-700 dark:text-slate-200">{ccMap.get(task.COST_CENTER) || task.COST_CENTER}</b></span>}
                </div>
            )}
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Assignments ({Number(task.FINISHED_COUNT || 0)}/{Number(task.TOTAL_ASSIGNED || 0)} finished)
            </div>
            {loading ? (
                <div className="text-xs text-slate-400">Loading…</div>
            ) : (
                <div className="grid max-h-40 gap-1.5 overflow-y-auto">
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
    );
}

// ─── Message content parser ──────────────────────────────────────────────────

// Splits message into block segments: text (may contain inline fmt), fenced code
function parseMessage(text) {
    const segments = [];
    const re = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) segments.push({ type: "text", content: text.slice(last, m.index) });
        segments.push({ type: "code", lang: m[1] || "", content: m[2].replace(/\n$/, "") });
        last = m.index + m[0].length;
    }
    if (last < text.length) segments.push({ type: "text", content: text.slice(last) });
    return segments;
}

// Renders inline markdown within a text segment: **bold**, *italic*, __underline__, `code`, [text](url)
function renderInline(text, mineStyle) {
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|`([^`\n]+)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        if (m[1] !== undefined) parts.push(<strong key={m.index}>{m[1]}</strong>);
        else if (m[2] !== undefined) parts.push(<em key={m.index}>{m[2]}</em>);
        else if (m[3] !== undefined) parts.push(<u key={m.index}>{m[3]}</u>);
        else if (m[4] !== undefined) parts.push(
            <code key={m.index} className={cn(
                "rounded px-1 py-0.5 font-mono text-[0.8em]",
                mineStyle ? "bg-white/20 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-600 dark:text-slate-100"
            )}>{m[4]}</code>
        );
        else if (m[5] !== undefined) parts.push(
            <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer"
               className={cn("underline underline-offset-2", mineStyle ? "text-indigo-200 hover:text-white" : "text-indigo-600 hover:text-indigo-800 dark:text-indigo-400")}>
                {m[5]}
            </a>
        );
        else if (m[7] !== undefined) parts.push(
            <span key={m.index} className={cn(
                "rounded px-1 font-semibold",
                mineStyle ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400"
            )}>@{m[7]}</span>
        );
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

function CodeBlock({ content, mine }) {
    const [copied, setCopied] = useState(false);

    function copy() {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    return (
        <div className={cn(
            "my-1 w-full max-w-full overflow-hidden rounded-xl border text-xs",
            mine
                ? "border-white/20 bg-black/40"
                : "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
        )}>
            {/* Header bar */}
            <div className={cn(
                "flex items-center justify-end px-3 py-1.5",
                mine
                    ? "border-b border-white/20 bg-black/30"
                    : "border-b border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/60"
            )}>
                <button
                    onClick={copy}
                    className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold transition",
                        mine
                            ? "bg-white/10 text-white/80 hover:bg-white/20"
                            : "bg-white text-slate-600 hover:bg-slate-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                    )}
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
            {/* Code body */}
            <pre
                className={cn(
                    "px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap",
                    mine ? "text-white/90" : "text-slate-800 dark:text-slate-100"
                )}
                style={{ maxWidth: "80ch", overflowWrap: "break-word" }}
            >
                <code>{content}</code>
            </pre>
        </div>
    );
}

function MessageContent({ text, mine }) {
    const segments = parseMessage(text);

    return (
        <div className="min-w-0 w-full">
            {segments.map((seg, i) =>
                seg.type === "code"
                    ? <CodeBlock key={i} content={seg.content} mine={mine} />
                    : <span key={i} className="whitespace-pre-wrap">{renderInline(seg.content, mine)}</span>
            )}
        </div>
    );
}

// ─── Reactions + context menu ─────────────────────────────────────────────────

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// ─── Theme presets ─────────────────────────────────────────────────────────────
const CHAT_BG_PRESETS = [
    { id: 'default',      label: 'Default',       bg: '' },
    { id: 'purple-dream', label: 'Purple Dream',   bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'pink-candy',   label: 'Pink Candy',     bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { id: 'ocean-blue',   label: 'Ocean Blue',     bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { id: 'mint-fresh',   label: 'Mint Fresh',     bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
    { id: 'sunset',       label: 'Sunset',         bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { id: 'deep-ocean',   label: 'Deep Ocean',     bg: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
    { id: 'lavender',     label: 'Lavender',       bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
    { id: 'rose-cloud',   label: 'Rose Cloud',     bg: 'radial-gradient(circle at top left, #ff9a9e 0%, #fecfef 100%)' },
    { id: 'dark-space',   label: 'Dark Space',     bg: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
    { id: 'forest',       label: 'Forest',         bg: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
];

const OWN_MSG_PRESETS = [
    { bg: '#1e293b', text: '#ffffff', label: 'Dark' },
    { bg: '#4f46e5', text: '#ffffff', label: 'Indigo' },
    { bg: '#16a34a', text: '#ffffff', label: 'Green' },
    { bg: '#0369a1', text: '#ffffff', label: 'Blue' },
    { bg: '#7c3aed', text: '#ffffff', label: 'Violet' },
    { bg: '#be123c', text: '#ffffff', label: 'Rose' },
];

const OTHERS_MSG_PRESETS = [
    { bg: '#ffffff', text: '#0f172a', label: 'White' },
    { bg: '#f1f5f9', text: '#1e293b', label: 'Light' },
    { bg: '#1e293b', text: '#e2e8f0', label: 'Dark' },
];

function groupReactions(reactions, currentEmpId) {
    const map = {};
    for (const r of reactions || []) {
        if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, hasMe: false };
        map[r.emoji].count++;
        if (String(r.emp_id) === String(currentEmpId)) map[r.emoji].hasMe = true;
    }
    return Object.values(map);
}

function ContextMenu({ msg, pos, mine, admin, pinnedMsgId, onClose, onReply, onReact, onEdit, onDelete, onPin }) {
    const menuRef = useRef(null);

    useEffect(() => {
        function handler(e) { if (!menuRef.current?.contains(e.target)) onClose(); }
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [onClose]);

    // Keep menu inside viewport
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = pos.x + 208 > vw ? vw - 212 : pos.x;
    const top  = pos.y + 240 > vh ? pos.y - 240 : pos.y;

    const actionCls = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700";

    return createPortal(
        <div
            ref={menuRef}
            style={{ position: "fixed", top, left, zIndex: 400 }}
            className="w-52 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        >
            {/* Emoji reaction grid 3×2 */}
            <div className="grid grid-cols-3 gap-1 border-b border-slate-100 p-2 dark:border-slate-700">
                {REACTION_EMOJIS.map(e => (
                    <button key={e} onClick={() => { onReact(e); onClose(); }}
                        className="flex items-center justify-center rounded-xl py-1.5 text-lg leading-none transition hover:scale-110 hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700">
                        {e}
                    </button>
                ))}
            </div>
            {/* Actions */}
            <div className="p-1">
                <button onClick={() => { onReply(); onClose(); }} className={cn(actionCls, "text-slate-700 dark:text-slate-300")}>
                    <MessageSquare className="h-4 w-4 shrink-0" /> Reply
                </button>
                {mine && (
                    <button onClick={() => { onEdit(); onClose(); }} className={cn(actionCls, "text-slate-700 dark:text-slate-300")}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                    </button>
                )}
                {admin && (
                    <button onClick={() => { onPin(); onClose(); }} className={cn(actionCls, "text-slate-700 dark:text-slate-300")}>
                        <Pin className="h-4 w-4 shrink-0" />
                        {pinnedMsgId === msg.id ? "Unpin" : "Pin"}
                    </button>
                )}
                {(mine || admin) && (
                    <button onClick={() => { onDelete(); onClose(); }} className={cn(actionCls, "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20")}>
                        <X className="h-4 w-4 shrink-0" /> Delete
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}

// ─── MessageGroup ─────────────────────────────────────────────────────────────

function MessageGroup({ group, admin, currentEmpId, pinnedMsgId, onEdit, onDelete, onReply, onReact, onPin, theme }) {
    const { mine, name, empId, msgs } = group;
    const [contextMenu,    setContextMenu]    = useState(null); // { msg, pos }
    const longPressTimer = useRef(null);

    function openMenu(msg, x, y) { setContextMenu({ msg, pos: { x, y } }); }

    function handleContextMenu(e, msg) {
        e.preventDefault();
        openMenu(msg, e.clientX, e.clientY);
    }

    function handleTouchStart(e, msg) {
        const t = e.touches[0];
        longPressTimer.current = setTimeout(() => openMenu(msg, t.clientX, t.clientY), 500);
    }

    function handleTouchEnd() { clearTimeout(longPressTimer.current); }

    return (
        <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
            {/* Avatar (others only) */}
            {!mine && (
                <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white dark:bg-slate-600">
                    {(name || empId || "?")[0].toUpperCase()}
                </div>
            )}

            <div className={cn(
                "flex flex-col gap-0.5",
                mine ? "items-end" : "items-start",
                msgs.some(m => /```[\s\S]*```/.test(m.message)) ? "max-w-[95%]" : "max-w-[85%]"
            )}>
                {/* Sender name for others */}
                {!mine && (
                    <span className="px-3 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">
                        {name || empId}
                    </span>
                )}

                {msgs.map((msg, i) => {
                    const isFirst   = i === 0;
                    const isLast    = i === msgs.length - 1;
                    const hasCode   = /```[\s\S]*```/.test(msg.message);
                    const reactions = groupReactions(msg.reactions, currentEmpId);

                    return (
                        <div
                            key={msg.id}
                            data-msg-id={msg.id}
                            className={cn("flex flex-col", hasCode ? "w-full" : "", mine ? "items-end" : "items-start")}
                        >
                            {/* Reply quote */}
                            {msg.reply_to_id && msg.reply_to_preview && (
                                <div className={cn(
                                    "mb-0.5 max-w-full rounded-xl border-l-2 px-2 py-1 text-xs",
                                    mine
                                        ? "border-white/60 bg-black/25 text-white/90"
                                        : "border-indigo-400 bg-indigo-50 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
                                )}>
                                    <span className="line-clamp-2 italic">{msg.reply_to_preview}</span>
                                </div>
                            )}

                            <div
                                className={cn(
                                    "px-3 py-2 text-sm leading-snug break-words cursor-default select-text",
                                    hasCode ? "w-full" : "",
                                    mine
                                        ? "bg-slate-900 text-white dark:bg-indigo-600"
                                        : "border border-slate-100 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-700 dark:text-slate-100",
                                    mine ? [
                                        "rounded-2xl",
                                        isFirst && msgs.length > 1 && "rounded-br-md",
                                        !isFirst && !isLast && "rounded-r-md",
                                        !isFirst && isLast  && "rounded-tr-md",
                                    ] : [
                                        "rounded-2xl",
                                        isFirst && msgs.length > 1 && "rounded-bl-md",
                                        !isFirst && !isLast && "rounded-l-md",
                                        !isFirst && isLast  && "rounded-tl-md",
                                    ]
                                )}
                                style={
                                    mine && theme?.ownBg
                                        ? { backgroundColor: theme.ownBg, color: theme.ownText || '#ffffff' }
                                        : !mine && theme?.othersBg
                                            ? { backgroundColor: theme.othersBg, color: theme.othersText || '#0f172a' }
                                            : undefined
                                }
                                onContextMenu={e => handleContextMenu(e, msg)}
                                onTouchStart={e => handleTouchStart(e, msg)}
                                onTouchEnd={handleTouchEnd}
                                onTouchMove={handleTouchEnd}
                            >
                                <MessageContent text={msg.message} mine={mine} />
                                {isLast && (
                                    <div className={cn(
                                        "mt-1 flex items-center gap-1 text-[10px]",
                                        mine ? "justify-end text-slate-400" : "text-slate-400 dark:text-slate-500"
                                    )}>
                                        {pinnedMsgId === msg.id && (
                                            <Pin className="h-2.5 w-2.5 shrink-0 text-amber-500" />
                                        )}
                                        {fmtMsgTime(msg.created_at)}
                                        {msg.edited && <span className="ml-1 opacity-60">(edited)</span>}
                                    </div>
                                )}
                            </div>

                            {/* Reaction pills */}
                            {reactions.length > 0 && (
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                    {reactions.map(r => (
                                        <button
                                            key={r.emoji}
                                            onClick={() => onReact(msg, r.emoji)}
                                            className={cn(
                                                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition",
                                                r.hasMe
                                                    ? "border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                            )}
                                        >
                                            {r.emoji} <span className="font-semibold">{r.count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Context menu */}
            {contextMenu && (
                <ContextMenu
                    msg={contextMenu.msg}
                    pos={contextMenu.pos}
                    mine={mine}
                    admin={admin}
                    pinnedMsgId={pinnedMsgId}
                    onClose={() => setContextMenu(null)}
                    onReply={() => onReply(contextMenu.msg)}
                    onReact={emoji => onReact(contextMenu.msg, emoji)}
                    onEdit={() => onEdit(contextMenu.msg)}
                    onDelete={() => onDelete(contextMenu.msg.id)}
                    onPin={() => onPin(contextMenu.msg)}
                />
            )}
        </div>
    );
}

// ─── ChatView ─────────────────────────────────────────────────────────────────

function ChatView({ task, admin, currentEmpId, ccMap, onBack, onTaskUpdated, theme, onOpenTheme }) {
    const [infoOpen,      setInfoOpen]      = useState(false);
    const [messages,      setMessages]      = useState([]);
    const [msgLoading,    setMsgLoading]    = useState(true);
    const [hasMore,       setHasMore]       = useState(false);
    const [loadingMore,   setLoadingMore]   = useState(false);
    const [text,          setText]          = useState("");
    const [editingMsg,    setEditingMsg]    = useState(null);
    const [replyTo,       setReplyTo]       = useState(null); // { id, preview }
    const [typingUsers,   setTypingUsers]   = useState(new Map()); // empId -> name
    const [pinnedMsg,     setPinnedMsg]     = useState(null);
    const [searchOpen,    setSearchOpen]    = useState(false);
    const [searchQuery,   setSearchQuery]   = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [participants,  setParticipants]  = useState([]);
    const [mentionQuery,  setMentionQuery]  = useState(null); // string | null
    const [attachOpen,    setAttachOpen]    = useState(false);

    const bottomRef      = useRef(null);
    const socketRef      = useRef(null);
    const inputRef       = useRef(null);
    const sentinelRef    = useRef(null);
    const containerRef   = useRef(null);
    const typingTimer    = useRef(null);
    const taskId         = Number(task.TASK_ID);

    // Load history + subscribe socket events
    useEffect(() => {
        setMessages([]);
        setMsgLoading(true);
        setText("");
        setInfoOpen(false);
        setEditingMsg(null);
        setReplyTo(null);
        setPinnedMsg(null);
        setHasMore(false);
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        setTypingUsers(new Map());

        api.get(`/tasks/${taskId}/chat`)
            .then(r => {
                setMessages(r.data.items || []);
                setHasMore(r.data.has_more || false);
                if (r.data.pinned_message) setPinnedMsg(r.data.pinned_message);
            })
            .catch(() => {})
            .finally(() => setMsgLoading(false));

        api.get(`/tasks/${taskId}/participants`)
            .then(r => setParticipants(r.data.items || []))
            .catch(() => {});

        const socket = getSocket();
        socketRef.current = socket;

        function onMessage(msg) {
            if (Number(msg.task_id) !== taskId) return;
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, reactions: msg.reactions || [] }]);
        }
        function onUpdated(msg) {
            if (Number(msg.task_id) !== taskId) return;
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, message: msg.message, edited: true } : m));
        }
        function onDeleted({ id, task_id }) {
            if (Number(task_id) !== taskId) return;
            setMessages(prev => prev.filter(m => m.id !== id));
        }
        function onTyping({ empId: tid, name }) {
            if (String(tid) === String(currentEmpId)) return;
            setTypingUsers(prev => { const n = new Map(prev); n.set(String(tid), name || tid); return n; });
            clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => {
                setTypingUsers(prev => { const n = new Map(prev); n.delete(String(tid)); return n; });
            }, 3000);
        }
        function onReactionsUpdated({ message_id, reactions }) {
            if (!message_id) return;
            setMessages(prev => prev.map(m => m.id === message_id ? { ...m, reactions: reactions || [] } : m));
        }
        function onPinned({ task_id, pinned_message }) {
            if (Number(task_id) !== taskId) return;
            setPinnedMsg(pinned_message || null);
        }

        socket.on("chat:message",           onMessage);
        socket.on("chat:message-updated",   onUpdated);
        socket.on("chat:message-deleted",   onDeleted);
        socket.on("chat:typing",            onTyping);
        socket.on("chat:reactions-updated", onReactionsUpdated);
        socket.on("chat:pinned",            onPinned);

        return () => {
            socket.off("chat:message",           onMessage);
            socket.off("chat:message-updated",   onUpdated);
            socket.off("chat:message-deleted",   onDeleted);
            socket.off("chat:typing",            onTyping);
            socket.off("chat:reactions-updated", onReactionsUpdated);
            socket.off("chat:pinned",            onPinned);
            clearTimeout(typingTimer.current);
        };
    }, [taskId, currentEmpId]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (!msgLoading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, msgLoading]);

    // Pagination sentinel
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasMore && !loadingMore) loadMoreMessages();
        }, { threshold: 0.1 });
        obs.observe(el);
        return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMore, loadingMore]);

    // Search debounce
    useEffect(() => {
        if (!searchOpen || !searchQuery.trim()) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const r = await api.get(`/tasks/${taskId}/chat/search?q=${encodeURIComponent(searchQuery)}`);
                setSearchResults(r.data.items || []);
            } catch { setSearchResults([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery, searchOpen, taskId]);

    // Global Esc key — works even when input is not focused
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key !== 'Escape') return;
            // Don't double-fire if the textarea already handled it
            if (document.activeElement === inputRef.current) return;
            if (replyTo)    { setReplyTo(null); return; }
            if (editingMsg) { setEditingMsg(null); setText(""); if (inputRef.current) inputRef.current.style.height = "auto"; return; }
            if (searchOpen) { setSearchOpen(false); setSearchQuery(""); return; }
            onBack();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [replyTo, editingMsg, searchOpen, onBack]);

    async function loadMoreMessages() {
        if (loadingMore || !hasMore || messages.length === 0) return;
        setLoadingMore(true);
        const before = messages[0].id;
        const container = containerRef.current;
        const prevScrollHeight = container?.scrollHeight || 0;
        try {
            const r = await api.get(`/tasks/${taskId}/chat?before=${before}&limit=50`);
            const older = r.data.items || [];
            setMessages(prev => [...older, ...prev]);
            setHasMore(r.data.has_more || false);
            requestAnimationFrame(() => {
                if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
            });
        // eslint-disable-next-line no-empty
        } catch {}
        finally { setLoadingMore(false); }
    }

    function autoResize(el) {
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }

    function applyFormat(before, after = before) {
        const el = inputRef.current;
        if (!el) return;
        const start    = el.selectionStart;
        const end      = el.selectionEnd;
        const selected = text.slice(start, end);
        const newText  = text.slice(0, start) + before + selected + after + text.slice(end);
        setText(newText);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + before.length, end + before.length);
            autoResize(el);
        });
    }

    function applyFormatLink() {
        const el = inputRef.current;
        if (!el) return;
        const start    = el.selectionStart;
        const end      = el.selectionEnd;
        const selected = text.slice(start, end) || "link text";
        const insert   = `[${selected}](url)`;
        const newText  = text.slice(0, start) + insert + text.slice(end);
        setText(newText);
        const urlStart = start + 1 + selected.length + 2;
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(urlStart, urlStart + 3);
            autoResize(el);
        });
    }

    function handleTextChange(e) {
        const val = e.target.value;
        setText(val);
        autoResize(e.target);
        // Typing indicator (debounced)
        socketRef.current?.emit("chat:typing", taskId);
        // @mention detection
        const cursor = e.target.selectionStart;
        const before = val.slice(0, cursor);
        const match  = before.match(/@(\w*)$/);
        setMentionQuery(match ? match[1] : null);
    }

    function insertMention(participant) {
        const el = inputRef.current;
        if (!el) return;
        const cursor  = el.selectionStart;
        const before  = text.slice(0, cursor);
        const match   = before.match(/@(\w*)$/);
        if (!match) { setMentionQuery(null); return; }
        const start   = cursor - match[0].length;
        const mention = `@[${participant.name}](${participant.empId})`;
        const newText = text.slice(0, start) + mention + text.slice(cursor);
        setText(newText);
        setMentionQuery(null);
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + mention.length;
            el.setSelectionRange(pos, pos);
            autoResize(el);
        });
    }

    function send(e) {
        e?.preventDefault();
        const msg = text.trim();
        if (!msg) return;

        if (editingMsg) {
            api.patch(`/tasks/${taskId}/chat/${editingMsg.id}`, { message: msg })
                .then(() => {
                    setMessages(prev => prev.map(m =>
                        m.id === editingMsg.id ? { ...m, message: msg, edited: true } : m
                    ));
                    setEditingMsg(null);
                    setText("");
                    if (inputRef.current) inputRef.current.style.height = "auto";
                })
                .catch(() => {});
            return;
        }

        socketRef.current?.emit("chat:send", {
            taskId,
            message:        msg,
            replyToId:      replyTo?.id      || null,
            replyToPreview: replyTo?.preview  || null,
        });
        setText("");
        setReplyTo(null);
        if (inputRef.current) inputRef.current.style.height = "auto";
    }

    function startEdit(msg) {
        setEditingMsg(msg);
        setReplyTo(null);
        setText(msg.message);
        requestAnimationFrame(() => { inputRef.current?.focus(); autoResize(inputRef.current); });
    }

    function cancelEdit() {
        setEditingMsg(null);
        setText("");
        if (inputRef.current) inputRef.current.style.height = "auto";
    }

    function deleteMsg(id) {
        api.delete(`/tasks/${taskId}/chat/${id}`)
            .then(() => setMessages(prev => prev.filter(m => m.id !== id)))
            .catch(() => {});
    }

    function handleReply(msg) {
        setReplyTo({ id: msg.id, preview: msg.message.slice(0, 120) });
        setEditingMsg(null);
        requestAnimationFrame(() => inputRef.current?.focus());
    }

    function handleReact(msg, emoji) {
        api.post(`/tasks/${taskId}/chat/react`, { messageId: msg.id, emoji }).catch(() => {});
    }

    function handlePin(msg) {
        const newPinId = pinnedMsg?.id === msg.id ? null : msg.id;
        api.patch(`/tasks/${taskId}/pin`, { messageId: newPinId }).catch(() => {});
    }

    function scrollToPinned() {
        if (!pinnedMsg) return;
        const el = containerRef.current?.querySelector(`[data-msg-id="${pinnedMsg.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function handleKeyDown(e) {
        const ctrl = e.ctrlKey || e.metaKey;

        if (e.key === "Escape" && mentionQuery !== null) { setMentionQuery(null); return; }

        if (ctrl && !e.shiftKey) {
            if (e.key === "b" || e.key === "B") { e.preventDefault(); applyFormat("**"); return; }
            if (e.key === "i" || e.key === "I") { e.preventDefault(); applyFormat("*");  return; }
            if (e.key === "u" || e.key === "U") { e.preventDefault(); applyFormat("__"); return; }
            if (e.key === "k" || e.key === "K") { e.preventDefault(); applyFormatLink(); return; }
        }
        if (ctrl && e.shiftKey && (e.key === "m" || e.key === "M")) {
            e.preventDefault(); applyFormat("`"); return;
        }

        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); return; }

        if (e.key === "Escape") {
            if (replyTo)    { setReplyTo(null); return; }
            if (editingMsg) { cancelEdit(); return; }
            if (searchOpen) { setSearchOpen(false); setSearchQuery(""); return; }
            onBack();
            return;
        }

        if (e.key === "ArrowUp" && !text) {
            const myMsgs = messages.filter(m => String(m.sender_emp_id) === String(currentEmpId));
            if (myMsgs.length) startEdit(myMsgs[myMsgs.length - 1]);
        }
    }

    function scrollToMessage(msgId) {
        setSearchOpen(false);
        requestAnimationFrame(() => {
            const el = containerRef.current?.querySelector(`[data-msg-id="${msgId}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }

    const mentionMatches = mentionQuery !== null
        ? participants.filter(p => {
            const q = mentionQuery.toLowerCase();
            return !q || p.name.toLowerCase().includes(q);
        }).slice(0, 6)
        : [];

    const items = buildItems(messages, currentEmpId);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <button
                    onClick={onBack}
                    className="mr-1 rounded-xl p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-slate-900 dark:text-slate-100">{task.TITLE}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {task.DEADLINE
                            ? `Due ${fmtDate(task.DEADLINE)}`
                            : task.COST_CENTER
                                ? `CC: ${ccMap.get(task.COST_CENTER) || task.COST_CENTER}`
                                : "No deadline"
                        }
                    </div>
                </div>

                {admin ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {Number(task.FINISHED_COUNT || 0)}/{Number(task.TOTAL_ASSIGNED || 0)} done
                    </span>
                ) : (
                    <StatusBadge status={task.STATUS} />
                )}

                <button
                    onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); setSearchResults([]); }}
                    className={cn(
                        "rounded-xl p-1.5 transition-colors",
                        searchOpen
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    )}
                    title="Search in chat"
                >
                    <Search className="h-4 w-4" />
                </button>

                <button
                    onClick={onOpenTheme}
                    className="rounded-xl p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    title="Chat theme"
                >
                    <Palette className="h-4 w-4" />
                </button>

                <button
                    onClick={() => setInfoOpen(o => !o)}
                    className={cn(
                        "rounded-xl p-1.5 transition-colors",
                        infoOpen
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    )}
                    title="Task details"
                >
                    <Info className="h-4 w-4" />
                </button>
            </div>

            {/* Search panel */}
            <AnimatePresence initial={false}>
                {searchOpen && (
                    <motion.div
                        key="search"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="shrink-0 overflow-hidden border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search in chat…"
                                    className="h-8 w-full rounded-xl bg-slate-100 pl-8 pr-3 text-sm text-slate-900 outline-none dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700">
                                    {searchResults.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => scrollToMessage(r.id)}
                                            className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                        >
                                            <div className="flex w-full items-center justify-between gap-2">
                                                <span className="font-semibold text-indigo-500">{r.sender_name || r.sender_emp_id}</span>
                                                <span className="shrink-0 text-[10px] text-slate-400">{fmtListTime(r.created_at)}</span>
                                            </div>
                                            <div className="line-clamp-2 text-slate-600 dark:text-slate-400">{r.message}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {searchQuery.trim() && searchResults.length === 0 && (
                                <div className="mt-2 text-center text-xs text-slate-400">No results</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pinned message banner */}
            <AnimatePresence initial={false}>
                {pinnedMsg && (
                    <motion.div
                        key="pinned"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="shrink-0 overflow-hidden"
                    >
                        <div className="flex items-center border-b border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20">
                            <button
                                onClick={scrollToPinned}
                                className="flex flex-1 items-center gap-2 px-4 py-2 text-left"
                            >
                                <Pin className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className="truncate text-xs text-amber-800 dark:text-amber-300">
                                    <span className="font-semibold">Pinned: </span>
                                    {pinnedMsg.message?.slice(0, 80)}
                                </span>
                            </button>
                            {admin && (
                                <button
                                    onClick={() => handlePin(pinnedMsg)}
                                    className="mr-3 shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-800/40"
                                    title="Unpin"
                                >
                                    Unpin
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Collapsible task info */}
            <AnimatePresence initial={false}>
                {infoOpen && (
                    <motion.div
                        key="info"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="shrink-0 overflow-hidden border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="p-4">
                            {admin
                                ? <TaskInfoAdmin task={task} ccMap={ccMap} />
                                : <TaskInfoEmployee task={task} ccMap={ccMap} onUpdated={onTaskUpdated} />
                            }
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/50"
                style={{ overscrollBehavior: "contain", ...(theme?.chatBg ? { background: theme.chatBg } : {}) }}
            >
                {msgLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                        <span className="text-4xl">💬</span>
                        <p className="text-sm">No messages yet. Say something!</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1 pt-2">
                        {/* Pagination sentinel */}
                        <div ref={sentinelRef} className="h-1" />
                        {loadingMore && (
                            <div className="py-2 text-center text-xs text-slate-400">Loading older messages…</div>
                        )}
                        {items.map((item, i) =>
                            item.type === "divider" ? (
                                <div key={`d${i}`} className="my-3 flex items-center gap-3">
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                    <span className="rounded-full bg-slate-200 px-3 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                        {item.label}
                                    </span>
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                </div>
                            ) : (
                                <MessageGroup
                                    key={`g${item.msgs[0].id}`}
                                    group={item}
                                    admin={admin}
                                    currentEmpId={currentEmpId}
                                    pinnedMsgId={pinnedMsg?.id}
                                    onEdit={startEdit}
                                    onDelete={deleteMsg}
                                    onReply={handleReply}
                                    onReact={handleReact}
                                    onPin={handlePin}
                                    theme={theme}
                                />
                            )
                        )}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Typing indicator */}
            <AnimatePresence initial={false}>
                {typingUsers.size > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        className="shrink-0 overflow-hidden bg-white dark:bg-slate-900"
                    >
                        <div className="flex items-center gap-1.5 px-4 py-1.5">
                            <div className="flex gap-0.5">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                        className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
                                    />
                                ))}
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                {[...typingUsers.values()].join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing…
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reply banner */}
            <AnimatePresence initial={false}>
                {replyTo && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        className="shrink-0 overflow-hidden border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                        <div className="flex items-center justify-between px-4 py-1.5">
                            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-indigo-500">Reply: </span>
                                {replyTo.preview}
                            </span>
                            <button
                                onClick={() => setReplyTo(null)}
                                className="ml-2 shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit mode banner */}
            <AnimatePresence initial={false}>
                {editingMsg && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        className="shrink-0 overflow-hidden border-t border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
                    >
                        <div className="flex items-center justify-between px-4 py-1.5">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                Editing message
                            </span>
                            <button
                                onClick={cancelEdit}
                                className="rounded p-0.5 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="relative shrink-0 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                {/* Mention dropdown */}
                {mentionQuery !== null && mentionMatches.length > 0 && (
                    <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                        {mentionMatches.map(p => (
                            <button
                                key={p.empId}
                                onMouseDown={e => { e.preventDefault(); insertMention(p); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                                    {(p.name || "?")[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                                <span className="text-xs text-slate-400">({p.empId})</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Format hint */}
                <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 px-1">
                    {[
                        ["Ctrl+B", "Bold"],
                        ["Ctrl+I", "Italic"],
                        ["Ctrl+U", "Underline"],
                        ["Ctrl+⇧+M", "Mono"],
                        ["Ctrl+K", "Link"],
                        ["⇧+Enter", "New line"],
                    ].map(([key, label]) => (
                        <span key={key} className="text-[10px] text-slate-400 dark:text-slate-600">
                            <kbd className="font-mono">{key}</kbd> {label}
                        </span>
                    ))}
                </div>

                <form onSubmit={send} className="flex items-end gap-2">
                    <button
                        type="button"
                        onClick={() => setAttachOpen(true)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        title="Attach"
                    >
                        <Plus className="h-4 w-4" />
                    </button>

                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={text}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Message…"
                        maxLength={2000}
                        className="flex-1 resize-none rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100"
                        style={{ minHeight: "2.5rem", maxHeight: "7.5rem", overflowY: "auto" }}
                    />
                    <button
                        type="submit"
                        disabled={!text.trim()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition disabled:opacity-40 dark:bg-indigo-500"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px] fill-current">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    </button>
                </form>
            </div>

            {/* Attachment modal */}
            <AnimatePresence>
                {attachOpen && (
                    <AttachmentModal
                        onClose={() => setAttachOpen(false)}
                        onSend={msg => {
                            socketRef.current?.emit("chat:send", { taskId, message: msg });
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── AttachmentModal ─────────────────────────────────────────────────────────

const ATTACH_TYPES = [
    { id: "code",  label: "Code",  Icon: Code2,     soon: false },
    { id: "photo", label: "Photo", Icon: Image,     soon: true  },
    { id: "video", label: "Video", Icon: Film,      soon: true  },
    { id: "file",  label: "File",  Icon: FileText,  soon: true  },
];

function AttachmentModal({ onClose, onSend }) {
    const [view, setView] = useState("picker"); // "picker" | "code"
    const [code, setCode] = useState("");
    const codeRef = useRef(null);

    useEffect(() => {
        if (view === "code") requestAnimationFrame(() => codeRef.current?.focus());
    }, [view]);

    function sendCode() {
        const trimmed = code.trim();
        if (!trimmed) return;
        onSend("```\n" + trimmed + "\n```");
        onClose();
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={{   y: 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            >
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <AnimatePresence initial={false}>
                        {view !== "picker" && (
                            <motion.button
                                key="back"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{   opacity: 0, x: -8 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => setView("picker")}
                                className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                    <span className="flex-1 font-extrabold text-slate-900 dark:text-slate-100">
                        {view === "picker" ? "Attach" : "Send Code"}
                    </span>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Screens */}
                <AnimatePresence mode="wait" initial={false}>
                    {view === "picker" ? (
                        <motion.div
                            key="picker"
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{   opacity: 0, x: -16 }}
                            transition={{ duration: 0.15 }}
                            className="grid grid-cols-4 gap-3 p-5"
                        >
                            {ATTACH_TYPES.map((t) => {
                                const TIcon = t.Icon;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => !t.soon && setView(t.id)}
                                        disabled={t.soon}
                                        className={cn(
                                            "relative flex flex-col items-center gap-2.5 rounded-2xl border px-2 py-4 transition",
                                            t.soon
                                                ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50 dark:border-slate-800 dark:bg-slate-800/40"
                                                : "cursor-pointer border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20"
                                        )}
                                    >
                                        <TIcon className={cn(
                                            "h-6 w-6",
                                            t.soon ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"
                                        )} />
                                        <span className={cn(
                                            "text-[11px] font-semibold",
                                            t.soon ? "text-slate-400 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"
                                        )}>
                                            {t.label}
                                        </span>
                                        {t.soon && (
                                            <span className="absolute -right-1 -top-1 rounded-full bg-slate-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white dark:bg-slate-600">
                                                Soon
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="code"
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{   opacity: 0, x: 16 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col gap-3 p-5"
                        >
                            <textarea
                                ref={codeRef}
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="Paste your code here…"
                                className="h-52 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                                onKeyDown={e => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); sendCode(); }
                                    if (e.key === "Escape") onClose();
                                }}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 dark:text-slate-600">Ctrl+Enter to send</span>
                                <Button onClick={sendCode} disabled={!code.trim()}>Send Code</Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>,
        document.body
    );
}

// ─── ThemeModal ───────────────────────────────────────────────────────────────

function ThemeModal({ theme, onClose, onSave }) {
    const [tab,        setTab]        = useState("bg");    // "bg" | "msgs"
    const [localTheme, setLocalTheme] = useState({ ...theme });
    const [saving,     setSaving]     = useState(false);

    function set(key, val) { setLocalTheme(prev => ({ ...prev, [key]: val })); }

    async function save() {
        setSaving(true);
        try { await onSave(localTheme); onClose(); }
        catch (e) { console.error('save theme:', e); }
        finally { setSaving(false); }
    }

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-indigo-500" />
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">Chat Theme</span>
                    </div>
                    <button onClick={onClose} className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    {[{ id: "bg", label: "Background" }, { id: "msgs", label: "Messages" }].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={cn("relative flex-1 py-2.5 text-sm font-semibold transition-colors",
                                tab === t.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            )}>
                            {t.label}
                            {tab === t.id && (
                                <motion.div layoutId="theme-tab-indicator"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-indigo-500" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="max-h-[55vh] overflow-y-auto p-4">
                    <AnimatePresence mode="wait" initial={false}>
                        {tab === "bg" ? (
                            <motion.div key="bg"
                                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                                transition={{ duration: 0.15 }}
                            >
                                <div className="grid grid-cols-3 gap-2">
                                    {CHAT_BG_PRESETS.map(p => (
                                        <button key={p.id} onClick={() => set("chatBg", p.bg)}
                                            className={cn(
                                                "relative overflow-hidden rounded-2xl border-2 transition",
                                                localTheme.chatBg === p.bg
                                                    ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700"
                                                    : "border-slate-200 dark:border-slate-700"
                                            )}
                                        >
                                            <div
                                                className="h-16 w-full"
                                                style={{ background: p.bg || undefined, backgroundColor: p.bg ? undefined : undefined }}
                                            >
                                                {!p.bg && (
                                                    <div className="h-full w-full bg-slate-100 dark:bg-slate-800" />
                                                )}
                                            </div>
                                            <div className="bg-white py-1 text-center text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                                {p.label}
                                            </div>
                                            {localTheme.chatBg === p.bg && (
                                                <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white text-[10px] font-bold">✓</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="msgs"
                                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                                transition={{ duration: 0.15 }}
                                className="space-y-5"
                            >
                                {/* Own messages */}
                                <div>
                                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your Messages</div>
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {OWN_MSG_PRESETS.map(p => (
                                            <button key={p.label}
                                                onClick={() => { set("ownBg", p.bg); set("ownText", p.text); }}
                                                style={{ backgroundColor: p.bg, color: p.text }}
                                                className={cn(
                                                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                                                    localTheme.ownBg === p.bg ? "ring-2 ring-offset-1 ring-indigo-400" : ""
                                                )}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                            Background
                                            <input type="color" value={localTheme.ownBg || '#1e293b'} onChange={e => set("ownBg", e.target.value)}
                                                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                            Text
                                            <input type="color" value={localTheme.ownText || '#ffffff'} onChange={e => set("ownText", e.target.value)}
                                                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                                        </label>
                                        <button onClick={() => { set("ownBg", ""); set("ownText", ""); }}
                                            className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            Reset
                                        </button>
                                    </div>
                                </div>

                                {/* Others' messages */}
                                <div>
                                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Others&apos; Messages</div>
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {OTHERS_MSG_PRESETS.map(p => (
                                            <button key={p.label}
                                                onClick={() => { set("othersBg", p.bg); set("othersText", p.text); }}
                                                style={{ backgroundColor: p.bg, color: p.text, border: '1px solid #e2e8f0' }}
                                                className={cn(
                                                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                                                    localTheme.othersBg === p.bg ? "ring-2 ring-offset-1 ring-indigo-400" : ""
                                                )}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                            Background
                                            <input type="color" value={localTheme.othersBg || '#ffffff'} onChange={e => set("othersBg", e.target.value)}
                                                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                            Text
                                            <input type="color" value={localTheme.othersText || '#0f172a'} onChange={e => set("othersText", e.target.value)}
                                                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                                        </label>
                                        <button onClick={() => { set("othersBg", ""); set("othersText", ""); }}
                                            className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            Reset
                                        </button>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div>
                                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview</div>
                                    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
                                        style={localTheme.chatBg ? { background: localTheme.chatBg } : undefined}>
                                        <div className="flex justify-end">
                                            <div className="max-w-[70%] rounded-2xl px-3 py-2 text-sm"
                                                style={{ backgroundColor: localTheme.ownBg || '#1e293b', color: localTheme.ownText || '#ffffff' }}>
                                                Your message
                                            </div>
                                        </div>
                                        <div className="flex justify-start">
                                            <div className="max-w-[70%] rounded-2xl border px-3 py-2 text-sm"
                                                style={{ backgroundColor: localTheme.othersBg || '#ffffff', color: localTheme.othersText || '#0f172a' }}>
                                                Their message
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Theme"}</Button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}

// ─── InstructionsModal ───────────────────────────────────────────────────────

const INSTRUCTIONS = [
    {
        id: "about",
        title: "Bu sahifa haqida",
        forAdmin: null, // show to everyone
        content: [
            "Bu sahifada siz barcha vazifalarni ko'rishingiz va ular bo'yicha chat yuritishingiz mumkin.",
            "Chap tomonda vazifalar ro'yxati joylashgan. Har bir vazifada oxirgi xabar va o'qilmagan xabarlar soni ko'rsatiladi.",
            "Vazifani bosing — o'ng tomonda chat oynasi ochiladi.",
            "Mobil qurilmada faqat bitta panel ko'rsatiladi; orqaga qaytish uchun ← tugmasini bosing.",
        ],
    },
    {
        id: "change-task",
        title: "Vazifani yangilash (xodim uchun)",
        forAdmin: false,
        content: [
            "Chatni oching va yuqori o'ngdagi ⓘ tugmasini bosing.",
            "Status ro'yxatidan yangi holatni tanlang: Pending, Started, Doing, Finished yoki Failed.",
            "Sarflangan vaqtni soatlarda kiriting (masalan, 1.5 = 1 soat 30 daqiqa).",
            "\"Save Changes\" tugmasini bosib saqlang.",
        ],
    },
    {
        id: "add-task",
        title: "Vazifa qo'shish (admin uchun)",
        forAdmin: true,
        content: [
            "Chap paneldagi + tugmasini bosing.",
            "Sarlavha (majburiy), tavsif, cost center va muddatni kiriting.",
            "Xodimlarni qidiring va belgilang — bir nechta xodim tanlash mumkin.",
            "\"Create Task\" tugmasini bosib saqlang. Vazifa darhol ro'yxatda paydo bo'ladi.",
        ],
    },
    {
        id: "send-code",
        title: "Kod yuborish",
        forAdmin: null,
        content: [
            "Xabar kiritish maydonining chap tomonidagi + tugmasini bosing.",
            "Ochilgan oynada \"Code\" katagini tanlang.",
            "Kodni matn maydoniga joylashtiring (paste) va \"Send Code\" tugmasini bosing.",
            "Tez yuborish uchun Ctrl+Enter klavishlaridan foydalaning.",
            "Inline kod uchun xabarda bitta backtick ishlatiladi: `SELECT * FROM \"OITM\"`",
        ],
    },
];

const SHORTCUTS = [
    { keys: ["Enter"],           desc: "Xabar yuborish" },
    { keys: ["Shift", "Enter"],  desc: "Yangi qator" },
    { keys: ["↑"],               desc: "Oxirgi xabarni tahrirlash (kiritish bo'sh bo'lsa)" },
    { keys: ["Esc"],             desc: "Tahrirlashni bekor qilish yoki chatni yopish" },
    { keys: ["Ctrl", "B"],       desc: "Qalin matn  →  **matn**" },
    { keys: ["Ctrl", "I"],       desc: "Kursiv matn  →  *matn*" },
    { keys: ["Ctrl", "U"],       desc: "Tagiga chiziq  →  __matn__" },
    { keys: ["Ctrl", "⇧", "M"],  desc: "Monospace  →  `kod`" },
    { keys: ["Ctrl", "K"],       desc: "Havola  →  [matn](url)" },
    { keys: ["Ctrl", "Enter"],   desc: "Kodni yuborish (kod oynasida)" },
];

function InstructionItem({ item }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                            <ol className="space-y-2">
                                {item.content.map((line, i) =>
                                    line.startsWith("```") ? (
                                        <li key={i}>
                                            <pre className="overflow-x-auto rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                {line.replace(/^```\w*\n?/, "").replace(/\n?```$/, "")}
                                            </pre>
                                        </li>
                                    ) : (
                                        <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                                                {i + 1}
                                            </span>
                                            <span>{line}</span>
                                        </li>
                                    )
                                )}
                            </ol>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function InstructionsModal({ onClose, admin }) {
    const [tab, setTab] = useState("guide"); // "guide" | "keys"
    const visible = INSTRUCTIONS.filter(item =>
        item.forAdmin === null || item.forAdmin === admin
    );
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 p-0 sm:p-4">
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-indigo-500" />
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">Yordam</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    {[
                        { id: "guide", label: "Yo'riqnoma" },
                        { id: "keys",  label: "Klavishlar" },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "relative flex-1 py-2.5 text-sm font-semibold transition-colors",
                                tab === t.id
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                            )}
                        >
                            {t.label}
                            {tab === t.id && (
                                <motion.div
                                    layoutId="help-tab-indicator"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-indigo-500"
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait" initial={false}>
                    {tab === "guide" ? (
                        <motion.div
                            key="guide"
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{   opacity: 0, x: -12 }}
                            transition={{ duration: 0.15 }}
                            className="max-h-[60vh] overflow-y-auto p-4 space-y-2"
                        >
                            {visible.map(item => (
                                <InstructionItem key={item.id} item={item} />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="keys"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{   opacity: 0, x: 12 }}
                            transition={{ duration: 0.15 }}
                            className="max-h-[60vh] overflow-y-auto p-4"
                        >
                            <div className="space-y-1">
                                {SHORTCUTS.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{s.desc}</span>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {s.keys.map((k, ki) => (
                                                <React.Fragment key={ki}>
                                                    <kbd className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        {k}
                                                    </kbd>
                                                    {ki < s.keys.length - 1 && (
                                                        <span className="text-[10px] text-slate-400">+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>,
        document.body
    );
}

// ─── CreateTaskModal ──────────────────────────────────────────────────────────

function lockScroll() {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
}

function CreateTaskModal({ onClose, onCreated }) {
    const toast = useToast();
    const [title,       setTitle]       = useState("");
    const [description, setDescription] = useState("");
    const [costCenter,  setCostCenter]  = useState("");
    const [deadline,    setDeadline]    = useState("");
    const [users,       setUsers]       = useState([]);
    const [costCenters, setCostCenters] = useState([]);
    const [selectedEmpIds, setSelectedEmpIds] = useState([]);
    const [search,  setSearch]  = useState("");
    const [saving,  setSaving]  = useState(false);

    useEffect(lockScroll, []);

    useEffect(() => {
        api.get("/users?limit=200").then(r => setUsers(r.data.items || [])).catch(() => {});
        api.get("/hana/cost-centers").then(r => setCostCenters(r.data.items || [])).catch(() => {});
    }, []);

    function toggleEmp(empId) {
        const id = String(empId);
        setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
    }

    const filteredUsers = users.filter(u => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return String(u.EmpID).includes(q) || (u.FirstName || "").toLowerCase().includes(q) || (u.LastName || "").toLowerCase().includes(q);
    });

    async function submit() {
        if (!title.trim())        return toast.error("Title is required");
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

    const SELECT_CLS = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600";

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
                <div className="flex items-center justify-between">
                    <div className="text-lg font-extrabold dark:text-slate-100">New Task</div>
                    <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">✖</button>
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
                            placeholder="Optional description…"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">Cost Center</div>
                            <select className={SELECT_CLS} value={costCenter} onChange={e => setCostCenter(e.target.value)}>
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
                        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                            {filteredUsers.length === 0 ? (
                                <div className="py-3 text-center text-sm text-slate-500">No users found</div>
                            ) : filteredUsers.map(u => {
                                const id      = String(u.EmpID);
                                const checked = selectedEmpIds.includes(id);
                                return (
                                    <label
                                        key={id}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800",
                                            checked && "bg-slate-50 dark:bg-slate-800"
                                        )}
                                    >
                                        <input type="checkbox" checked={checked} onChange={() => toggleEmp(id)} className="rounded" />
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{u.FirstName} {u.LastName}</span>
                                        <span className="text-slate-500">({u.EmpID})</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create Task"}</Button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Main Tasks component ─────────────────────────────────────────────────────

export default function Tasks() {
    const toast        = useToast();
    const toastRef     = useRef(toast);
    toastRef.current   = toast;

    const admin        = isAdmin();
    const currentEmpId = getEmpId();

    const [tasks,       setTasks]       = useState([]);
    const [summaries,   setSummaries]   = useState(new Map()); // taskId -> {last_message, unread_count}
    const [loading,     setLoading]     = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [chatOpen,    setChatOpen]    = useState(false);     // mobile: show chat panel
    const [search,      setSearch]      = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [createOpen,  setCreateOpen]  = useState(false);
    const [helpOpen,    setHelpOpen]    = useState(false);
    const [themeOpen,   setThemeOpen]   = useState(false);
    const [ccMap,       setCcMap]       = useState(new Map());
    const [theme,       setTheme]       = useState({ ownBg: '', ownText: '', othersBg: '', othersText: '', chatBg: '' });

    const selectedTaskIdRef = useRef(null);

    // Load tasks + chat summaries together
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [tasksRes, summaryRes] = await Promise.all([
                api.get("/tasks"),
                api.get("/tasks/chat-summary"),
            ]);
            setTasks(tasksRes.data.items || []);
            const map = new Map();
            for (const s of summaryRes.data.items || []) {
                map.set(Number(s.task_id), s);
            }
            setSummaries(map);
        } catch (e) {
            toastRef.current.error(e?.response?.data?.error || "Failed to load tasks");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    useEffect(() => {
        api.get("/user/chat-theme")
            .then(r => {
                if (r.data.theme) {
                    const t = r.data.theme;
                    setTheme({ ownBg: t.own_bg || '', ownText: t.own_text || '', othersBg: t.others_bg || '', othersText: t.others_text || '', chatBg: t.chat_bg || '' });
                }
            })
            .catch(() => {});
    }, []);

    async function saveTheme(newTheme) {
        await api.patch("/user/chat-theme", newTheme);
        setTheme(newTheme);
    }

    useEffect(() => {
        api.get("/hana/cost-centers")
            .then(r => setCcMap(new Map((r.data.items || []).map(c => [c.code, c.name]))))
            .catch(() => {});
    }, []);

    // Socket: subscribe to all task rooms, handle incoming messages for unread badges
    useEffect(() => {
        const socket = getSocket();
        socket.emit("chat:subscribe-all");

        function onMessage(msg) {
            const tid = Number(msg.task_id);
            setSummaries(prev => {
                const next = new Map(prev);
                const s    = next.get(tid) || { last_message: null, unread_count: 0 };
                next.set(tid, {
                    last_message:  msg,
                    unread_count:  tid === selectedTaskIdRef.current ? 0 : s.unread_count + 1,
                });
                return next;
            });
        }

        socket.on("chat:message", onMessage);
        return () => socket.off("chat:message", onMessage);
    }, []);

    function selectTask(task) {
        const tid = Number(task.TASK_ID);
        setSelectedTask(task);
        setChatOpen(true);
        selectedTaskIdRef.current = tid;

        // Mark as read locally + server
        setSummaries(prev => {
            const next = new Map(prev);
            const s    = next.get(tid) || {};
            next.set(tid, { ...s, unread_count: 0 });
            return next;
        });
        api.patch(`/tasks/${tid}/chat/read`).catch(() => {});
    }

    function handleTaskUpdated(updated) {
        setTasks(prev => prev.map(t => t.ASSIGNMENT_ID === updated.ASSIGNMENT_ID ? { ...t, ...updated } : t));
        setSelectedTask(prev => prev ? { ...prev, ...updated } : prev);
    }

    const filtered = tasks.filter(t => {
        if (search.trim() && !t.TITLE.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter !== "all") {
            const s = admin ? adminCardStatus(t) : (t.STATUS || "pending");
            if (s !== statusFilter) return false;
        }
        return true;
    });

    // Total unread across all tasks (for the tab badge — future use)
    // const totalUnread = [...summaries.values()].reduce((s, v) => s + (v.unread_count || 0), 0);

    return (
        <div
            className="flex overflow-hidden bg-white dark:bg-slate-900"
            style={{ height: "calc(100dvh - 9.5rem - env(safe-area-inset-bottom))" }}
        >
            {/* ── Left panel: task list ── */}
            <div className={cn(
                "flex w-full shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 md:w-80",
                chatOpen ? "hidden md:flex" : "flex"
            )}>
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {admin ? "All Tasks" : "My Tasks"}
                    </h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setHelpOpen(true)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                            title="Yo'riqnoma"
                        >
                            <HelpCircle className="h-4 w-4" />
                        </button>
                        {admin && (
                            <button
                                onClick={() => setCreateOpen(true)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search + filter */}
                <div className="shrink-0 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search tasks…"
                            className="h-8 w-full rounded-xl bg-slate-100 pl-8 pr-3 text-sm text-slate-900 outline-none dark:bg-slate-800 dark:text-slate-100"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="h-7 w-full rounded-lg bg-slate-100 px-2 text-xs text-slate-700 outline-none dark:bg-slate-800 dark:text-slate-300"
                    >
                        <option value="all">All statuses</option>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>

                {/* Task rows */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex h-32 items-center justify-center text-sm text-slate-400">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-slate-400">No tasks</div>
                    ) : filtered.map(task => (
                        <TaskItem
                            key={admin ? task.TASK_ID : task.ASSIGNMENT_ID}
                            task={task}
                            summary={summaries.get(Number(task.TASK_ID))}
                            isSelected={selectedTask?.TASK_ID === task.TASK_ID}
                            onClick={() => selectTask(task)}
                            admin={admin}
                            ccMap={ccMap}
                        />
                    ))}
                </div>
            </div>

            {/* ── Right panel: chat ── */}
            <div className={cn(
                "min-w-0 flex-1 flex-col",
                chatOpen || selectedTask ? "flex" : "hidden md:flex"
            )}>
                {selectedTask ? (
                    <ChatView
                        task={selectedTask}
                        admin={admin}
                        currentEmpId={currentEmpId}
                        ccMap={ccMap}
                        onBack={() => { setChatOpen(false); setSelectedTask(null); selectedTaskIdRef.current = null; }}
                        onTaskUpdated={handleTaskUpdated}
                        theme={theme}
                        onOpenTheme={() => setThemeOpen(true)}
                    />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
                        <span className="text-5xl">💬</span>
                        <p className="text-sm font-semibold">Select a task to start chatting</p>
                    </div>
                )}
            </div>

            {/* Create task modal */}
            {createOpen && (
                <CreateTaskModal
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => { setCreateOpen(false); loadAll(); }}
                />
            )}

            {/* Instructions modal */}
            <AnimatePresence>
                {helpOpen && (
                    <InstructionsModal onClose={() => setHelpOpen(false)} admin={admin} />
                )}
            </AnimatePresence>

            {/* Theme modal */}
            <AnimatePresence>
                {themeOpen && (
                    <ThemeModal
                        theme={theme}
                        onClose={() => setThemeOpen(false)}
                        onSave={saveTheme}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
