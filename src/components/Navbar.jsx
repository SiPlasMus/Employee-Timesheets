import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { cn } from "../ui/ui";
import { clearToken, isAuthed } from "../auth";

export default function Navbar() {
    const nav = useNavigate();
    if (!isAuthed()) return null;

    const linkClass = ({ isActive }) =>
        cn(
            "px-3 py-2 rounded-xl text-sm font-semibold",
            isActive
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
        );

    return (
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-2 p-3">
                <div className="font-extrabold text-slate-900">ET</div>

                <nav className="flex gap-1">
                    <NavLink to="/timesheet" className={linkClass}>Timesheet</NavLink>
                    <NavLink to="/add" className={linkClass}>Add</NavLink>
                    <NavLink to="/analysis" className={linkClass}>Analysis</NavLink>
                    <NavLink to="/profile" className={linkClass}>Profile</NavLink>
                </nav>

                <div className="ml-auto">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            clearToken();
                            nav("/login");
                        }}
                    >
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
}
