import React from "react";
import { cn } from "./ui";

export default function Badge({ className, variant = "default", ...props }) {
    const variants = {
        default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        bad: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    };

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                variants[variant],
                className
            )}
            {...props}
        />
    );
}
