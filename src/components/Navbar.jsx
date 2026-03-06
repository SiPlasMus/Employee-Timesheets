import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, Bell, CalendarDays, ClipboardList, Moon, PlusCircle, ShieldCheck, Sun, User } from "lucide-react";
import { cn } from "../ui/ui";
import { clearToken, isAdmin, isAuthed } from "../auth";
import { useTheme } from "../hooks/useTheme";
import { api } from "../api";

function TabLink({ to, label, Icon }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition",
                    isActive
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )
            }
        >
            {({ isActive }) => (
                <>
                    <div
                        className={cn(
                            "grid h-10 w-10 place-items-center rounded-2xl border",
                            isActive
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                                : "bg-white/80 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
                        )}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="leading-none">{label}</div>
                </>
            )}
        </NavLink>
    );
}

function fmtNotifTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
}

export default function Navbar() {
    const nav = useNavigate();
    const { theme, toggle } = useTheme();
    const admin = isAdmin();

    const [unreadCount, setUnreadCount] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const [bellPos, setBellPos] = useState(null);
    const [ccMap, setCcMap] = useState(new Map());
    const bellRef = useRef(null);
    const dropdownRef = useRef(null);

    // Poll unread count every 30 s so the badge updates without a page refresh
    useEffect(() => {
        if (!isAuthed()) return;
        const poll = () => {
            api.get("/notifications/unread-count")
                .then(r => setUnreadCount(r.data.count || 0))
                .catch(() => {});
        };
        poll();
        const id = setInterval(poll, 30000);
        return () => clearInterval(id);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        if (!notifOpen) return;
        function handleClick(e) {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                bellRef.current && !bellRef.current.contains(e.target)
            ) {
                setNotifOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [notifOpen]);

    function openBell() {
        if (notifOpen) { setNotifOpen(false); return; }
        const rect = bellRef.current?.getBoundingClientRect();
        if (rect) setBellPos({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left });
        setNotifOpen(true);
        setNotifLoading(true);

        const fetches = [api.get("/notifications")];
        if (ccMap.size === 0) fetches.push(api.get("/hana/cost-centers"));

        Promise.all(fetches).then(([notifRes, ccRes]) => {
            const items = notifRes.data.items || [];
            setNotifications(items);
            setUnreadCount(items.filter(n => !n.IS_READ).length);
            if (ccRes) {
                setCcMap(new Map((ccRes.data.items || []).map(c => [c.code, c.name])));
            }
        }).catch(() => {}).finally(() => setNotifLoading(false));
    }

    function markRead(notifId, isRead) {
        if (isRead) return;
        api.patch(`/notifications/${notifId}/read`).then(() => {
            setNotifications(prev => prev.map(n =>
                Number(n.NOTIFICATION_ID) === notifId ? { ...n, IS_READ: 1 } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }).catch(() => {});
    }

    function markAllRead() {
        api.patch("/notifications/read-all").then(() => {
            setNotifications(prev => prev.map(n => ({ ...n, IS_READ: 1 })));
            setUnreadCount(0);
        }).catch(() => {});
    }

    if (!isAuthed()) return null;

    return (
        <>
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
                <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100">ET</div>
                    <div className="ml-auto flex items-center gap-2">
                        {/* Notification Bell */}
                        <button
                            ref={bellRef}
                            className="relative rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={openBell}
                            aria-label="Notifications"
                        >
                            <Bell className="h-4 w-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Theme toggle */}
                        <button
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={toggle}
                            aria-label="Toggle theme"
                        >
                            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        <button
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={() => { clearToken(); nav("/login"); }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification dropdown portal */}
            {notifOpen && bellPos && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: "fixed",
                        top: bellPos.bottom + 8,
                        left: Math.max(8, Math.min(bellPos.right - 320, window.innerWidth - 328)),
                        zIndex: 100,
                    }}
                    className="w-80 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Notifications</div>
                        {notifications.some(n => !n.IS_READ) && (
                            <button
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                onClick={markAllRead}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto">
                        {notifLoading ? (
                            <div className="py-6 text-center text-sm text-slate-500">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="py-6 text-center text-sm text-slate-500">No notifications</div>
                        ) : (
                            notifications.map(n => (
                                <button
                                    key={n.NOTIFICATION_ID}
                                    onClick={() => markRead(Number(n.NOTIFICATION_ID), n.IS_READ)}
                                    className={cn(
                                        "w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800",
                                        !n.IS_READ && "bg-blue-50/60 dark:bg-blue-950/30"
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.IS_READ && (
                                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                        )}
                                        <div className={cn("flex-1", n.IS_READ && "pl-4")}>
                                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{n.TITLE}</div>
                                            {n.MESSAGE && (
                                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.MESSAGE}</div>
                                            )}
                                            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400 dark:text-slate-500">
                                                <span>{fmtNotifTime(n.CREATED_AT)}</span>
                                                {n.COST_CENTER && <span>CC: {ccMap.get(n.COST_CENTER) || n.COST_CENTER}</span>}
                                                {n.DEADLINE && <span>Due: {String(n.DEADLINE).slice(0, 10)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Bottom Tabs */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur border-t border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                <div className={cn("mx-auto gap-1 px-2 py-2 grid max-w-3xl", admin ? "grid-cols-2" : "grid-cols-5")}>
                    {admin ? (
                        <>
                            <TabLink to="/admin" label="Admin" Icon={ShieldCheck} />
                            <TabLink to="/tasks" label="Tasks" Icon={ClipboardList} />
                        </>
                    ) : (
                        <>
                            <TabLink to="/timesheet" label="Timesheet" Icon={CalendarDays} />
                            <TabLink to="/tasks" label="Tasks" Icon={ClipboardList} />
                            <TabLink to="/add" label="Add" Icon={PlusCircle} />
                            <TabLink to="/analysis" label="Analysis" Icon={BarChart3} />
                            <TabLink to="/profile" label="Profile" Icon={User} />
                        </>
                    )}
                </div>

                {/* Safe area fill */}
                <div className="h-[env(safe-area-inset-bottom)] bg-white/80 dark:bg-slate-900/80" />
            </div>
        </>
    );
}
