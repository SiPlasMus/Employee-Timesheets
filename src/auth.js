import { setAuthToken } from "./api";

export function getToken() {
    return localStorage.getItem("et_token");
}

export function setToken(token) {
    localStorage.setItem("et_token", token);
    setAuthToken(token);
}

export function setRole(role) {
    localStorage.setItem("et_role", role || "employee");
}

export function clearToken() {
    localStorage.removeItem("et_token");
    localStorage.removeItem("et_role");
    setAuthToken(null);
}

export function isAuthed() {
    return !!getToken();
}

export function getRole() {
    // Prefer stored role (set on login)
    const stored = localStorage.getItem("et_role");
    if (stored) return stored;

    // Fallback: decode JWT payload (no verification — trust server-signed token)
    const token = getToken();
    if (!token) return "employee";
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload?.role || "employee";
    } catch {
        return "employee";
    }
}

export function isAdmin() {
    return getRole() === "admin";
}

export function getEmpId() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return String(payload?.empId ?? '');
    } catch {
        return null;
    }
}
