"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Markets" },
  { href: "/trading", label: "Trading Floor" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Header() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b"
      style={{
        height: "var(--header-height)",
        background: "var(--bg-primary)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/logo.png"
            alt="Basemarket"
            width={32}
            height={32}
            className="rounded-md"
          />
          <div className="flex items-baseline gap-1">
            <span
              className="relative font-serif text-xl tracking-tight cursor-pointer"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              SIG
              {/* Tooltip */}
              <span
                className={`
                  absolute left-1/2 -translate-x-1/2 top-full mt-2
                  px-3 py-1.5 rounded-md text-sm font-sans font-medium
                  whitespace-nowrap z-50 pointer-events-none
                  transition-all duration-150
                  ${showTooltip ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}
                `}
                style={{
                  background: "var(--accent-primary)",
                  color: "white",
                }}
              >
                Synthesis of Infinite Games
                <span
                  className="absolute bottom-full left-1/2 -translate-x-1/2"
                  style={{
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderBottom: "6px solid var(--accent-primary)",
                  }}
                />
              </span>
            </span>
            <span
              className="font-serif text-xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Arena
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "var(--bg-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA Button */}
        <Link
          href="/ship"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: "var(--accent-primary)",
            color: "white",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-hover)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "var(--shadow-md)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent-primary)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span>Ship Your Agent</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded-lg"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
