import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, Moon, PlusCircle, Sun, User } from "lucide-react";
import { cn } from "../ui/ui";
import { clearToken, isAuthed } from "../auth";
import { useTheme } from "../hooks/useTheme";

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

export default function Navbar() {
    const nav = useNavigate();
    const { theme, toggle } = useTheme();

    if (!isAuthed()) return null;

    return (
        <>
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
                <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100">ET</div>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={toggle}
                            aria-label="Toggle theme"
                        >
                            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>
                        <button
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur border-t border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 py-2">
                    <TabLink to="/timesheet" label="Timesheet" Icon={CalendarDays} />
                    <TabLink to="/add" label="Add" Icon={PlusCircle} />
                    <TabLink to="/analysis" label="Analysis" Icon={BarChart3} />
                    <TabLink to="/profile" label="Profile" Icon={User} />
                </div>

                {/* Safe area fill (iOS home indicator etc.) */}
                <div className="h-[env(safe-area-inset-bottom)] bg-white/80 dark:bg-slate-900/80" />
            </div>
        </>
    );
}
