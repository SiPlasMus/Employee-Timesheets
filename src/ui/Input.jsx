import React from "react";
import { cn } from "./ui";

export default function Input({ className, ...props }) {
    return (
        <input
            className={cn(
                "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 " +
                "text-slate-900 placeholder:text-slate-400 outline-none " +
                "focus:ring-2 focus:ring-slate-300",
                className
            )}
            {...props}
        />
    );
}
