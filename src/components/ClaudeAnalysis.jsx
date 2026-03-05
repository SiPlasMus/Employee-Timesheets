import React, { useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { Card, CardContent, CardHeader } from "../ui/Card";

function fmtDuration(mins) {
    const m = Math.max(0, Math.round(Number(mins || 0)));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0 && mm > 0) return `${h}h ${mm}m`;
    if (h > 0) return `${h}h`;
    return `${mm}m`;
}

function buildContext({ month, totals, byAct, byCC, byDay }) {
    const lines = [];

    lines.push(`Timesheet data for ${month}:`);
    lines.push(`- Total net work time: ${fmtDuration(totals.net)}`);
    lines.push(`- Total break time: ${fmtDuration(totals.breaks)}`);
    lines.push(`- Total gross time: ${fmtDuration(totals.gross)}`);
    lines.push(`- Total entries: ${byDay.reduce((s, d) => s, 0)}`);
    lines.push("");

    if (byAct.length) {
        lines.push("By activity type:");
        for (const x of byAct) {
            lines.push(`  - ${x.name}: ${fmtDuration(x.mins)}`);
        }
        lines.push("");
    }

    if (byCC.length) {
        lines.push("By cost center:");
        for (const x of byCC) {
            lines.push(`  - ${x.name}: ${fmtDuration(x.mins)}`);
        }
        lines.push("");
    }

    if (byDay.length) {
        lines.push("Daily breakdown:");
        for (const d of [...byDay].sort((a, b) => (a.date < b.date ? -1 : 1))) {
            lines.push(`  - ${d.date}: ${fmtDuration(d.mins)}`);
        }
    }

    return lines.join("\n");
}

export default function ClaudeAnalysis({ month, totals, byAct, byCC, byDay }) {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem("et_claude_key") || "");
    const [keyDraft, setKeyDraft] = useState("");
    const [showSettings, setShowSettings] = useState(!localStorage.getItem("et_claude_key"));
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]); // { role: "user"|"assistant", text }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    function saveKey() {
        const k = keyDraft.trim();
        if (!k) return;
        localStorage.setItem("et_claude_key", k);
        setApiKey(k);
        setKeyDraft("");
        setShowSettings(false);
    }

    function clearKey() {
        localStorage.removeItem("et_claude_key");
        setApiKey("");
        setShowSettings(true);
    }

    async function ask() {
        const q = question.trim();
        if (!q || loading) return;
        if (!apiKey) {
            setError("Enter an Anthropic API key first.");
            setShowSettings(true);
            return;
        }

        setError("");
        setQuestion("");
        const newMessages = [...messages, { role: "user", text: q }];
        setMessages(newMessages);
        setLoading(true);

        // Append a placeholder for the streaming assistant reply
        let assistantText = "";
        setMessages([...newMessages, { role: "assistant", text: "" }]);

        try {
            const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
            const context = buildContext({ month, totals, byAct, byCC, byDay });

            // Build conversation history for the API
            const apiMessages = [];
            for (const m of newMessages) {
                apiMessages.push({ role: m.role, content: m.text });
            }

            const stream = client.messages.stream({
                model: "claude-opus-4-6",
                max_tokens: 2048,
                thinking: { type: "adaptive" },
                system: `You are an assistant helping an employee understand their timesheet data. Answer questions concisely and helpfully. Here is their timesheet data:\n\n${context}`,
                messages: apiMessages,
            });

            stream.on("text", (delta) => {
                assistantText += delta;
                setMessages([...newMessages, { role: "assistant", text: assistantText }]);
            });

            await stream.finalMessage();
        } catch (e) {
            const msg = e?.message || "Error calling Claude API";
            setError(msg);
            // Remove the empty assistant placeholder on error
            setMessages(newMessages);
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask();
        }
    }

    const hasData = byDay.length > 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-lg font-extrabold">🤖 Ask Claude</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Ask questions about your timesheet data</div>
                    </div>
                    <button
                        className="text-xs text-slate-400 hover:text-slate-700 underline"
                        onClick={() => setShowSettings((v) => !v)}
                    >
                        {showSettings ? "Hide settings" : "API key"}
                    </button>
                </div>

                {showSettings && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                        <div className="text-sm font-semibold text-slate-700 mb-2 dark:text-slate-300">Anthropic API Key</div>
                        {apiKey ? (
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-slate-600 flex-1 dark:text-slate-400">
                                    Key saved: <span className="font-mono">{apiKey.slice(0, 8)}…</span>
                                </div>
                                <Button variant="secondary" onClick={clearKey}>
                                    Remove
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="sk-ant-..."
                                    value={keyDraft}
                                    onChange={(e) => setKeyDraft(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && saveKey()}
                                />
                                <Button onClick={saveKey} disabled={!keyDraft.trim()}>
                                    Save
                                </Button>
                            </div>
                        )}
                        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                            Your key is stored locally in your browser and never sent to our servers.
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent>
                {!hasData ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No timesheet data loaded for this month.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {/* Message history */}
                        {messages.length > 0 && (
                            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                                {messages.map((m, i) => (
                                    <div
                                        key={i}
                                        className={
                                            m.role === "user"
                                                ? "self-end max-w-[85%] rounded-2xl bg-slate-900 text-white px-3 py-2 text-sm"
                                                : "self-start max-w-[85%] rounded-2xl bg-slate-100 text-slate-900 px-3 py-2 text-sm whitespace-pre-wrap dark:bg-slate-800 dark:text-slate-100"
                                        }
                                    >
                                        {m.text || (loading && i === messages.length - 1 ? (
                                            <span className="animate-pulse text-slate-400">Thinking…</span>
                                        ) : null)}
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm font-semibold text-rose-700">
                                {error}
                            </div>
                        )}

                        {/* Input */}
                        <div className="flex gap-2 items-end">
                            <textarea
                                className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
                                placeholder="e.g. How many hours did I work on projects this month?"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                disabled={loading}
                            />
                            <Button onClick={ask} disabled={loading || !question.trim()}>
                                {loading ? "…" : "Ask"}
                            </Button>
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">Press Enter to send, Shift+Enter for new line.</div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
