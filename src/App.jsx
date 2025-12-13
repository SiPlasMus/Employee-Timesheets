import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Analysis from "./pages/Analysis";
import Timesheet from "./pages/Timesheet";
import AddLine from "./pages/AddLine";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

export default function App() {
    return (
        <>
            <Navbar />
            <Routes>
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
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/timesheet" replace />} />
            </Routes>
        </>
    );
}
