"use client";

import Link from "next/link";
import { Badge } from "./Badge";

export interface Market {
  id: string;
  question: string;
  description?: string;
  category: string;
  yesPrice: number; // 0-100 (probability %)
  noPrice: number; // 0-100
  volume: number;
  expiresAt: string;
  status: "OPEN" | "HALTED" | "RESOLVED_YES" | "RESOLVED_NO" | "INVALID";
  twitterHandle?: string;
  verificationMethod?: string;
}

interface MarketCardProps {
  market: Market;
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
  return `$${volume}`;
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m left`;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "AI": "🤖",
    "Tech": "💻",
    "Crypto": "₿",
    "Politics": "🏛️",
    "Sports": "⚽",
    "Entertainment": "🎬",
    "Science": "🔬",
    "Space": "🚀",
    "Finance": "📈",
    "Memes": "🐸",
  };
  return icons[category] || "📊";
}

export function MarketCard({ market }: MarketCardProps) {
  const isResolved = market.status !== "OPEN" && market.status !== "HALTED";
  const isHalted = market.status === "HALTED";
  const timeRemaining = formatTimeRemaining(market.expiresAt);
  const isUrgent = timeRemaining.includes("h left") && !timeRemaining.includes("d");

  return (
    <article
      className="group relative rounded-2xl border overflow-hidden card-hover"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Category & Time Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{getCategoryIcon(market.category)}</span>
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {market.category}
          </span>
        </div>
        <Badge variant={isHalted ? "warning" : isUrgent ? "warning" : isResolved ? "default" : "info"}>
          {isResolved ? (
            market.status === "RESOLVED_YES" ? "✓ YES" :
            market.status === "RESOLVED_NO" ? "✗ NO" : "Invalid"
          ) : isHalted ? (
            "⏸ Halted"
          ) : (
            timeRemaining
          )}
        </Badge>
      </div>

      {/* Main Content */}
      <div className="p-5">
        {/* Question - Clickable Link */}
        <Link href={`/market/${market.id}`} className="relative z-10">
          <h3
            className="font-serif text-lg leading-snug mb-3 line-clamp-2 hover:underline cursor-pointer"
            style={{ color: "var(--text-primary)" }}
          >
            {market.question}
          </h3>
        </Link>

        {/* Twitter handle if present */}
        {market.twitterHandle && (
          <a
            href={`https://x.com/${market.twitterHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm mb-4 hover:underline relative z-10"
            style={{ color: "var(--text-tertiary)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @{market.twitterHandle}
          </a>
        )}

        {/* Probability Display */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Probability
              </span>
              <span
              className="text-2xl font-serif font-semibold tabular-nums"
              style={{ color: market.yesPrice >= 50 ? "#166534" : "#991B1B" }}
              >
              {market.yesPrice}%
              </span>
            </div>
            <div
            className="h-3 rounded-full overflow-hidden"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${market.yesPrice}%`,
                background: market.yesPrice >= 50 
                  ? "linear-gradient(90deg, #22C55E 0%, #16A34A 100%)"
                  : "linear-gradient(90deg, #EF4444 0%, #DC2626 100%)",
                }}
              />
          </div>
        </div>

        {/* Stats Row */}
        <div
          className="flex items-center justify-between pt-4 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: "var(--text-muted)" }}
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span
                className="text-sm font-medium tabular-nums"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatVolume(market.volume)}
              </span>
            </div>
            {market.verificationMethod && (
              <div
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {market.verificationMethod}
              </div>
            )}
          </div>

          {/* View Details Link */}
          <Link 
            href={`/market/${market.id}`}
            className="text-sm font-medium relative z-10"
            style={{ color: "var(--accent-primary)" }}
          >
            View →
              </Link>
        </div>
      </div>

      {/* Hover gradient overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(45, 52, 54, 0.02) 100%)",
        }}
      />
    </article>
  );
}
