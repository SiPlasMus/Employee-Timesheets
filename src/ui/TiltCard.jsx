import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export default function TiltCard({ children, className, maxAngle = 8 }) {
    const ref = useRef(null);
    const rawX = useMotionValue(0);
    const rawY = useMotionValue(0);
    const springX = useSpring(rawX, { stiffness: 120, damping: 28 });
    const springY = useSpring(rawY, { stiffness: 120, damping: 28 });
    const rotateX = useTransform(springY, [-0.5, 0.5], [maxAngle, -maxAngle]);
    const rotateY = useTransform(springX, [-0.5, 0.5], [-maxAngle, maxAngle]);

    function onMouseMove(e) {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        rawX.set((e.clientX - rect.left) / rect.width - 0.5);
        rawY.set((e.clientY - rect.top) / rect.height - 0.5);
    }
    function onMouseLeave() {
        rawX.set(0);
        rawY.set(0);
    }

    return (
        <motion.div
            ref={ref}
            style={{ rotateX, rotateY, transformPerspective: 900 }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className={className}
        >
            {children}
        </motion.div>
    );
}
