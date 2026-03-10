"use client";

import { useState } from "react";
import { Button } from "../../components";
import { requestEarlyResolution } from "../../lib/api";

interface EarlyResolveButtonProps {
  marketId: string;
  marketQuestion: string;
}

export function EarlyResolveButton({ marketId, marketQuestion }: EarlyResolveButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{
    outcome?: string;
    explanation?: string;
    error?: string;
  } | null>(null);

  const handleResolve = async () => {
    if (status === "loading") return;

    const confirmed = window.confirm(
      `Request early resolution for:\n\n"${marketQuestion}"\n\nThe AI will gather evidence and determine the outcome. Continue?`
    );

    if (!confirmed) return;

    setStatus("loading");
    setResult(null);

    try {
      const res = await requestEarlyResolution(marketId, "User requested early resolution via UI");

      if (res.success && res.outcome) {
        setStatus("success");
        setResult({
          outcome: res.outcome,
          explanation: res.evidence?.explanation,
        });
        // Reload page after 2 seconds to show updated status
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setStatus("error");
        setResult({ error: res.error || "Resolution failed" });
      }
    } catch (e) {
      setStatus("error");
      setResult({ error: String(e) });
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleResolve}
        disabled={status === "loading" || status === "success"}
        variant="primary"
        size="md"
        className="w-full"
        style={{
          background: status === "loading" ? "#6B7280" : "#2563EB",
          color: "white",
          opacity: 1,
          border: "none",
        }}
      >
        {status === "idle" && (
          <>
            <span className="mr-2">⚡</span>
            Request Early Resolution
          </>
        )}
        {status === "loading" && (
          <>
            <span className="mr-2 animate-spin">⏳</span>
            AI Gathering Evidence...
          </>
        )}
        {status === "success" && (
          <>
            <span className="mr-2">✓</span>
            Resolved!
          </>
        )}
        {status === "error" && (
          <>
            <span className="mr-2">↻</span>
            Retry Resolution
          </>
        )}
      </Button>

      {/* Result display */}
      {result && status === "success" && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            background: result.outcome === "YES" ? "var(--green-soft)" : "var(--red-soft)",
            color: result.outcome === "YES" ? "#166534" : "#991B1B",
          }}
        >
          <div className="font-medium mb-1">
            Resolved: {result.outcome}
          </div>
          {result.explanation && (
            <p className="text-xs opacity-80">{result.explanation}</p>
          )}
        </div>
      )}

      {result && status === "error" && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: "var(--red-soft)", color: "#991B1B" }}
        >
          {result.error}
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        AI will search X/Twitter for evidence and resolve the market if criteria is met.
      </p>
    </div>
  );
}
