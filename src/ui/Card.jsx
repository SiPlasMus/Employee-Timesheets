import React from "react";
import { cn } from "./ui";

export function Card({ className, ...props }) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-slate-200 bg-white shadow-sm " +
                "dark:border-slate-700 dark:bg-slate-900",
                className
            )}
            {...props}
        />
    );
}
export function CardHeader({ className, ...props }) {
    return <div className={cn("p-4 pb-2", className)} {...props} />;
}
export function CardContent({ className, ...props }) {
    return <div className={cn("p-4 pt-2", className)} {...props} />;
}
