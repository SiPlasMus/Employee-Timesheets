import { useId } from "react";
import { motion } from "framer-motion";

/**
 * Renders a short glowing stroke that travels around the border of its
 * nearest `position:relative` ancestor. Blocks are sequenced by index/total:
 *   delay        = index * duration
 *   repeatDelay  = (total - 1) * duration
 * So only one block is "active" at a time and the stroke visually passes
 * from block to block on every cycle.
 */
export default function BorderTracer({
    index = 0,
    total = 1,
    duration = 2.4,
    color = "#818cf8",
    rx = 14,
    strokeWidth = 1.5,
}) {
    const uid = useId();
    const inset = strokeWidth / 2 + 1.5;
    const delay = index * duration;
    const repeatDelay = Math.max(0, (total - 1) * duration);

    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            width="100%"
            height="100%"
            style={{ overflow: "visible" }}
        >
            <defs>
                <filter id={`bt-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <motion.rect
                x={inset}
                y={inset}
                rx={rx}
                ry={rx}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                filter={`url(#bt-${uid})`}
                style={{
                    width: `calc(100% - ${inset * 2}px)`,
                    height: `calc(100% - ${inset * 2}px)`,
                }}
                initial={{ pathLength: 0.1, pathOffset: 0 }}
                animate={{ pathOffset: [0, 1] }}
                transition={{
                    pathOffset: {
                        delay,
                        duration,
                        ease: "linear",
                        repeat: Infinity,
                        repeatDelay,
                    },
                }}
            />
        </svg>
    );
}
