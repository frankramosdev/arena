import { notFound } from "next/navigation";
import Link from "next/link";
import { Header, Footer, Badge } from "../../components";
import { 
  fetchMarket, 
  fetchOrderBook, 
  fetchTrades,
  toFrontendMarket,
  formatVolume,
  formatTimeRemaining,
} from "../../lib/api";
import { MarketTabs } from "./MarketTabs";
import { EarlyResolveButton } from "./EarlyResolveButton";

// Revalidate every 5 seconds
export const revalidate = 5;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  // Fetch market data
  const registryMarket = await fetchMarket(id);
  
  if (!registryMarket) {
    notFound();
  }
  
  const market = toFrontendMarket(registryMarket);
  
  // Fetch order book and trades in parallel
  const [orderBook, tradesRes] = await Promise.all([
    fetchOrderBook(id).catch(() => null),
    fetchTrades(id, 20).catch(() => ({ trades: [] })),
  ]);

  const isResolved = market.status !== "OPEN";

  return (
    <>
      <Header />

      <main className="flex-1" style={{ background: "var(--bg-primary)" }}>
        {/* Breadcrumb */}
        <div
          className="border-b"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-light)" }}
        >
          <div className="mx-auto max-w-7xl px-6 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Link href="/" style={{ color: "var(--text-muted)" }} className="hover:underline">
                Markets
              </Link>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <span style={{ color: "var(--text-secondary)" }}>{market.category}</span>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <span style={{ color: "var(--text-primary)" }}>{id}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content - 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              {/* Market Header */}
              <div
                className="rounded-2xl border p-6"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="info">{market.category}</Badge>
                      <Badge variant={market.status === "OPEN" ? "success" : "default"}>
                        {market.status}
                      </Badge>
                    </div>
                    <h1 className="font-serif text-2xl mb-3" style={{ color: "var(--text-primary)" }}>
                      {market.question}
                    </h1>
                    {market.twitterHandle && (
                      <a
                        href={`https://x.com/${market.twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm hover:underline"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        @{market.twitterHandle}
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Time Remaining</p>
                    <p className="font-serif text-xl" style={{ color: "var(--text-primary)" }}>
                      {formatTimeRemaining(market.expiresAt)}
                    </p>
                  </div>
                </div>

                {/* Probability Display */}
                  <div
                  className="p-6 rounded-xl mb-6"
                  style={{ 
                    background: market.yesPrice >= 50 ? "var(--green-soft)" : "var(--red-soft)",
                  }}
                  >
                  <div className="flex items-center justify-between mb-3">
                    <span 
                      className="text-lg font-medium" 
                      style={{ color: market.yesPrice >= 50 ? "#166534" : "#991B1B" }}
                    >
                      Probability
                    </span>
                    <span 
                      className="font-serif text-4xl tabular-nums font-semibold" 
                      style={{ color: market.yesPrice >= 50 ? "#166534" : "#991B1B" }}
                    >
                      {market.yesPrice}%
                      </span>
                  </div>
                  <div
                    className="h-4 rounded-full overflow-hidden" 
                    style={{ background: market.yesPrice >= 50 ? "rgba(22, 101, 52, 0.2)" : "rgba(153, 27, 27, 0.2)" }}
                  >
                      <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${market.yesPrice}%`, 
                        background: market.yesPrice >= 50 ? "#22C55E" : "#EF4444" 
                      }}
                      />
                    </div>
                  <div className="flex justify-between text-sm mt-3" style={{ color: "var(--text-muted)" }}>
                    <span>0% (No)</span>
                    <span>100% (Yes)</span>
                  </div>
                </div>

                {/* Resolution Result */}
                {isResolved && market.resolutionProof && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ 
                      background: market.status === "RESOLVED_YES" ? "var(--green-soft)" : "var(--red-soft)",
                      border: `1px solid ${market.status === "RESOLVED_YES" ? "#22C55E" : "#EF4444"}`
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {market.status === "RESOLVED_YES" ? "✓" : "✗"}
                      </span>
                      <span 
                        className="font-serif text-lg"
                        style={{ color: market.status === "RESOLVED_YES" ? "#166534" : "#991B1B" }}
                      >
                        Resolved: {market.status === "RESOLVED_YES" ? "YES" : "NO"}
                      </span>
                    </div>
                    <p 
                      className="text-sm"
                      style={{ color: market.status === "RESOLVED_YES" ? "#166534" : "#991B1B" }}
                    >
                      {market.resolutionProof.evidence.explanation}
                    </p>
                  </div>
                )}
              </div>

              {/* Tabs Component (Client) */}
              <MarketTabs 
                orderBook={orderBook} 
                trades={tradesRes.trades}
                marketId={id}
              />
            </div>

            {/* Sidebar - 1/3 */}
            <div className="space-y-6">
              {/* Stats */}
              <div
                className="rounded-2xl border p-5"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
              >
                <h3 className="font-serif text-lg mb-4" style={{ color: "var(--text-primary)" }}>
                  Market Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Total Volume</span>
                    <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatVolume(market.volume)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>24h Volume</span>
                    <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatVolume(market.volume24h || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Trades</span>
                    <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {market.tradeCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Created</span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {new Date(market.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Expires</span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {new Date(market.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resolution */}
              <div
                className="rounded-2xl border p-5"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
              >
                <h3 className="font-serif text-lg mb-4" style={{ color: "var(--text-primary)" }}>
                  Resolution
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      Verification Method
                    </p>
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--green)" }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {market.verificationMethod}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      Resolution Criteria
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {market.resolutionCriteria}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div
                className="rounded-2xl border p-5"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
              >
                <h3 className="font-serif text-lg mb-4" style={{ color: "var(--text-primary)" }}>
                  Description
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {market.description}
                </p>
              </div>

              {/* Tags */}
              {market.tags && market.tags.length > 0 && (
                <div
                  className="rounded-2xl border p-5"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
                >
                  <h3 className="font-serif text-lg mb-4" style={{ color: "var(--text-primary)" }}>
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {market.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Early Resolution */}
              {!isResolved && (
                <div
                  className="rounded-2xl border p-5"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
                >
                  <h3 className="font-serif text-lg mb-4" style={{ color: "var(--text-primary)" }}>
                    Early Resolution
                  </h3>
                  <EarlyResolveButton marketId={id} marketQuestion={market.question} />
                </div>
              )}

              {/* Actions */}
              <div
                className="rounded-2xl border p-5"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border-light)" }}
              >
                <Link
                  href="/trading"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-light)" }}
                >
                  <span>📊</span>
                  View on Trading Floor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
