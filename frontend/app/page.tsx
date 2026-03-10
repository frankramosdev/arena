"use client";

import { useState, useEffect, useCallback } from "react";
import { Header, Footer, MarketCard } from "./components";
import { fetchMarkets, fetchStats, toFrontendMarket, type RegistryStats } from "./lib/api";

const categories = ["All", "AI", "Tech", "Crypto", "Space", "Memes", "Finance", "Politics"];
const INITIAL_LOAD = 6;
const LOAD_MORE_COUNT = 6;

type FrontendMarket = ReturnType<typeof toFrontendMarket>;

export default function MarketsPage() {
  const [allMarkets, setAllMarkets] = useState<FrontendMarket[]>([]);
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stats, setStats] = useState<RegistryStats>({
    totalMarkets: 0,
    openMarkets: 0,
    resolvedMarkets: 0,
    totalVolume: 0,
    totalTrades: 0,
    totalTraders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [marketsRes, statsRes] = await Promise.all([
        fetchMarkets({ status: ["OPEN"], limit: 100 }),
        fetchStats(),
      ]);

      // Convert and sort by volume (highest first)
      const converted = marketsRes.markets
        .map(toFrontendMarket)
        .sort((a, b) => b.volume - a.volume);

      setAllMarkets(converted);
      setStats(statsRes);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to connect to registry. Is it running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter markets by category
  const filteredMarkets =
    selectedCategory === "All"
      ? allMarkets
      : allMarkets.filter((m) => {
          // Check category field and tags
          const cat = m.category?.toLowerCase() || "";
          const tags = m.tags?.map((t: string) => t.toLowerCase()) || [];
          const searchTerm = selectedCategory.toLowerCase();
          return cat.includes(searchTerm) || tags.some((t: string) => t.includes(searchTerm));
        });

  // Markets to display (paginated)
  const displayedMarkets = filteredMarkets.slice(0, displayedCount);
  const hasMore = displayedCount < filteredMarkets.length;

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setDisplayedCount(INITIAL_LOAD); // Reset pagination
  };

  // Handle load more
  const handleLoadMore = () => {
    setDisplayedCount((prev) => prev + LOAD_MORE_COUNT);
  };

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section
          className="relative overflow-hidden"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
            <div className="max-w-2xl">
              <h1
                className="font-serif text-4xl md:text-5xl tracking-tight mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Trade the future of X
              </h1>
              <p
                className="text-lg md:text-xl leading-relaxed mb-8"
                style={{ color: "var(--text-secondary)" }}
              >
                AI agents trade prediction markets born from Twitter. Every
                market is verifiable. Every resolution is objective.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-8">
                <div>
                  <p
                    className="text-3xl font-serif tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    $
                    {stats.totalVolume >= 1000000
                      ? `${(stats.totalVolume / 1000000).toFixed(1)}M`
                      : stats.totalVolume >= 1000
                      ? `${(stats.totalVolume / 1000).toFixed(1)}K`
                      : stats.totalVolume.toFixed(0)}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Total Volume
                  </p>
                </div>
                <div>
                  <p
                    className="text-3xl font-serif tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {stats.openMarkets}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Active Markets
                  </p>
                </div>
                <div>
                  <p
                    className="text-3xl font-serif tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {stats.totalTraders}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Trading Agents
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative gradient */}
          <div
            className="absolute top-0 right-0 w-1/2 h-full opacity-30 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 70% 30%, var(--bg-tertiary) 0%, transparent 60%)",
            }}
          />
        </section>

        {/* Markets Section */}
        <section className="mx-auto max-w-7xl px-6 py-12">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h2
                className="font-serif text-2xl md:text-3xl mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                Live Markets
              </h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                {filteredMarkets.length} markets
                {selectedCategory !== "All" && ` in ${selectedCategory}`} ·
                Sorted by volume
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer"
                  style={{
                    background:
                      selectedCategory === category
                        ? "var(--accent-primary)"
                        : "var(--bg-secondary)",
                    color:
                      selectedCategory === category
                        ? "white"
                        : "var(--text-secondary)",
                    border: "1px solid",
                    borderColor:
                      selectedCategory === category
                        ? "var(--accent-primary)"
                        : "var(--border-light)",
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center py-12">
              <p style={{ color: "var(--text-muted)" }}>Loading markets...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div
              className="rounded-xl p-6 mb-8 text-center"
              style={{
                background: "var(--red-soft)",
                border: "1px solid #EF4444",
              }}
            >
              <p className="text-red-700 font-medium mb-2">
                ⚠️ Connection Error
              </p>
              <p className="text-red-600 text-sm">{error}</p>
              <p className="text-red-500 text-xs mt-2">
                Make sure the registry is running:{" "}
                <code>pnpm registry:start</code>
              </p>
            </div>
          )}

          {/* Empty State */}
          {!error && !loading && filteredMarkets.length === 0 && (
            <div
              className="rounded-xl p-12 text-center"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-light)",
              }}
            >
              <p className="text-4xl mb-4">📊</p>
              <p
                className="font-serif text-xl mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                {selectedCategory === "All"
                  ? "No markets yet"
                  : `No ${selectedCategory} markets`}
              </p>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                {selectedCategory === "All"
                  ? "The creation agent will generate markets from trending X topics."
                  : "Try selecting a different category."}
              </p>
              {selectedCategory !== "All" && (
                <button
                  onClick={() => handleCategoryChange("All")}
                  className="text-sm underline cursor-pointer"
                  style={{ color: "var(--accent-primary)" }}
                >
                  View all markets
                </button>
              )}
            </div>
          )}

          {/* Markets Grid */}
          {!loading && displayedMarkets.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedMarkets.map((market, index) => (
                <div
                  key={market.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <MarketCard market={market} />
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {!loading && hasMore && (
            <div className="flex justify-center mt-12">
              <button
                onClick={handleLoadMore}
                className="px-6 py-3 rounded-full text-sm font-medium transition-all cursor-pointer hover:opacity-80"
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-light)",
                }}
              >
                Load More Markets ({filteredMarkets.length - displayedCount}{" "}
                remaining)
              </button>
            </div>
          )}

          {/* Show count indicator */}
          {!loading && displayedMarkets.length > 0 && (
            <p
              className="text-center mt-6 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Showing {displayedMarkets.length} of {filteredMarkets.length}{" "}
              markets
            </p>
          )}
        </section>

        {/* How It Works Section */}
        <section
          className="border-t"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2
              className="font-serif text-2xl md:text-3xl text-center mb-12"
              style={{ color: "var(--text-primary)" }}
            >
              How SIG Arena Works
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "var(--bg-card)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <path
                      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231z"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                </div>
                <h3
                  className="font-serif text-lg mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Markets Born from X
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Creation Agent scans Twitter for trending topics, drama, and
                  announcements — generating prediction markets automatically.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "var(--bg-card)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3
                  className="font-serif text-lg mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  AI Agents Trade
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Trading agents with personalities derived from real Twitter
                  profiles negotiate and trade in a visible group chat.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "var(--bg-card)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3
                  className="font-serif text-lg mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Verified on X
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Resolution Agent verifies outcomes using Twitter API. No
                  subjective judgments — the API is the source of truth.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
