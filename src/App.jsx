import React, { useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Login from "./pages/Login";
import Analysis from "./pages/Analysis";
import Timesheet from "./pages/Timesheet";
import AddLine from "./pages/AddLine";
import Profile from "./pages/Profile";
import ProtectedRoute, { AdminRoute } from "./components/ProtectedRoute";
import Admin from "./pages/Admin";
import Navbar from "./components/Navbar";

const PAGE_ORDER = {
    "/login": -1,
    "/timesheet": 0,
    "/add": 1,
    "/analysis": 2,
    "/admin": 3,
    "/profile": 4,
};

const variants = {
    initial: (dir) => ({
        x: dir >= 0 ? "100%" : "-100%",
        opacity: 0,
    }),
    animate: {
        x: 0,
        opacity: 1,
        transition: { type: "tween", ease: "easeOut", duration: 0.22 },
    },
    exit: (dir) => ({
        x: dir >= 0 ? "-35%" : "35%",
        opacity: 0,
        transition: { type: "tween", ease: "easeIn", duration: 0.18 },
    }),
};

// Freeze the matched route at mount so the exiting page
// doesn't jump to the new route's content during its exit animation.
function FrozenRoutes({ location }) {
    const [frozenLoc] = React.useState(location);
    return (
        <Routes location={frozenLoc}>
            <Route path="/login" element={<Login />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Navigate to="/timesheet" replace />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/timesheet"
                element={
                    <ProtectedRoute>
                        <Timesheet />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/add"
                element={
                    <ProtectedRoute>
                        <AddLine />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/analysis"
                element={
                    <ProtectedRoute>
                        <Analysis />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin"
                element={
                    <AdminRoute>
                        <Admin />
                    </AdminRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/timesheet" replace />} />
        </Routes>
    );
}

export default function App() {
    const location = useLocation();
    const prevPathRef = useRef(location.pathname);
    const dirRef = useRef(0);

    // Compute slide direction synchronously before render
    if (prevPathRef.current !== location.pathname) {
        const prev = PAGE_ORDER[prevPathRef.current] ?? 0;
        const curr = PAGE_ORDER[location.pathname] ?? 0;
        dirRef.current = curr >= prev ? 1 : -1;
        prevPathRef.current = location.pathname;
    }

    return (
        <>
            <Navbar />
            <div className="overflow-x-hidden">
                <AnimatePresence mode="wait" custom={dirRef.current}>
                    <motion.div
                        key={location.pathname}
                        custom={dirRef.current}
                        variants={variants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <FrozenRoutes location={location} />
                    </motion.div>
                </AnimatePresence>
            </div>
        </>
    );
}
