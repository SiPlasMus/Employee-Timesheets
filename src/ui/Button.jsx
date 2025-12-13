import React from "react";
import { cn } from "./ui";

export default function Button({
                                   className,
                                   variant = "primary",
                                   size = "md",
                                   ...props
                               }) {
    const base =
        "inline-flex items-center justify-center rounded-xl font-semibold " +
        "transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-slate-900 text-white hover:bg-slate-800",
        secondary: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-900 hover:bg-slate-100",
        danger: "bg-rose-600 text-white hover:bg-rose-500",
    };

    const sizes = {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-12 px-5 text-base",
    };

    return (
        <button
            className={cn(base, variants[variant], sizes[size], className)}
            {...props}
        />
    );
}
