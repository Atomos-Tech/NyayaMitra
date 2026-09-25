import test from "node:test";
import assert from "node:assert/strict";

import { parseJsonObject, normaliseAnalysis } from "../lib/legal-types.ts";

test("JSON Parser: Clean JSON parsing", () => {
  const raw = JSON.stringify({
    title: "Test Agreement",
    documentType: "Rent Agreement",
    plainSummary: ["Bullet 1", "Bullet 2"],
  });
  const res = parseJsonObject(raw);
  assert.equal(res.title, "Test Agreement");
  assert.equal(res.documentType, "Rent Agreement");
});

test("JSON Parser: Handles markdown code blocks and reasoning tags", () => {
  const raw = `<think>
I should generate the json object now.
{ "ignored": "inside reasoning" }
</think>
Here is the breakdown:
\`\`\`json
{
  "title": "Rental Deed",
  "documentType": "Residential Lease",
  "money": [{ "label": "Rent", "value": "₹20,000" }]
}
\`\`\`
Hope this helps!`;
  const res = parseJsonObject(raw);
  assert.equal(res.title, "Rental Deed");
  assert.equal(res.documentType, "Residential Lease");
});

test("JSON Parser: Repairs trailing commas and comments", () => {
  const raw = `{
    // Landlord agreement
    "title": "Vendor Contract",
    /* multi line comment */
    "parties": [
      { "name": "Party A", "role": "Vendor", },
    ],
  }`;
  const res = parseJsonObject(raw);
  assert.equal(res.title, "Vendor Contract");
  assert.ok(Array.isArray(res.parties));
});

test("JSON Parser: Repairs truncated JSON from token cutoff", () => {
  const raw = `{
    "title": "Employment Letter",
    "plainSummary": [
      "Job offer from Tech Corp",
      "Salary of 12 LPA"`;
  const res = parseJsonObject(raw);
  assert.equal(res.title, "Employment Letter");
  assert.ok(Array.isArray(res.plainSummary));
  assert.equal((res.plainSummary as string[])[0], "Job offer from Tech Corp");
});

test("JSON Parser: normaliseAnalysis falls back cleanly to Indian legal engine on unparseable garbage", () => {
  const garbage = "Sorry, as an AI language model I cannot analyze this file properly.";
  const fallbackText = "This is a rental agreement between Amit (Landlord) and Sumit (Tenant) with rent Rs 15000 and deposit Rs 50000.";
  const analysis = normaliseAnalysis(garbage, "Rental Agreement", fallbackText);
  assert.ok(analysis.money.length > 0, "Should extract money details using fallback engine");
  assert.ok(analysis.plainSummary.length > 0, "Should produce summary points");
  assert.equal(analysis.title, "Rental Agreement");
});
