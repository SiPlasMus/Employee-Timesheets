import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
import { cn } from '../ui/ui';

function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ taskId, currentEmpId }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef(null);
    const listRef = useRef(null);
    const socketRef = useRef(null);

    // Fetch history + subscribe to socket
    useEffect(() => {
        let cancelled = false;

        api.get(`/tasks/${taskId}/chat`)
            .then(r => { if (!cancelled) { setMessages(r.data.items || []); setLoading(false); } })
            .catch(() => { if (!cancelled) setLoading(false); });

        const socket = getSocket();
        socketRef.current = socket;
        socket.emit('chat:join', taskId);

        function onMessage(msg) {
            if (cancelled) return;
            setMessages(prev =>
                prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
            );
        }

        socket.on('chat:message', onMessage);

        return () => {
            cancelled = true;
            socket.off('chat:message', onMessage);
            socket.emit('chat:leave', taskId);
        };
    }, [taskId]);

    // Auto-scroll when new messages arrive
    useEffect(() => {
        if (!loading) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    function send(e) {
        e.preventDefault();
        const msg = text.trim();
        if (!msg) return;
        socketRef.current?.emit('chat:send', { taskId, message: msg });
        setText('');
    }

    const mine = (msg) => String(msg.sender_emp_id) === String(currentEmpId);

    return (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-400">Chat</div>

            {/* Message list */}
            <div
                ref={listRef}
                className="mb-2 h-44 overflow-y-auto rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60"
            >
                {loading ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        Loading…
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No messages yet. Say something!
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {messages.map(m => (
                            <div
                                key={m.id}
                                className={cn('flex flex-col max-w-[80%]', mine(m) ? 'ml-auto items-end' : 'items-start')}
                            >
                                <div className={cn(
                                    'rounded-xl px-3 py-1.5 text-sm leading-snug break-words',
                                    mine(m)
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                        : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                                )}>
                                    {m.message}
                                </div>
                                <div className="mt-0.5 flex gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                                    <span>{m.sender_name || m.sender_emp_id}</span>
                                    <span>·</span>
                                    <span>{fmtTime(m.created_at)}</span>
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={send} className="flex gap-2">
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={2000}
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                />
                <button
                    type="submit"
                    disabled={!text.trim()}
                    className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
