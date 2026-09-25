import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Building,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCheck,
  FileText,
  HelpCircle,
  Home,
  IndianRupee,
  PhoneCall,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Know Your Options — Indian Legal Rights Guide" },
      {
        name: "description",
        content:
          "Practical guide to Indian legal rights: tenancy, employment non-compete, consumer disputes, cheque bounce, MSME payments and NALSA free legal aid.",
      },
    ],
  }),
  component: GuidePage,
});

type Dilemma = {
  id: string;
  category: "tenant" | "employee" | "consumer" | "financial" | "freelancer";
  title: string;
  situation: string;
  rights: string[];
  statutes: string[];
  actionSteps: string[];
  questionsForLawyer: string[];
};

const DILEMMAS: Dilemma[] = [
  {
    id: "tenant-deposit",
    category: "tenant",
    title: "Landlord Withholding Security Deposit for Painting & Wear-and-Tear",
    situation:
      "You vacated the apartment in clean condition, but the owner refuses to refund your deposit or is making arbitrary deductions for painting.",
    rights: [
      "Normal wear-and-tear is the landlord's asset expense under Transfer of Property Act 1882.",
      "The Model Tenancy Act 2021 caps residential security deposits at 2 months' rent and requires refund on handover.",
      "Arbitrary deductions without itemised contractor invoices and pre-handover proof are legally challengeable.",
    ],
    statutes: [
      "Model Tenancy Act 2021 (Section 11 & 13)",
      "Transfer of Property Act 1882 (Section 108)",
      "Consumer Protection Act 2019 (unfair trade practice)",
    ],
    actionSteps: [
      "Take timestamped photos and video of all walls, fixtures, and meters at the time of handing over keys.",
      "Send a written formal demand letter/email demanding refund within 14 days and requesting itemised repair receipts.",
      "If unresponsive, issue a formal legal notice through an advocate.",
      "File a grievance before the local Rent Authority or District Consumer Commission for deficiency in service.",
    ],
    questionsForLawyer: [
      "Should I file a consumer complaint or approach the Rent Authority in my city?",
      "Can I claim interest on the withheld deposit from the date of handover?",
    ],
  },
  {
    id: "tenant-inspection",
    category: "tenant",
    title: "Landlord Entering Without Notice or Threatening Eviction",
    situation:
      "Landlord visits the house unannounced or threatens immediate eviction / utility cut-off.",
    rights: [
      "Tenants have a statutory right to quiet enjoyment and privacy under Section 108 Transfer of Property Act.",
      "Landlord MUST provide at least 24 hours prior written notice before entering premises (Section 15 Model Tenancy Act).",
      "Cutting off electricity or water to force eviction is illegal under rent laws and actionable under criminal law (IPC/BNS).",
    ],
    statutes: [
      "Model Tenancy Act 2021 (Section 15 & 20)",
      "Transfer of Property Act 1882",
      "Constitution of India (Article 21 — Right to Privacy)",
    ],
    actionSteps: [
      "Notify the landlord in writing that unannounced visits violate your right to privacy and request 24h advance scheduling.",
      "If utilities are disconnected, lodge an immediate police complaint for wrongful restraint and file an urgent application before the Rent Authority.",
      "Do not vacate without formal due process of law.",
    ],
    questionsForLawyer: [
      "Can I get an immediate injunction from civil court restraining the landlord from illegal eviction?",
    ],
  },
  {
    id: "employee-noncompete",
    category: "employee",
    title: "Company Threatening to Enforce a 2-Year Non-Compete Clause",
    situation:
      "You received an offer from another firm, but your current employer claims you cannot join a competitor due to a non-compete clause.",
    rights: [
      "Post-employment non-compete clauses are completely VOID and unenforceable in India under Section 27 of the Indian Contract Act 1872.",
      "Indian Supreme Court (*Percept D'Mark v. Zaheer Khan*) affirmed that no employer can restrain an employee from exercising lawful trade post-resignation.",
      "Non-disclosure of genuine trade secrets is enforceable, but simply joining a rival company cannot be banned.",
    ],
    statutes: [
      "Indian Contract Act 1872 (Section 27 — Restraint of Trade Void)",
      "Supreme Court judgment: Percept D'Mark (India) Pvt. Ltd. v. Zaheer Khan (2006)",
      "Superintendence Company of India v. Krishan Murgai (1980)",
    ],
    actionSteps: [
      "Do not be intimidated by standard legal notices threatening non-compete enforcement.",
      "Ensure you return all company laptops, materials, and do not copy proprietary client databases.",
      "If the employer sends a legal notice, reply through an advocate citing Section 27 and Percept D'Mark precedent.",
    ],
    questionsForLawyer: [
      "Can the employer seek an ex-parte injunction against my new employer in civil court?",
      "How do I structure my reply to ensure my confidentiality compliance is clear?",
    ],
  },
  {
    id: "employee-relieving",
    category: "employee",
    title: "Employer Withholding Relieving Letter & Experience Certificate",
    situation:
      "You resigned and served notice, but the company refuses to issue your relieving letter over minor disputes.",
    rights: [
      "An employer cannot hold your relieving letter and experience certificate hostage to settle commercial or civil disputes.",
      "High Courts have recognized withholding service certificates as an unfair labor practice.",
    ],
    statutes: [
      "Industrial Disputes Act 1947",
      "State Shops and Commercial Establishments Act",
      "Payment of Gratuity Act 1972",
    ],
    actionSteps: [
      "Submit a written handover clearance signed by your direct manager and HR.",
      "Send a formal letter citing the completion of notice period and demanding relieving documents within 7 working days.",
      "File a complaint with the state Labour Commissioner or District Labour Court.",
    ],
    questionsForLawyer: [
      "Can I file a petition in High Court or approach the Labour Officer for immediate certificate issuance?",
    ],
  },
  {
    id: "cheque-bounce",
    category: "financial",
    title: "Received a Section 138 Cheque Bounce Notice",
    situation:
      "A cheque you issued bounced or an ECS/NACH debit failed, and you received an advocate notice demanding payment.",
    rights: [
      "Section 138 applies only if there was a legally enforceable debt or liability (not for security cheques without underlying debt).",
      "You have a strict 15-day statutory cure window from receipt of the notice to pay or respond.",
      "Criminal complaints must be filed within 30 days after the 15-day window expires.",
    ],
    statutes: [
      "Negotiable Instruments Act 1881 (Section 138, 139 & 142)",
      "Code of Criminal Procedure 1973",
    ],
    actionSteps: [
      "Note the exact date of receipt of the speed post / notice envelope (vital for the 15-day timeline).",
      "Consult an advocate immediately to draft a formal reply within 15 days.",
      "If the debt is valid, clearing the amount within 15 days completely protects you from criminal prosecution.",
      "Explore amicable settlement through Lok Adalat or court mediation.",
    ],
    questionsForLawyer: [
      "Does the complainant have documentary proof of the underlying legally enforceable liability?",
      "Was the statutory notice dispatched strictly within 30 days of the bank memo?",
    ],
  },
  {
    id: "msme-delayed-payment",
    category: "freelancer",
    title: "Client or Buyer Not Paying Invoices (MSME / Freelance)",
    situation:
      "You delivered services or goods, but the client is delaying payment beyond 45 days.",
    rights: [
      "Under Section 15 MSMED Act, buyers must pay within agreed dates, not exceeding 45 days.",
      "Under Section 16, delay attracts compound interest at 3x the RBI Bank Rate with monthly rests.",
      "You can file online without court fees on the MSME Samadhaan portal.",
    ],
    statutes: [
      "Micro, Small and Medium Enterprises Development (MSMED) Act 2006 (Sections 15, 16 & 18)",
      "Indian Contract Act 1872",
    ],
    actionSteps: [
      "Obtain an Udyam Registration (free online on udyamregistration.gov.in) if not already registered.",
      "Send a formal demand letter citing Section 15 & 16 of the MSMED Act and calculating 3x RBI bank rate interest.",
      "File a delayed payment case online at samadhaan.msme.gov.in.",
    ],
    questionsForLawyer: [
      "Can I refer the dispute to the Micro and Small Enterprise Facilitation Council (MSEFC)?",
    ],
  },
  {
    id: "consumer-ecommerce",
    category: "consumer",
    title: "Defective Product or Service Deficiency (Consumer Grievance)",
    situation:
      "A company delivered a defective product or cancelled a service without refund, and customer support is unresponsive.",
    rights: [
      "Right to replacement, full refund, and compensation for mental agony under Consumer Protection Act 2019.",
      "Unfair contract terms and misleading advertisements are punishable.",
      "Online filing available via e-Daakhil without hiring an advocate.",
    ],
    statutes: [
      "Consumer Protection Act 2019 (Section 2(46) unfair contracts, Section 35)",
      "Consumer Protection (E-Commerce) Rules 2020",
    ],
    actionSteps: [
      "Lodge a complaint on the National Consumer Helpline (NCH) portal (consumerhelpline.gov.in) or call 1915.",
      "Send a formal legal notice giving the company 15 days to refund and compensate.",
      "File an e-case on e-Daakhil (edaakhil.nic.in) before your District Consumer Commission.",
    ],
    questionsForLawyer: [
      "What compensation amount can I claim for harassment and deficiency in service?",
    ],
  },
];

function GuidePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDilemma, setActiveDilemma] = useState<Dilemma>(DILEMMAS[0]);

  const filteredDilemmas = DILEMMAS.filter((d) => {
    const matchesCat = selectedCategory === "all" || d.category === selectedCategory;
    const matchesQuery =
      !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.situation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.rights.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  return (
    <AppShell className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          <Scale className="size-3.5" /> Indian Legal Navigator
        </span>
        <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
          Know Your Legal Rights & Options
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Step-by-step guidance on how Indian laws protect tenants, employees, consumers, and small
          businesses. Find your dilemma, know your rights, and prepare for action.
        </p>
      </div>

      {/* Free Legal Aid Banner */}
      <div className="paper mb-8 overflow-hidden border-accent/40 bg-gradient-to-r from-accent/10 via-surface to-accent/5 p-6 shadow-paper">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PhoneCall className="size-5 text-accent" />
              <h3 className="font-display text-base font-bold text-foreground">
                Free Legal Aid in India (NALSA Helpline 15100)
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground max-w-2xl">
              Under the Legal Services Authorities Act 1987, free legal aid and representation is
              available through District Legal Services Authorities (DLSA) for women, children,
              scheduled castes/tribes, and low-income citizens across all Indian courts.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <a
              href="https://nalsa.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90"
            >
              NALSA Portal
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Categories & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All Topics" },
            { id: "tenant", label: "Tenants & Rent", icon: Home },
            { id: "employee", label: "Employees & Jobs", icon: Briefcase },
            { id: "consumer", label: "Consumers", icon: ShoppingBag },
            { id: "financial", label: "Loans & Cheques", icon: IndianRupee },
            { id: "freelancer", label: "MSME & Freelance", icon: Building },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search problems, laws, rights…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Main Dilemma Explorer Grid */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left List */}
        <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
          {filteredDilemmas.map((d) => {
            const isSelected = activeDilemma.id === d.id;
            return (
              <div
                key={d.id}
                onClick={() => setActiveDilemma(d)}
                className={`group cursor-pointer rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-accent bg-accent/5 shadow-paper"
                    : "paper hover:border-accent/40 hover:bg-surface/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`font-display text-sm font-bold leading-snug ${
                      isSelected ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {d.title}
                  </h3>
                  <ChevronRight
                    className={`size-4 shrink-0 transition-transform ${
                      isSelected ? "rotate-90 text-accent" : "text-muted-foreground opacity-60"
                    }`}
                  />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                  {d.situation}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Detail Pane */}
        {activeDilemma && (
          <div className="paper space-y-6 p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                  {activeDilemma.category.toUpperCase()}
                </span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground">
                {activeDilemma.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {activeDilemma.situation}
              </p>
            </div>

            {/* Your Rights */}
            <div className="rounded-xl border border-border/80 bg-surface/50 p-5">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <ShieldCheck className="size-5 text-accent" />
                <span>Your Rights under Indian Law</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {activeDilemma.rights.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-xs text-foreground leading-relaxed"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Applicable Indian Statutes & Judgments */}
            <div className="rounded-xl border border-border/80 bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Scale className="size-4 text-accent" />
                <span>Applicable Acts, Sections & Court Precedents</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeDilemma.statutes.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    📜 {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Steps */}
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Step-by-Step Action Plan
              </h3>
              <div className="mt-3 space-y-2.5">
                {activeDilemma.actionSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/30 p-3"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Questions to Ask an Advocate */}
            <div className="border-t border-border/80 pt-5">
              <h3 className="font-display text-base font-bold text-foreground">
                Questions to Ask an Advocate
              </h3>
              <ul className="mt-3 space-y-2">
                {activeDilemma.questionsForLawyer.map((q, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="font-bold text-accent">Q:</span>
                    <span className="text-foreground">{q}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="sm" className="gap-1.5">
                  <Link
                    to="/chat"
                    search={{
                      q: `Regarding ${activeDilemma.title}: ${activeDilemma.situation}`,
                    }}
                  >
                    <HelpCircle className="size-3.5" />
                    Ask Nyaya Mitra About This →
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/">Analyze your agreement</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
