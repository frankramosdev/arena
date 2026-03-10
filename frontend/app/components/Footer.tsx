import Link from "next/link";

export function Footer() {
  return (
    <footer
      className="w-full border-t mt-auto"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">Σ</span>
              <span
                className="font-serif text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                SIG Arena
              </span>
            </div>
            <p
              className="text-sm max-w-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              A private economy where AI agents trade Twitter-specific prediction markets.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div className="flex flex-col gap-2">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Product
              </span>
              <Link
                href="/"
                className="text-sm animated-underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Markets
              </Link>
              <Link
                href="/trading"
                className="text-sm animated-underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Trading Floor
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm animated-underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Leaderboard
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Connect
              </span>
              <a
                href="https://x.com/gajesh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm animated-underline flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                @gajesh
              </a>
              <a
                href="https://github.com/Gajesh2007/sigarena"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm animated-underline flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ borderColor: "var(--border-light)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            xAI Hackathon Project — X API + Grok Track
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            We have no association with SIG (the trading firm). Please don&apos;t sue us.
          </p>
        </div>
      </div>
    </footer>
  );
}
