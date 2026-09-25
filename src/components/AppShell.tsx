import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Scale, Sparkles } from "lucide-react";

import logo from "@/assets/nyaya-logo.png";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Documents" },
  { to: "/compare", label: "Compare" },
  { to: "/chat", label: "Ask" },
  { to: "/guide", label: "Know your options" },
];

export function AppShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Nyaya Mitra Logo"
              width={38}
              height={38}
              className="size-9.5 rounded-lg object-contain shadow-xs"
            />
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold text-foreground">
                Nyaya Mitra
              </span>
              <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Legal documents, in plain words
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}

            <div className="ml-2 hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent border border-accent/20">
              <Sparkles className="size-3 text-accent" />
              <span>AI Powered</span>
            </div>
          </nav>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-8", className)}>{children}</main>

      <footer className="border-t border-border/80 bg-surface/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Information, not legal advice.</strong> Nyaya Mitra
            explains documents and helps you prepare. It is not a law firm and does not represent
            you. For notices, court dates, eviction, arrest or money at real risk, speak to an
            advocate. Free help is available through District Legal Services Authorities (NALSA
            helpline 15100).
          </p>
          <p className="mt-2">
            Your documents and conversations stay in this browser only. Clearing site data removes
            them.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function SeverityPill({ level }: { level: "high" | "medium" | "low" }) {
  const label = level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        level === "high" && "bg-high text-high-foreground",
        level === "medium" && "bg-medium text-medium-foreground",
        level === "low" && "bg-low text-low-foreground",
      )}
    >
      {label}
    </span>
  );
}
