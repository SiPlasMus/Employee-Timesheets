import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, PlusCircle, User } from "lucide-react";
import { cn } from "../ui/ui";
import { clearToken, isAuthed } from "../auth";

function TabLink({ to, label, Icon }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition",
                    isActive
                        ? "text-slate-900"
                        : "text-slate-500 hover:text-slate-800"
                )
            }
        >
            {({ isActive }) => (
                <>
                    <div
                        className={cn(
                            "grid h-10 w-10 place-items-center rounded-2xl border",
                            isActive
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                : "bg-white/80 text-slate-700 border-slate-200"
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

export default function Navbar() {
    const nav = useNavigate();
    if (!isAuthed()) return null;

    return (
        <>
            {/* Optional small top header (can remove if you want) */}
            <div className="sticky top-5 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
                    <div className="font-extrabold text-slate-900">ET</div>
                    <div className="ml-auto">
                        <button
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                                clearToken();
                                nav("/login");
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Tabs */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur border-t border-slate-200">
                {/* Tabs */}
                <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 py-2">
                    <TabLink to="/timesheet" label="Timesheet" Icon={CalendarDays} />
                    <TabLink to="/add" label="Add" Icon={PlusCircle} />
                    <TabLink to="/analysis" label="Analysis" Icon={BarChart3} />
                    <TabLink to="/profile" label="Profile" Icon={User} />
                </div>

                {/* Safe area fill (iOS home indicator etc.) */}
                <div className="h-[env(safe-area-inset-bottom)] bg-white/80" />
            </div>
        </>
    );
}
