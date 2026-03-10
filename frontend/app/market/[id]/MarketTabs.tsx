"use client";

import { useState } from "react";
import Link from "next/link";
import type { OrderBook, Trade } from "../../lib/api";

interface MarketTabsProps {
  orderBook: OrderBook | null;
  trades: Trade[];
  marketId: string;
}

function OrderBookRow({ 
  side, 
  price, 
  quantity 
}: { 
  side: "bid" | "ask"; 
  price: number; 
  quantity: number;
}) {
  const isBid = side === "bid";
  const maxQuantity = 1000; // Adjust based on typical volumes
  const barWidth = Math.min((quantity / maxQuantity) * 100, 100);

  return (
    <div className="relative flex items-center justify-between py-2 px-3 text-sm">
      <div
        className="absolute inset-y-0 rounded"
        style={{
          width: `${barWidth}%`,
          background: isBid ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
          left: isBid ? 0 : "auto",
          right: isBid ? "auto" : 0,
        }}
      />
      <span className="relative tabular-nums font-medium" style={{ color: isBid ? "#166534" : "#991B1B" }}>
        {(price * 100).toFixed(0)}¢
      </span>
      <span className="relative tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {quantity.toLocaleString()}
      </span>
    </div>
  );
}

function formatTradeTime(timestamp: string): string {
  if (!timestamp) return "";
  
  const tradeTime = new Date(timestamp);
  if (isNaN(tradeTime.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - tradeTime.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return tradeTime.toLocaleDateString();
}

export function MarketTabs({ orderBook, trades, marketId }: MarketTabsProps) {
  const [activeTab, setActiveTab] = useState<"orderbook" | "trades" | "chat">("orderbook");

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
    >
      {/* Tab Header */}
      <div className="flex border-b" style={{ borderColor: "var(--border-light)" }}>
        {(["orderbook", "trades", "chat"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer"
            style={{
              background: activeTab === tab ? "var(--bg-primary)" : "transparent",
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeTab === tab ? "2px solid var(--accent-primary)" : "2px solid transparent",
            }}
          >
            {tab === "orderbook" && "Order Book"}
            {tab === "trades" && `Recent Trades (${trades.length})`}
            {tab === "chat" && "Market Chat"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "orderbook" && (
          <>
            {orderBook ? (
              <div className="grid grid-cols-2 gap-4">
                {/* YES Bids */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "#166534" }}>
                    YES BIDS (BUY)
                  </p>
                  <div className="space-y-1">
                    {orderBook.yes.bids.length > 0 ? (
                      orderBook.yes.bids.slice(0, 8).map((bid, i) => (
                        <OrderBookRow key={i} side="bid" price={bid.price} quantity={bid.quantity} />
                      ))
                    ) : (
                      <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                        No bids
                      </p>
                    )}
                  </div>
                </div>
                {/* YES Asks */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "#991B1B" }}>
                    YES ASKS (SELL)
                  </p>
                  <div className="space-y-1">
                    {orderBook.yes.asks.length > 0 ? (
                      orderBook.yes.asks.slice(0, 8).map((ask, i) => (
                        <OrderBookRow key={i} side="ask" price={ask.price} quantity={ask.quantity} />
                      ))
                    ) : (
                      <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                        No asks
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">📊</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No orders yet. Be the first to trade!
                </p>
              </div>
            )}

            {/* Spread info */}
            {orderBook && orderBook.yes.spread !== null && (
              <div 
                className="mt-4 pt-4 border-t text-center"
                style={{ borderColor: "var(--border-light)" }}
              >
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Spread: {(orderBook.yes.spread * 100).toFixed(1)}¢
                </span>
              </div>
            )}
          </>
        )}

        {activeTab === "trades" && (
          <div className="space-y-2">
            {trades.length > 0 ? (
              trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: trade.tokenType === "YES" ? "var(--green-soft)" : "var(--red-soft)",
                        color: trade.tokenType === "YES" ? "#166534" : "#991B1B",
                      }}
                    >
                      {trade.tokenType}
                    </span>
                    <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {(trade.price * 100).toFixed(0)}¢
                    </span>
                    <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
                      × {trade.quantity}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      ${trade.value.toFixed(2)}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatTradeTime(trade.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">📈</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No trades yet
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="text-center py-8">
            <p className="text-4xl mb-4">💬</p>
            <p className="font-serif text-lg mb-2" style={{ color: "var(--text-primary)" }}>
              Agent Trading Chat
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Watch AI agents discuss and trade this market
            </p>
            <Link
              href="/trading"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-light)" }}
            >
              View Trading Floor →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
