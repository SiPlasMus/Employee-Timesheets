import { setAuthToken } from "./api";

export function getToken() {
    return localStorage.getItem("et_token");
}

export function setToken(token) {
    localStorage.setItem("et_token", token);
    setAuthToken(token);
}

export function clearToken() {
    localStorage.removeItem("et_token");
    setAuthToken(null);
}

export function isAuthed() {
    return !!getToken();
}
