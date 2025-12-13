import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Card, CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input.jsx"

function dash(v) {
    const s = String(v ?? "").trim();
    return s ? s : "—";
}

export default function Profile({ onLogout }) {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [me, setMe] = useState(null);

    const [showPin, setShowPin] = useState(false);
    const [oldPin, setOldPin] = useState("");
    const [newPin, setNewPin] = useState("");
    const [savingPin, setSavingPin] = useState(false);
    const [pinMsg, setPinMsg] = useState("");

    async function load() {
        setErr("");
        setLoading(true);
        try {
            const r = await api.get("/me");
            setMe(r.data?.item || null)
        } catch (e) {
            setErr(e?.response?.data?.error || e.message);
            setMe(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function changePin() {
        setPinMsg("");
        const o = String(oldPin || "").trim();
        const n = String(newPin || "").trim();

        if (n.length < 4) return setPinMsg("New PIN must be at least 4 characters.");
        if (!o) return setPinMsg("Enter old PIN.");

        setSavingPin(true);
        try {
            await api.post("/auth/change-pin", { oldPin: o, newPin: n });
            setPinMsg("✅ PIN changed successfully.");
            setOldPin("");
            setNewPin("");
            // close after success (optional)
            setTimeout(() => setShowPin(false), 600);
        } catch (e) {
            setPinMsg(e?.response?.data?.error || e.message || "Error");
        } finally {
            setSavingPin(false);
        }
    }

    const fullName = useMemo(() => {
        const fn = me?.FirstName;
        const ln = me?.LastName;
        return [fn, ln].filter(Boolean).join(" ");
    }, [me]);

    // We ONLY show OHEM-ish fields + EmpID. No token, no IsActive/MustChange.
    const rows = useMemo(() => {
        return [
            { label: "Employee ID", value: dash(me?.EmpID) },
            { label: "Job title", value: dash(me?.JobTitle) },
            { label: "Department", value: dash(me?.Department) },
            { label: "Email", value: dash(me?.Email) },
            { label: "Mobile", value: dash(me?.Mobile) },
        ];
    }, [me]);

    return (
        <div className="mx-auto max-w-3xl px-4 py-4 pb-48">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xl font-extrabold">Profile</div>
                            <div className="text-sm text-slate-500">Employee information</div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={load} disabled={loading}>
                                {loading ? "Loading..." : "Refresh"}
                            </Button>
                            <Button variant="secondary" onClick={() => { setShowPin(true); setPinMsg(""); }}>
                                Change PIN
                            </Button>
                        </div>
                    </div>

                    {err && <div className="mt-2 text-sm font-semibold text-rose-600">{err}</div>}
                </CardHeader>

                <CardContent>
                    <div className="grid gap-3">
                        {/* Name card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="text-sm text-slate-500">Full name</div>
                            <div className="mt-1 text-lg font-extrabold">
                                {fullName || "—"}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="rounded-2xl border border-slate-200 bg-white">
                            <div className="divide-y divide-slate-200">
                                {rows.map((r) => (
                                    <div key={r.label} className="flex items-center justify-between gap-3 p-4">
                                        <div className="text-sm font-semibold text-slate-600">{r.label}</div>
                                        <div className="text-sm font-semibold text-slate-900 text-right">
                                            {r.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* If SAP record missing */}
                        {!me?.FirstName && !me?.LastName && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <div className="text-sm font-semibold text-amber-900">SAP employee record not found</div>
                                <div className="mt-1 text-sm text-amber-800">
                                    We can still use the app, but name/job/contacts are missing. If needed, we’ll map EmpID correctly to OHEM.
                                </div>
                            </div>
                        )}
                    </div>

                    {showPin && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 bg-black/40"
                                onClick={() => setShowPin(false)}
                            />
                            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-lg font-extrabold">Change PIN</div>
                                        <div className="text-sm text-slate-500">Update your login PIN</div>
                                    </div>
                                    <button
                                        className="h-9 w-9 rounded-xl border border-slate-200 bg-white font-bold"
                                        onClick={() => setShowPin(false)}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="mt-4 grid gap-3">
                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600">Old PIN</div>
                                        <Input
                                            type="password"
                                            value={oldPin}
                                            onChange={(e) => setOldPin(e.target.value)}
                                            placeholder="••••"
                                        />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-sm font-semibold text-slate-600">New PIN</div>
                                        <Input
                                            type="password"
                                            value={newPin}
                                            onChange={(e) => setNewPin(e.target.value)}
                                            placeholder="••••"
                                        />
                                        <div className="mt-1 text-xs text-slate-500">Minimum 4 characters.</div>
                                    </div>

                                    {pinMsg && (
                                        <div className={`text-sm font-semibold ${pinMsg.startsWith("✅") ? "text-emerald-600" : "text-rose-600"}`}>
                                            {pinMsg}
                                        </div>
                                    )}

                                    <div className="mt-2 flex gap-2">
                                        <Button variant="secondary" onClick={() => setShowPin(false)} disabled={savingPin}>
                                            Cancel
                                        </Button>
                                        <Button onClick={changePin} disabled={savingPin}>
                                            {savingPin ? "Saving..." : "Save"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
