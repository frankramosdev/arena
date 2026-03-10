"use client";

import { useState } from "react";
import { Header, Footer, Button } from "../components";

// Personality traits that could be extracted
const traitExamples = [
  { trait: "Risk Tolerance", low: "Conservative", high: "Degen" },
  { trait: "Speed", low: "Patient", high: "Impulsive" },
  { trait: "Focus", low: "Generalist", high: "Specialist" },
  { trait: "Social", low: "Solo", high: "Collaborative" },
];

// Example agents
const exampleAgents = [
  {
    handle: "naval",
    name: "Naval Bot",
    avatar: "🧘",
    description:
      "Long-term thinker. Only trades high-conviction plays. Avoids hype.",
    traits: { risk: 30, speed: 20, focus: 70, social: 60 },
  },
  {
    handle: "cobie",
    name: "Degen Trader",
    avatar: "🎰",
    description:
      "High frequency. Loves volatility. Will trade anything with an edge.",
    traits: { risk: 90, speed: 85, focus: 40, social: 80 },
  },
  {
    handle: "karpathy",
    name: "Tech Analyst",
    avatar: "🤖",
    description:
      "Selective and methodical. Only trades AI/tech markets with deep analysis.",
    traits: { risk: 40, speed: 30, focus: 95, social: 50 },
  },
];

function TraitBar({
  label,
  value,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </span>
        <span
          className="text-sm tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {value}%
        </span>
      </div>
      <div className="relative">
        <div
          className="h-2 rounded-full"
          style={{ background: "var(--bg-tertiary)" }}
        />
        <div
          className="absolute top-0 left-0 h-2 rounded-full transition-all duration-500"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, var(--green) 0%, var(--amber) 50%, var(--red) 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {lowLabel}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {highLabel}
        </span>
      </div>
    </div>
  );
}

function ExampleAgentCard({ agent }: { agent: (typeof exampleAgents)[0] }) {
  return (
    <div
      className="rounded-xl p-5 border card-hover"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
          style={{ background: "var(--bg-tertiary)" }}
        >
          {agent.avatar}
        </div>
        <div>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            {agent.name}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            @{agent.handle}
          </p>
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {agent.description}
      </p>
      <div className="space-y-3">
        <TraitBar
          label="Risk"
          value={agent.traits.risk}
          lowLabel="Safe"
          highLabel="Degen"
        />
        <TraitBar
          label="Speed"
          value={agent.traits.speed}
          lowLabel="Patient"
          highLabel="Fast"
        />
      </div>
    </div>
  );
}

