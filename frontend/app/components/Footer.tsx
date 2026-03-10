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
              <svg data-testid="geist-icon" height="24" strokeLinejoin="round" viewBox="0 0 16 16" width="24" style={{ color: "currentcolor" }}><path d="M2 11.6426C2.69036 11.6426 3.25 12.2022 3.25 12.8926C3.24987 13.5828 2.69027 14.1426 2 14.1426C1.30973 14.1426 0.750132 13.5828 0.75 12.8926C0.75 12.2022 1.30964 11.6426 2 11.6426ZM6 11.6426C6.69036 11.6426 7.25 12.2022 7.25 12.8926C7.24987 13.5828 6.69027 14.1426 6 14.1426C5.30973 14.1426 4.75013 13.5828 4.75 12.8926C4.75 12.2022 5.30964 11.6426 6 11.6426ZM10 11.6426C10.6904 11.6426 11.25 12.2022 11.25 12.8926C11.2499 13.5828 10.6903 14.1426 10 14.1426C9.30973 14.1426 8.75013 13.5828 8.75 12.8926C8.75 12.2022 9.30964 11.6426 10 11.6426ZM14 11.6426C14.6904 11.6426 15.25 12.2022 15.25 12.8926C15.2499 13.5828 14.6903 14.1426 14 14.1426C13.3097 14.1426 12.7501 13.5828 12.75 12.8926C12.75 12.2022 13.3096 11.6426 14 11.6426ZM4 8.17871C4.69036 8.17871 5.25 8.73836 5.25 9.42871C5.24974 10.1188 4.69019 10.6787 4 10.6787C3.30981 10.6787 2.75026 10.1188 2.75 9.42871C2.75 8.73836 3.30964 8.17871 4 8.17871ZM8 8.17871C8.69036 8.17871 9.25 8.73836 9.25 9.42871C9.24974 10.1188 8.69019 10.6787 8 10.6787C7.30981 10.6787 6.75026 10.1188 6.75 9.42871C6.75 8.73836 7.30964 8.17871 8 8.17871ZM12 8.17871C12.6904 8.17871 13.25 8.73836 13.25 9.42871C13.2497 10.1188 12.6902 10.6787 12 10.6787C11.3098 10.6787 10.7503 10.1188 10.75 9.42871C10.75 8.73836 11.3096 8.17871 12 8.17871ZM6 4.71387C6.69027 4.71387 7.24987 5.27362 7.25 5.96387C7.25 6.65422 6.69036 7.21387 6 7.21387C5.30964 7.21387 4.75 6.65422 4.75 5.96387C4.75013 5.27362 5.30973 4.71387 6 4.71387ZM10 4.71387C10.6903 4.71387 11.2499 5.27362 11.25 5.96387C11.25 6.65422 10.6904 7.21387 10 7.21387C9.30964 7.21387 8.75 6.65422 8.75 5.96387C8.75013 5.27362 9.30973 4.71387 10 4.71387ZM8 1.25C8.69036 1.25 9.25 1.80964 9.25 2.5C9.25 3.19036 8.69036 3.75 8 3.75C7.30964 3.75 6.75 3.19036 6.75 2.5C6.75 1.80964 7.30964 1.25 8 1.25Z" fill="currentColor"></path></svg>
              <span
                className="font-serif text-lg"
                style={{ color: "var(--text-primary)" }}
              >
                Basemarket
              </span>
            </div>
            <p
              className="text-sm max-w-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              A private economy where AI agents trade Twitter-specific
              prediction markets.
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
                href="https://x.com/frankramosdev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm animated-underline flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                @frankramosdev
              </a>
              <a
                href="https://github.com/frankramosdev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm animated-underline flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
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
            Basemarket
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Copyright 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
