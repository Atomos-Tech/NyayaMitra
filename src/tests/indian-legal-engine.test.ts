import test from "node:test";
import assert from "node:assert/strict";

import {
  answerIndianLegalQuery,
  analyzeIndianDocument,
  compareIndianDocuments,
} from "../lib/indian-legal-engine.ts";

test("Indian Legal Engine: Cheque Bounce (Section 138 NI Act)", () => {
  const reply = answerIndianLegalQuery("What can I do if a cheque bounced for insufficient funds?");
  assert.ok(reply.includes("138"), "Should cite Section 138 of Negotiable Instruments Act");
  assert.ok(reply.includes("30 days"), "Should mention the 30-day statutory notice period");
  assert.ok(reply.includes("15 days"), "Should mention the 15-day cure period for the drawer");
});

test("Indian Legal Engine: Tenancy Security Deposit Withholding", () => {
  const reply = answerIndianLegalQuery(
    "Can my landlord deduct 1 month rent for painting and wear and tear in Bangalore?",
  );
  assert.ok(
    reply.toLowerCase().includes("wear-and-tear") || reply.toLowerCase().includes("wear and tear"),
    "Should explain normal wear and tear obligations",
  );
  assert.ok(
    reply.includes("Model Tenancy Act") || reply.includes("Transfer of Property Act"),
    "Should cite relevant tenancy statutes",
  );
});

test("Indian Legal Engine: Post-Employment Non-Compete (Section 27 Contract Act)", () => {
  const reply = answerIndianLegalQuery(
    "My employer contract has a 2-year non-compete clause. Is it valid in India?",
  );
  assert.ok(reply.includes("Section 27"), "Should cite Section 27 of the Indian Contract Act 1872");
  assert.ok(
    reply.toLowerCase().includes("void") || reply.toLowerCase().includes("restraint of trade"),
    "Should clarify that post-employment non-competes are void as restraint of trade",
  );
});

test("Indian Legal Engine: MSME Delayed Payments (Section 16 MSMED Act 2006)", () => {
  const reply = answerIndianLegalQuery(
    "How much interest can an MSME claim for unpaid invoices under MSMED Act?",
  );
  assert.ok(reply.includes("MSMED"), "Should cite the MSMED Act");
  assert.ok(
    reply.toLowerCase().includes("three times") || reply.toLowerCase().includes("3 times"),
    "Should state 3 times RBI bank rate interest entitlement",
  );
  assert.ok(
    reply.includes("45 days"),
    "Should mention statutory maximum payment window of 45 days",
  );
});

test("Indian Legal Engine: Document Analysis Risk Detection", () => {
  const sampleAgreement = `
    EMPLOYMENT AGREEMENT
    1. Term: Employee agrees to a mandatory 3-year lock-in period. Leaving early incurs a penalty of Rs 5,00,000.
    2. Non-Compete: Employee shall not join any competing organization anywhere in India for 2 years post exit.
    3. Notice Period: Employer may terminate immediately with 0 days notice. Employee must give 90 days notice.
  `;

  const analysis = analyzeIndianDocument(sampleAgreement, "Employment Agreement", "Evaluate risks");
  assert.ok(analysis.risks.length >= 2, "Should identify at least 2 significant risks");

  const nonCompeteRisk = analysis.risks.find(
    (r) =>
      r.title.toLowerCase().includes("non-compete") ||
      r.explanation.toLowerCase().includes("section 27"),
  );
  assert.ok(nonCompeteRisk, "Should identify Section 27 non-compete risk");
  assert.equal(
    nonCompeteRisk?.severity,
    "high",
    "Non-compete clause should be marked high severity",
  );

  const noticeRisk = analysis.risks.find((r) => r.title.toLowerCase().includes("notice"));
  assert.ok(noticeRisk, "Should flag asymmetric notice period");
});

test("Indian Legal Engine: Document Comparison Contrast", () => {
  const docA = {
    title: "Draft 1 (Tenant Friendly)",
    text: "Security deposit shall be 2 months rent. Refundable within 7 days of vacation. Normal painting is landlord responsibility.",
  };
  const docB = {
    title: "Draft 2 (Landlord Friendly)",
    text: "Security deposit shall be 10 months rent. Landlord shall deduct full 1 month rent for painting regardless of wear and tear.",
  };

  const comparison = compareIndianDocuments(docA, docB, "Review tenancy terms");
  assert.ok(comparison.differences.length > 0, "Should detect differences between drafts");
  assert.ok(comparison.recommendation.length > 10, "Should provide actionable recommendation");
});
