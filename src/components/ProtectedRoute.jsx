import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed, isAdmin } from "../auth";

export default function ProtectedRoute({ children }) {
    const loc = useLocation();
    if (!isAuthed()) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
    return children;
}

export function AdminRoute({ children }) {
    const loc = useLocation();
    if (!isAuthed()) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
    if (!isAdmin()) return <Navigate to="/timesheet" replace />;
    return children;
}
