import { io } from 'socket.io-client';
import { getToken } from './auth';

let _socket = null;

export function getSocket() {
    // If disconnected or token changed (e.g. after login), recreate
    if (_socket && _socket.connected) return _socket;
    if (_socket) { _socket.disconnect(); _socket = null; }

    // Strip /et path from VITE_API_URL to get the root server URL
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const baseUrl = apiUrl.replace(/\/et\/?$/, '').replace(/\/+$/, '');

    _socket = io(baseUrl, {
        auth: { token: getToken() },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
    });

    _socket.on('connect_error', (err) => {
        console.warn('[chat socket] connect error:', err.message);
    });

    return _socket;
}

export function destroySocket() {
    if (_socket) {
        _socket.disconnect();
        _socket = null;
    }
}
