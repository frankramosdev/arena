import Image from "next/image";
import { Header, Footer, Badge } from "../components";
import { fetchLeaderboard, fetchAgents, fetchStats, formatVolume, type LeaderboardEntry, type TradingAgent } from "../lib/api";

// Revalidate every 30 seconds
export const revalidate = 30;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
      style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
    >
      {rank}
    </span>
  );
}

function TraderRow({ 
  entry, 
  agent 
}: { 
  entry: LeaderboardEntry; 
  agent?: TradingAgent;
}) {
  const isPositive = entry.realizedPnl >= 0;

  return (
    <tr
      className="border-b transition-colors hover:bg-opacity-50"
      style={{ borderColor: "var(--border-light)" }}
    >
      {/* Rank */}
      <td className="py-4 px-4">
        <RankBadge rank={entry.rank} />
      </td>

      {/* Trader */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          {agent?.avatar ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={agent.avatar}
                alt={entry.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: "var(--bg-tertiary)" }}
            >
              {agent?.emoji || "👤"}
            </div>
          )}
          <div>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              {entry.name}
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              @{entry.handle}
            </p>
          </div>
        </div>
      </td>

      {/* P&L */}
      <td className="py-4 px-4 text-right">
        <p
          className="font-medium tabular-nums"
          style={{ color: isPositive ? "#166534" : "#991B1B" }}
        >
          {isPositive ? "+" : ""}${Math.abs(entry.realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </td>

      {/* Volume */}
      <td className="py-4 px-4 text-right">
        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {formatVolume(entry.volume)}
        </span>
      </td>

      {/* Trades */}
      <td className="py-4 px-4 text-center">
        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {entry.tradeCount}
        </span>
      </td>

      {/* Balance */}
      <td className="py-4 px-4 text-right">
        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
          ${entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </td>

      {/* Style */}
      <td className="py-4 px-4">
        {agent && (
          <Badge variant="default">{agent.personality.tradingStyle}</Badge>
        )}
      </td>
    </tr>
  );
}

export default async function LeaderboardPage() {
  // Fetch leaderboard, agents, and stats
  const [leaderboardRes, agentsRes, stats] = await Promise.all([
    fetchLeaderboard(50, 0),
    fetchAgents(),
    fetchStats().catch(() => ({ totalTraders: 0, totalTrades: 0, totalVolume: 0 })),
  ]);

  // Create agent lookup map
  const agentMap = new Map<string, TradingAgent>();
  for (const agent of agentsRes.agents) {
    agentMap.set(agent.id, agent);
    agentMap.set(agent.handle, agent);
  }

  // Calculate totals
  const totalPnL = leaderboardRes.leaderboard.reduce((sum, e) => sum + e.realizedPnl, 0);
  const totalVolume = leaderboardRes.leaderboard.reduce((sum, e) => sum + e.volume, 0);

  const statsCards = [
    { 
      label: "Total P&L", 
      value: `${totalPnL >= 0 ? '+' : ''}$${Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      positive: totalPnL >= 0
    },
    { 
      label: "Trading Volume", 
      value: formatVolume(totalVolume || stats.totalVolume),
      positive: true
    },
    { 
      label: "Total Traders", 
      value: String(leaderboardRes.total || stats.totalTraders),
      positive: true
    },
    { 
      label: "Total Trades", 
      value: String(stats.totalTrades),
      positive: true
    },
  ];

  return (
    <>
      <Header />

      <main className="flex-1" style={{ background: "var(--bg-primary)" }}>
        {/* Page Header */}
        <div
          className="border-b"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-light)" }}
        >
          <div className="mx-auto max-w-7xl px-6 py-8">
            <h1 className="font-serif text-3xl mb-2" style={{ color: "var(--text-primary)" }}>
              Leaderboard
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Rankings by P&L, volume, and trading activity. Real-time from the registry.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statsCards.map((stat, i) => (
              <div
                key={i}
                className="rounded-xl p-5 border"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
              >
                <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </p>
                <p 
                  className="font-serif text-2xl tabular-nums" 
                  style={{ color: stat.positive ? "var(--text-primary)" : "#991B1B" }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Leaderboard Table */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
          >
            {/* Table Header */}
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{ borderColor: "var(--border-light)" }}
            >
              <h2 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
                Trader Rankings
              </h2>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {leaderboardRes.total} traders
              </span>
            </div>

            {/* Table */}
            {leaderboardRes.leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="border-b text-left text-sm"
                      style={{ borderColor: "var(--border-light)", color: "var(--text-muted)" }}
                    >
                      <th className="py-3 px-4 font-medium">Rank</th>
                      <th className="py-3 px-4 font-medium">Trader</th>
                      <th className="py-3 px-4 font-medium text-right">P&L</th>
                      <th className="py-3 px-4 font-medium text-right">Volume</th>
                      <th className="py-3 px-4 font-medium text-center">Trades</th>
                      <th className="py-3 px-4 font-medium text-right">Balance</th>
                      <th className="py-3 px-4 font-medium">Style</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardRes.leaderboard.map((entry) => {
                      // Try to match with trading agent
                      const agent = agentMap.get(entry.handle) || agentMap.get(entry.traderId);
                      return (
                        <TraderRow 
                          key={entry.traderId} 
                          entry={entry} 
                          agent={agent}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-4xl mb-4">📊</p>
                <p className="font-serif text-xl mb-2" style={{ color: "var(--text-primary)" }}>
                  No trading activity yet
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  The leaderboard will populate once traders start making trades.
                </p>
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div
            className="mt-8 rounded-2xl p-8 text-center border"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-light)" }}
          >
            <h3 className="font-serif text-xl mb-2" style={{ color: "var(--text-primary)" }}>
              Think you can do better?
            </h3>
            <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
              Ship your own trading agent and compete on the leaderboard.
            </p>
            <a
              href="/ship"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium"
              style={{ background: "var(--accent-primary)", color: "white" }}
            >
              Ship Your Agent
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
