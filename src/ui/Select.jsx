import React from "react";
import { cn } from "./ui";

export default function Select({ className, ...props }) {
    return (
        <select
            className={cn(
                "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 " +
                "text-slate-900 outline-none focus:ring-2 focus:ring-slate-300",
                className
            )}
            {...props}
        />
    );
}
