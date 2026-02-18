"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface LogLine {
  timestamp: string;
  text: string;
  stream: "stdout" | "stderr";
}

interface TerminalDisplayProps {
  agentKey: string;
  onClose: () => void;
}

export function TerminalDisplay({ agentKey, onClose }: TerminalDisplayProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string>("running");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("0s");
  const scrollRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  // Poll for log lines
  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/agents/run?agentKey=${agentKey}&since=${offsetRef.current}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      if (data.startedAt) setStartedAt(data.startedAt);
      if (data.lines?.length > 0) {
        setLines((prev) => [...prev, ...data.lines]);
        offsetRef.current = data.totalLines;
      }
    } catch {
      // Network error — keep polling
    }
  }, [agentKey]);

  useEffect(() => {
    poll(); // Initial fetch
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Elapsed timer
  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      const diffMs = Date.now() - new Date(startedAt).getTime();
      const s = Math.floor(diffMs / 1000);
      if (s < 60) setElapsed(`${s}s`);
      else setElapsed(`${Math.floor(s / 60)}m ${s % 60}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const statusColor =
    status === "running"
      ? "text-amber"
      : status === "completed"
        ? "text-terminal-green"
        : "text-terminal-red";

  return (
    <div className="rounded-xl border border-stroke bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stroke px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Terminal dots */}
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-red/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-yellow/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-green/60" />
          </div>
          <span className="font-heading text-xs text-text-secondary">
            {agentKey}
          </span>
          <span className={`font-heading text-xs ${statusColor}`}>
            {status}
          </span>
          <span className="font-heading text-xs text-text-secondary/60">
            {elapsed}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const text = lines.map((l) => l.text).join("\n");
              navigator.clipboard.writeText(text);
            }}
            className="rounded px-2 py-1 text-xs font-heading text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Copy logs"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs font-heading text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close terminal"
          >
            Close
          </button>
        </div>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto p-4 font-heading text-xs leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-text-secondary animate-pulse">
            Waiting for output...
          </p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-text-secondary/40 select-none">
                {new Date(line.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={
                  line.stream === "stderr"
                    ? "text-terminal-red"
                    : "text-text-primary"
                }
              >
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
