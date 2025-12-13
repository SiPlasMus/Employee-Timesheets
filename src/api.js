import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;

export const api = axios.create({
    baseURL,
    timeout: 20000,
});

export function setAuthToken(token) {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
}

// init token from localStorage on startup
const saved = localStorage.getItem("et_token");
if (saved) setAuthToken(saved);
