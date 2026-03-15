import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../ui/ui";

const ToastCtx = createContext(null);

const CONFIG = {
    success: { icon: "✓", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    error:   { icon: "✕", bar: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400" },
    info:    { icon: "ℹ", bar: "bg-indigo-500",  text: "text-indigo-600 dark:text-indigo-400" },
    warning: { icon: "⚠", bar: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
};

function ToastItem({ t, onRemove }) {
    const cfg = CONFIG[t.type] || CONFIG.info;
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 80, scale: 0.93 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit={{    opacity: 0, x: 80, scale: 0.93, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden
                       rounded-2xl border border-slate-200 bg-white shadow-xl
                       dark:border-slate-700 dark:bg-slate-900"
        >
            {/* colour bar */}
            <div className={cn("w-1 self-stretch shrink-0 rounded-l-2xl", cfg.bar)} />

            {/* icon */}
            <div className={cn("mt-3 text-base font-bold shrink-0", cfg.text)}>
                {cfg.icon}
            </div>

            {/* message */}
            <div className="flex-1 py-3 pr-1 text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                {t.message}
            </div>

            {/* dismiss */}
            <button
                onClick={() => onRemove(t.id)}
                className="mr-3 mt-3 shrink-0 text-slate-400 hover:text-slate-700
                           dark:text-slate-500 dark:hover:text-slate-200 text-xs font-bold"
            >
                ✕
            </button>
        </motion.div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    const remove = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        clearTimeout(timers.current[id]);
        delete timers.current[id];
    }, []);

    const push = useCallback((message, type = "info", duration = 4500) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev.slice(-3), { id, message, type }]);
        timers.current[id] = setTimeout(() => remove(id), duration);
    }, [remove]);

    const toast = React.useMemo(() => ({
        success: (msg, dur)  => push(msg, "success", dur),
        error:   (msg, dur)  => push(msg, "error",   dur ?? 6000),
        info:    (msg, dur)  => push(msg, "info",    dur),
        warning: (msg, dur)  => push(msg, "warning", dur),
    }), [push]);

    return (
        <ToastCtx.Provider value={toast}>
            {children}
            {createPortal(
                <div className="fixed bottom-24 right-3 z-[300] flex flex-col-reverse gap-2 items-end">
                    <AnimatePresence initial={false}>
                        {toasts.map(t => (
                            <ToastItem key={t.id} t={t} onRemove={remove} />
                        ))}
                    </AnimatePresence>
                </div>,
                document.body
            )}
        </ToastCtx.Provider>
    );
}

export function useToast() {
    return useContext(ToastCtx);
}
