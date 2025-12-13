import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { setToken } from "../auth";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { Card, CardHeader, CardContent } from "../ui/Card";

export default function Login() {
    const [empId, setEmpId] = useState("");
    const [pin, setPin] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const nav = useNavigate();
    const loc = useLocation();
    const from = loc.state?.from || "/timesheet";

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            const r = await api.post("/auth/login", { empId, pin });
            if (r.data?.token) {
                setToken(r.data.token);
                localStorage.setItem("et_empId", String(empId));
                nav(from, { replace: true });
            } else {
                setErr("No token from server");
            }
        } catch (e) {
            console.log("LOGIN ERR", e);
            console.log("RESP", e?.response);
            setErr(e?.response?.data?.error || e.message || "Network error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-[70vh] px-4 pt-10 pb-48">
            <div className="mx-auto max-w-sm">
                <Card>
                    <CardHeader>
                        <div className="text-xl font-extrabold">Employee Timesheets</div>
                        <div className="text-sm text-slate-500">Login with EmpID and PIN</div>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={onSubmit} className="grid gap-3">
                            <Input placeholder="EmpID" value={empId} onChange={(e) => setEmpId(e.target.value)} />
                            <Input placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
                            <Button disabled={loading}>{loading ? "Logging in..." : "Login"}</Button>
                            {err && <div className="text-sm font-semibold text-rose-600">{err}</div>}
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
