import Link from "next/link";
import { Header, Footer } from "../../components";

export default function MarketNotFound() {
  return (
    <>
      <Header />
      
      <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center px-6 py-16">
          <p className="text-6xl mb-4">📊</p>
          <h1 
            className="font-serif text-3xl mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Market Not Found
          </h1>
          <p 
            className="text-lg mb-8"
            style={{ color: "var(--text-muted)" }}
          >
            This market doesn&apos;t exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium"
            style={{ 
              background: "var(--accent-primary)", 
              color: "white" 
            }}
          >
            ← Back to Markets
          </Link>
        </div>
      </main>
      
      <Footer />
    </>
  );
}