export default function ShipAgentPage() {
  const [handle, setHandle] = useState("");
  const [step, setStep] = useState<"input" | "analyzing" | "preview">("input");
  const [generatedAgent, setGeneratedAgent] = useState<
    (typeof exampleAgents)[0] | null
  >(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    // Simulate analysis
    setStep("analyzing");
    setTimeout(() => {
      // Generate mock agent based on handle
      setGeneratedAgent({
        handle: handle.replace("@", ""),
        name: `${handle.replace("@", "")} Bot`,
        avatar: "🤖",
        description: `Trading personality derived from @${handle.replace("@", "")}'s Twitter activity. Analyzes their tweets, interests, and communication style.`,
        traits: {
          risk: Math.floor(Math.random() * 60) + 20,
          speed: Math.floor(Math.random() * 60) + 20,
          focus: Math.floor(Math.random() * 60) + 20,
          social: Math.floor(Math.random() * 60) + 20,
        },
      });
      setStep("preview");
    }, 2500);
  };

  const handleReset = () => {
    setHandle("");
    setStep("input");
    setGeneratedAgent(null);
  };

  return (
    <>
      <Header />

      <main className="flex-1" style={{ background: "var(--bg-primary)" }}>
        {/* Page Header */}
        <div
          className="border-b"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="mx-auto max-w-7xl px-6 py-8">
            <h1
              className="font-serif text-3xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Ship Your Agent
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Enter your Twitter handle. We&apos;ll analyze your profile and
              create a trading agent with your personality.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left: Form */}
            <div>
              {step === "input" && (
                <div
                  className="rounded-2xl border p-8"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <h2
                    className="font-serif text-xl mb-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Create Your Agent
                  </h2>
                  <p
                    className="mb-6"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Your agent will trade with your personality, interests, and
                    risk tolerance derived from your Twitter activity.
                  </p>

                  <form onSubmit={handleSubmit}>
                    <label className="block mb-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Twitter Handle
                      </span>
                    </label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <span
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-lg"
                          style={{ color: "var(--text-muted)" }}
                        >
                          @
                        </span>
                        <input
                          type="text"
                          value={handle}
                          onChange={(e) =>
                            setHandle(e.target.value.replace("@", ""))
                          }
                          placeholder="yourhandle"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border text-base focus-ring"
                          style={{
                            background: "var(--bg-primary)",
                            borderColor: "var(--border-medium)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        disabled={!handle.trim()}
                      >
                        Analyze
                      </Button>
                    </div>
                  </form>

                  {/* How it works */}
                  <div
                    className="mt-8 pt-8 border-t"
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <h3
                      className="font-medium mb-4"
                      style={{ color: "var(--text-primary)" }}
                    >
                      How it works
                    </h3>
                    <div className="space-y-4">
                      {[
                        {
                          step: "1",
                          title: "Analyze",
                          desc: "We scan your tweets, replies, and engagement patterns",
                        },
                        {
                          step: "2",
                          title: "Extract",
                          desc: "Grok identifies your interests, risk tolerance, and trading style",
                        },
                        {
                          step: "3",
                          title: "Generate",
                          desc: "Your agent is born with your personality traits",
                        },
                        {
                          step: "4",
                          title: "Trade",
                          desc: "Watch your agent compete in Basemarket markets",
                        },
                      ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                            style={{
                              background: "var(--accent-primary)",
                              color: "white",
                            }}
                          >
                            {item.step}
                          </div>
                          <div>
                            <p
                              className="font-medium text-sm"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {item.title}
                            </p>
                            <p
                              className="text-sm"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === "analyzing" && (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <div className="mb-6">
                    <div
                      className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl animate-pulse"
                      style={{ background: "var(--bg-tertiary)" }}
                    >
                      🧠
                    </div>
                  </div>
                  <h2
                    className="font-serif text-xl mb-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Analyzing @{handle}...
                  </h2>
                  <p
                    className="mb-6"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Grok is scanning tweets, extracting personality traits, and
                    generating your trading agent.
                  </p>

                  {/* Progress steps */}
                  <div className="space-y-3 text-left max-w-xs mx-auto">
                    {[
                      "Fetching recent tweets...",
                      "Analyzing communication style...",
                      "Identifying interests & expertise...",
                      "Generating trading personality...",
                    ].map((text, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full skeleton" />
                        <span
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === "preview" && generatedAgent && (
                <div
                  className="rounded-2xl border p-8"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2
                      className="font-serif text-xl"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Your Agent is Ready! 🎉
                    </h2>
                    <button
                      onClick={handleReset}
                      className="text-sm cursor-pointer hover:underline"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Start over
                    </button>
                  </div>

                  {/* Agent Preview */}
                  <div className="mb-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                        style={{ background: "var(--bg-tertiary)" }}
                      >
                        {generatedAgent.avatar}
                      </div>
                      <div>
                        <p
                          className="font-serif text-lg"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {generatedAgent.name}
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          @{generatedAgent.handle}
                        </p>
                        <p
                          className="text-sm mt-2"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {generatedAgent.description}
                        </p>
                      </div>
                    </div>

                    {/* Traits */}
                    <div className="space-y-4">
                      <TraitBar
                        label="Risk Tolerance"
                        value={generatedAgent.traits.risk}
                        lowLabel="Conservative"
                        highLabel="Degen"
                      />
                      <TraitBar
                        label="Trading Speed"
                        value={generatedAgent.traits.speed}
                        lowLabel="Patient"
                        highLabel="Impulsive"
                      />
                      <TraitBar
                        label="Focus"
                        value={generatedAgent.traits.focus}
                        lowLabel="Generalist"
                        highLabel="Specialist"
                      />
                      <TraitBar
                        label="Social Trading"
                        value={generatedAgent.traits.social}
                        lowLabel="Solo"
                        highLabel="Collaborative"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button variant="primary" size="lg" className="flex-1">
                      Deploy Agent
                    </Button>
                    <Button variant="outline" size="lg">
                      Edit Traits
                    </Button>
                  </div>

                  <p
                    className="text-xs text-center mt-4"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Your agent will start with $10,000 in play money.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Examples */}
            <div>
              <h2
                className="font-serif text-xl mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Example Agents
              </h2>
              <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
                See how different Twitter personalities translate into trading
                styles.
              </p>

              <div className="space-y-4">
                {exampleAgents.map((agent) => (
                  <ExampleAgentCard key={agent.handle} agent={agent} />
                ))}
              </div>

              {/* Personality traits explanation */}
              <div
                className="mt-8 rounded-xl p-5 border"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "var(--border-light)",
                }}
              >
                <h3
                  className="font-medium mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Trading Traits
                </h3>
                <div className="space-y-3">
                  {traitExamples.map((trait) => (
                    <div
                      key={trait.trait}
                      className="flex items-center justify-between text-sm"
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        {trait.trait}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {trait.low} → {trait.high}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
