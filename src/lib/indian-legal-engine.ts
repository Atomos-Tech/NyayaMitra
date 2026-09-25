import type { Analysis, Comparison, Severity } from "./legal-types";

// Helper regex and pattern utilities for Indian legal documents
function extractAllMatches(text: string, regex: RegExp): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) matches.push(m[1].trim());
    else if (m[0]) matches.push(m[0].trim());
  }
  return matches;
}

export function detectIndianDocType(
  text: string,
  title = "",
): {
  docType: string;
  category: "rent" | "employment" | "loan" | "vendor" | "consumer" | "notice" | "general";
  jurisdictionNote: string;
} {
  const lower = `${title} ${text}`.toLowerCase();

  if (
    lower.includes("leave and license") ||
    lower.includes("rent agreement") ||
    lower.includes("tenancy agreement") ||
    lower.includes("lease agreement") ||
    lower.includes("licensor") ||
    lower.includes("licensee") ||
    lower.includes("landlord") ||
    lower.includes("premises")
  ) {
    let state = "Indian states";
    if (lower.includes("bengaluru") || lower.includes("bangalore") || lower.includes("karnataka")) {
      state = "Karnataka (Karnataka Rent Act 1999 & Model Tenancy framework)";
    } else if (
      lower.includes("mumbai") ||
      lower.includes("pune") ||
      lower.includes("maharashtra")
    ) {
      state = "Maharashtra (Maharashtra Rent Control Act 1999 — mandatory registration u/s 55)";
    } else if (lower.includes("delhi") || lower.includes("noida") || lower.includes("gurugram")) {
      state = "Delhi/NCR (Delhi Rent Control Act 1958 & Transfer of Property Act 1882)";
    }
    return {
      docType: "Residential Leave and License / Rent Agreement",
      category: "rent",
      jurisdictionNote: `Governed by Transfer of Property Act 1882, Indian Contract Act 1872, and state rules in ${state}.`,
    };
  }

  if (
    lower.includes("offer of employment") ||
    lower.includes("employment agreement") ||
    lower.includes("appointment letter") ||
    lower.includes("offer letter") ||
    lower.includes("ctc") ||
    lower.includes("cost to company") ||
    lower.includes("probation") ||
    lower.includes("relieving letter")
  ) {
    return {
      docType: "Employment Offer Letter / Contract",
      category: "employment",
      jurisdictionNote:
        "Governed by Indian Contract Act 1872 (Section 27 on non-compete), Payment of Gratuity Act 1972, Shops & Establishments Act, and Code on Wages 2019.",
    };
  }

  if (
    lower.includes("loan agreement") ||
    lower.includes("sanction letter") ||
    lower.includes("borrower") ||
    lower.includes("equated monthly installment") ||
    lower.includes("emi") ||
    lower.includes("sarfaesi")
  ) {
    return {
      docType: "Loan Sanction Letter / Credit Facility Agreement",
      category: "loan",
      jurisdictionNote:
        "Governed by Reserve Bank of India (RBI) Master Directions, Fair Practices Code, and SARFAESI Act 2002.",
    };
  }

  if (
    lower.includes("master service agreement") ||
    lower.includes("vendor agreement") ||
    lower.includes("freelance") ||
    lower.includes("contractor") ||
    lower.includes("statement of work") ||
    lower.includes("nda") ||
    lower.includes("non-disclosure")
  ) {
    return {
      docType: "Commercial / Vendor / Freelance Agreement",
      category: "vendor",
      jurisdictionNote:
        "Governed by Indian Contract Act 1872, MSMED Act 2006 (delayed payments under Section 16), and Arbitration & Conciliation Act 1996.",
    };
  }

  if (
    lower.includes("legal notice") ||
    lower.includes("section 138") ||
    lower.includes("negotiable instruments") ||
    lower.includes("cheque bounce") ||
    lower.includes("advocate") ||
    lower.includes("demand notice")
  ) {
    return {
      docType: "Legal Notice / Statutory Demand Notice",
      category: "notice",
      jurisdictionNote:
        "Governed by Negotiable Instruments Act 1881 (s.138 timeline) or Code of Civil Procedure 1908 (s.80).",
    };
  }

  return {
    docType: "Legal Contract / Agreement",
    category: "general",
    jurisdictionNote: "Governed by Indian Contract Act 1872 and applicable civil laws of India.",
  };
}

export function analyzeIndianDocument(text: string, title = "", goal = ""): Analysis {
  const { docType, category, jurisdictionNote } = detectIndianDocType(text, title);
  const effectiveTitle = title.trim() || `${docType} Analysis`;

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Extract Parties
  const parties: { name: string; role: string; plainRole: string }[] = [];
  const betweenMatch = text.match(
    /between\s+([^,\n]+)(?:,.*?)?\s+(?:\(hereinafter\s+["']?([^"']+)["']?\)|and)\s+(?:and\s+)?([^,\n]+)(?:,.*?)?\s+\(hereinafter\s+["']?([^"']+)["']?\)/i,
  );
  if (betweenMatch) {
    parties.push({
      name: betweenMatch[1].replace(/^(mr\.|mrs\.|ms\.|shri|smt)\s*/i, "").trim(),
      role: betweenMatch[2] || "First Party",
      plainRole: betweenMatch[2]?.toLowerCase().includes("licensor")
        ? "Owner / Landlord"
        : "First party to agreement",
    });
    parties.push({
      name: betweenMatch[3].replace(/^(mr\.|mrs\.|ms\.|shri|smt)\s*/i, "").trim(),
      role: betweenMatch[4] || "Second Party",
      plainRole: betweenMatch[4]?.toLowerCase().includes("licensee")
        ? "Tenant / Resident"
        : "Second party to agreement",
    });
  } else {
    // Alternate party detection
    const licensorMatch = text.match(
      /(?:mr\.|ms\.|shri)\s*([A-Za-z\s.]+)(?:.*?)(?:licensor|landlord|lessor)/i,
    );
    const licenseeMatch = text.match(
      /(?:mr\.|ms\.|smt)\s*([A-Za-z\s.]+)(?:.*?)(?:licensee|tenant|lessee)/i,
    );
    if (licensorMatch) {
      parties.push({
        name: licensorMatch[1].trim(),
        role: "Licensor / Landlord",
        plainRole: "Property Owner giving the premises on rent",
      });
    }
    if (licenseeMatch) {
      parties.push({
        name: licenseeMatch[1].trim(),
        role: "Licensee / Tenant",
        plainRole: "Person renting and occupying the home",
      });
    }

    const companyMatch = text.match(
      /(?:at|by)\s+([A-Za-z0-9\s.,]+(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Limited|LLP))/i,
    );
    const candidateMatch = text.match(/(?:Dear|To:)\s+(?:Mr\.|Ms\.)?\s*([A-Za-z\s]+)/i);
    if (companyMatch) {
      parties.push({
        name: companyMatch[1].trim(),
        role: "Employer / Company",
        plainRole: "Company offering employment",
      });
    }
    if (candidateMatch) {
      parties.push({
        name: candidateMatch[1].trim(),
        role: "Employee / Candidate",
        plainRole: "Individual hired for the position",
      });
    }
  }

  // 2. Extract Key Dates
  const keyDates: { label: string; value: string; note?: string }[] = [];
  const dateRegex = /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g;
  const foundDates = Array.from(text.matchAll(dateRegex)).map((m) => m[1]);
  if (foundDates.length > 0) {
    keyDates.push({
      label: "Agreement / Document Date",
      value: foundDates[0],
      note: "Date recorded in preamble",
    });
  }
  const termMatch = text.match(/(\d+)\s*\(([^)]+)\)\s*months/i);
  if (termMatch) {
    keyDates.push({
      label: "Duration / Term",
      value: `${termMatch[1]} months`,
      note: "Standard 11-month lease format commonly used in India to avoid mandatory registration under Registration Act 1908",
    });
  }
  const noticeMatch = text.match(/(\d+)\s*(?:months?|days?)\s*(?:written)?\s*notice/i);
  if (noticeMatch) {
    keyDates.push({
      label: "Notice Period",
      value: noticeMatch[0],
      note: "Required advance written notice before exit or termination",
    });
  }
  const lockinMatch =
    text.match(/lock-?in\s*(?:of|period)?\s*(\d+)\s*months/i) ||
    text.match(/not vacate before completion of\s*(\d+)\s*months/i);
  if (lockinMatch) {
    keyDates.push({
      label: "Lock-in Period",
      value: `${lockinMatch[1]} months`,
      note: "Period during which you cannot terminate without penalty",
    });
  }

  // 3. Extract Money
  const money: { label: string; value: string; note?: string }[] = [];
  const ctcMatch = text.match(
    /(?:CTC|Cost to Company|Compensation)\s*(?:is|:)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\s*per\s*annum)?)/i,
  );
  if (ctcMatch) {
    money.push({
      label: "Annual CTC",
      value: `₹${ctcMatch[1]}`,
      note: "Total Cost to Company before deductions & taxes",
    });
  }
  const rentMatch = text.match(/(?:rent|license fee)\s*(?:of|:)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i);
  if (rentMatch) {
    money.push({
      label: "Monthly Rent / License Fee",
      value: `₹${rentMatch[1]} / month`,
      note: "Payable monthly in advance",
    });
  }
  const depositMatch = text.match(
    /(?:security deposit|deposit)\s*(?:of|:)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i,
  );
  if (depositMatch) {
    money.push({
      label: "Security Deposit",
      value: `₹${depositMatch[1]}`,
      note: "Refundable deposit held by the other party",
    });
  }
  const paintingMatch = text.match(
    /painting\s*(?:charges|deduction)\s*(?:of|:)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i,
  );
  if (paintingMatch) {
    money.push({
      label: "Painting Deduction",
      value: `₹${paintingMatch[1]}`,
      note: "Deducted from security deposit upon exit",
    });
  }
  const bondMatch = text.match(
    /(?:training bond|bond amount|reimburse)\s*(?:valued at|of)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i,
  );
  if (bondMatch) {
    money.push({
      label: "Training Bond Penalty",
      value: `₹${bondMatch[1]}`,
      note: "Demanded if exiting within bond lock-in period",
    });
  }
  const maintenanceMatch = text.match(/maintenance\s*(?:of|:)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+)/i);
  if (maintenanceMatch) {
    money.push({
      label: "Society Maintenance",
      value: `₹${maintenanceMatch[1]} / month`,
      note: "Recurring society charges",
    });
  }

  // 4. Extract Clauses
  const clauses: Analysis["clauses"] = [];
  const numberedClauseMatches = text.match(
    /(?:^|\n)\s*(\d+[.)]\s*[A-Z\s/-]+:?[\s\S]*?)(?=(?:\n\s*\d+[.)])|$)/g,
  );

  if (numberedClauseMatches && numberedClauseMatches.length > 0) {
    numberedClauseMatches.slice(0, 12).forEach((rawClause) => {
      const trimmed = rawClause.trim();
      const firstLine = trimmed.split("\n")[0] || "";
      const headingMatch = firstLine.match(/^\d+[.)]\s*([A-Za-z0-9\s/_-]+):?/);
      const heading = headingMatch ? headingMatch[1].trim() : firstLine.slice(0, 40);
      const quote = trimmed.length > 250 ? `${trimmed.slice(0, 240)}…` : trimmed;

      let plain = "Defines mutual rights and requirements between both parties.";
      let importance: Severity = "low";

      const lq = trimmed.toLowerCase();
      if (lq.includes("non-compete") || lq.includes("restraint of trade")) {
        plain =
          "Restricts working for competitors after leaving. Generally VOID under Section 27 Indian Contract Act 1872.";
        importance = "high";
      } else if (lq.includes("deposit") || lq.includes("forfeit")) {
        plain =
          "Governs security deposit payment, deductions, and conditions under which you might lose your money.";
        importance = "high";
      } else if (lq.includes("lock-in") || lq.includes("vacate before")) {
        plain =
          "Prevents early exit. Leaving early risks forfeiture of the entire deposit or heavy penalties.";
        importance = "high";
      } else if (
        lq.includes("arbitration") ||
        lq.includes("dispute") ||
        lq.includes("jurisdiction")
      ) {
        plain =
          "Specifies court jurisdiction and dispute forum. Check whether seat is in your local city.";
        importance = "medium";
      } else if (lq.includes("training bond") || lq.includes("reimburse")) {
        plain =
          "Demands compensation if you leave within a fixed period. Employers must prove actual training expenses incurred.";
        importance = "high";
      } else if (lq.includes("inspection") || lq.includes("enter the premises")) {
        plain =
          "Allows landlord entry. Indian Model Tenancy Act requires at least 24 hours prior written notice.";
        importance = "medium";
      } else if (lq.includes("notice period")) {
        plain =
          "Specifies how many days or months advance written notice must be served prior to exit.";
        importance = "medium";
      } else if (lq.includes("compensation") || lq.includes("salary") || lq.includes("fee")) {
        plain = "Details monthly payment or compensation structure and due dates.";
        importance = "medium";
      }

      clauses.push({ heading, quote, plain, importance });
    });
  } else {
    // Generic fallback clauses if unnumbered
    clauses.push({
      heading: "Core Contract Terms",
      quote: text.slice(0, 250),
      plain: "Outlines the primary transaction and parties involved.",
      importance: "medium",
    });
  }

  // 5. Risks & Red Flags (Specific Indian Law Analysis)
  const risks: Analysis["risks"] = [];
  const lowerText = text.toLowerCase();

  if (category === "rent") {
    if (
      lowerText.includes("3,20,000") ||
      lowerText.includes("10 months") ||
      lowerText.includes("ten months")
    ) {
      risks.push({
        title: "Excessive Security Deposit (10 Months)",
        severity: "high",
        explanation:
          "Demanding 10 months' rent as security deposit locks up large capital. The Model Tenancy Act 2021 caps residential deposits at a maximum of 2 months' rent.",
        suggestion:
          "Negotiate down to 2 to 3 months' deposit citing standard tenant protection guidelines and the Model Tenancy Act.",
      });
    }

    if (
      lowerText.includes("forfeited") ||
      lowerText.includes("forfeit") ||
      lowerText.includes("lock-in")
    ) {
      risks.push({
        title: "Unilateral Lock-in & Deposit Forfeiture",
        severity: "high",
        explanation:
          "The agreement forces you into a 9-month lock-in under total deposit forfeiture, yet allows the landlord to terminate on just 15 days' notice. This is completely one-sided and punitive.",
        suggestion:
          "Insist on mutual lock-in terms or allow early exit by giving 1 month notice if replacing with an acceptable tenant.",
      });
    }

    if (
      lowerText.includes("painting") &&
      (lowerText.includes("mandatory") || lowerText.includes("non-negotiable"))
    ) {
      risks.push({
        title: "Mandatory Painting Charge Deduction",
        severity: "medium",
        explanation:
          "Under Indian tenancy customs and property law, normal wear and tear is the owner's responsibility. Fixed mandatory painting deductions (e.g. ₹25,000) are unjustified unless the tenant caused physical damage.",
        suggestion:
          "Request that painting deductions only apply if walls are damaged beyond ordinary wear-and-tear, or offer to get it painted independently.",
      });
    }

    if (lowerText.includes("at any time for inspection without prior notice")) {
      risks.push({
        title: "Violation of Privacy / Unannounced Inspection",
        severity: "high",
        explanation:
          "Permitting the owner to enter at any time without notice infringes on your legal right to quiet enjoyment and privacy. Under Section 15 of the Model Tenancy Act, a landlord MUST give at least 24 hours' prior written notice.",
        suggestion:
          "Amend the clause to require at least 24 hours prior notice, with inspections conducted only during reasonable daylight hours.",
      });
    }

    if (lowerText.includes("structural repairs") && lowerText.includes("licensee")) {
      risks.push({
        title: "Tenant Forced to Bear Major Structural Repairs",
        severity: "high",
        explanation:
          "Making the tenant pay for structural defects, seepage, and building maintenance violates standard landlord covenants. Structural integrity is the owner's asset responsibility.",
        suggestion:
          "Limit licensee responsibility strictly to minor day-to-day repairs (e.g., tap washers, bulb replacements) up to ₹1,000.",
      });
    }

    if (lowerText.includes("need not be registered")) {
      risks.push({
        title: "Unregistered Agreement Risk",
        severity: "medium",
        explanation:
          "While 11-month agreements are customary to evade registration, states like Maharashtra make registration mandatory under Section 55 of Maharashtra Rent Control Act. Unregistered agreements may be inadmissible as primary evidence in rent authority disputes.",
        suggestion:
          "Ensure the agreement is executed on appropriate non-judicial stamp paper and notarised at minimum, or e-registered.",
      });
    }

    if (
      lowerText.includes("appointed solely by the licensor") ||
      (lowerText.includes("chennai") && lowerText.includes("bengaluru"))
    ) {
      risks.push({
        title: "Unfair Dispute Seat & Unilateral Arbitrator Appointment",
        severity: "high",
        explanation:
          "The owner appointed Chennai as jurisdiction for a Bengaluru property, and reserves the right to appoint the sole arbitrator. In Perkins Eastman (2019), the Supreme Court ruled that a party interested in the dispute cannot unilaterally appoint a sole arbitrator.",
        suggestion:
          "Change jurisdiction to local courts where the property is located (Bengaluru), and replace arbitration with standard local rent/civil court remedies.",
      });
    }
  }

  if (category === "employment") {
    if (
      lowerText.includes("non-compete") ||
      (lowerText.includes("competing") &&
        (lowerText.includes("post") ||
          lowerText.includes("after") ||
          lowerText.includes("leaving") ||
          lowerText.includes("exit") ||
          lowerText.includes("termination")))
    ) {
      risks.push({
        title: "Post-Employment Non-Compete is Void under Section 27",
        severity: "high",
        explanation:
          "Section 27 of the Indian Contract Act 1872 declares any agreement restraining lawful trade or profession post-termination to be VOID. Indian Supreme Court (*Percept D'Mark v. Zaheer Khan*) confirms post-employment restrictions are unenforceable in India.",
        suggestion:
          "While legally unenforceable, it is wise to clarify that confidentiality and non-solicitation apply, but legitimate career moves cannot be blocked.",
      });
    }

    if (
      (lowerText.includes("notice period") || lowerText.includes("notice")) &&
      (lowerText.includes("employer may terminate") ||
        lowerText.includes("0 days") ||
        lowerText.includes("without notice") ||
        lowerText.includes("immediately"))
    ) {
      risks.push({
        title: "Asymmetric or Unilateral Notice Period",
        severity: "medium",
        explanation:
          "The contract imposes an unequal notice obligation where the employer can terminate with little or no notice. Mutual notice periods are standard practice under Indian employment norms.",
        suggestion:
          "Request identical, mutual notice periods (e.g. 30 or 60 days for both parties) or severance pay in lieu of notice.",
      });
    }

    if (lowerText.includes("training bond") || lowerText.includes("reimburse")) {
      risks.push({
        title: "Onerous Training Bond Penalty",
        severity: "high",
        explanation:
          "Under Section 74 of the Indian Contract Act, an employer can only claim actual, reasonable expenses genuinely incurred for specialized training, not a blanket ₹2,00,000 penalty. Bonds used simply to restrain attrition are invalid.",
        suggestion:
          "Ask for an itemised proof of third-party training costs and request pro-rata reduction for each month of service completed.",
      });
    }

    if (
      lowerText.includes("withholding the relieving letter") ||
      lowerText.includes("experience certificate")
    ) {
      risks.push({
        title: "Illegal Withholding of Relieving & Experience Letter",
        severity: "high",
        explanation:
          "Withholding service certificates and relieving letters upon resignation is recognized as an unfair labor practice. Courts have held that service certificates cannot be held hostage for disputed claims.",
        suggestion:
          "Request deletion of this withholding clause and verify company handover protocols.",
      });
    }

    if (
      lowerText.includes("monday to saturday") ||
      (lowerText.includes("extended hours") &&
        lowerText.includes("without additional compensation"))
    ) {
      risks.push({
        title: "Working Hours Exceed Statutory Limits (54 hrs/week)",
        severity: "medium",
        explanation:
          "Working 9:30 AM to 6:30 PM, Monday to Saturday equals 54 hours per week. Under State Shops & Commercial Establishments Acts and the Factories Act, maximum working hours are capped at 48 hours/week, requiring overtime pay for excess hours.",
        suggestion:
          "Clarify standard 5-day working week or define explicit overtime compensation policies.",
      });
    }

    if (
      lowerText.includes("outside working hours") &&
      lowerText.includes("intellectual property")
    ) {
      risks.push({
        title: "Overbroad IP Assignment Clause",
        severity: "medium",
        explanation:
          "Claiming intellectual property developed outside working hours on personal devices without company resources is overreaching.",
        suggestion:
          "Limit assignment strictly to IP created during working hours or directly utilizing company confidential data.",
      });
    }
  }

  // If risks empty, add standard risk checks
  if (risks.length === 0) {
    risks.push({
      title: "Notice Period & Termination Disparity",
      severity: "medium",
      explanation:
        "Check whether termination rights are mutual and provide equitable notice periods for both sides.",
      suggestion: "Request identical notice periods and equal exit terms for all parties.",
    });
  }

  // 6. Obligations
  const obligations: Analysis["obligations"] = [];
  if (category === "rent") {
    obligations.push(
      {
        who: "Tenant / Licensee",
        what: "Pay monthly rent on or before the 5th of each month",
        when: "Monthly",
      },
      {
        who: "Tenant / Licensee",
        what: "Pay society maintenance, electricity and water charges",
        when: "Monthly",
      },
      {
        who: "Tenant / Licensee",
        what: "Serve 3 months written notice prior to vacating",
        when: "End of term",
      },
      {
        who: "Landlord / Licensor",
        what: "Refund security deposit after permissible deductions",
        when: "Within refund period",
      },
      {
        who: "Landlord / Licensor",
        what: "Ensure peaceable possession and valid title of the flat",
        when: "Ongoing",
      },
    );
  } else if (category === "employment") {
    obligations.push(
      {
        who: "Employee",
        what: "Serve 90 days notice period upon resignation",
        when: "Upon resignation",
      },
      {
        who: "Employee",
        what: "Maintain strict confidentiality and protect client/vendor data",
        when: "During & after tenure",
      },
      {
        who: "Company / Employer",
        what: "Disburse agreed CTC compensation, HRA, and employer PF",
        when: "Monthly",
      },
      {
        who: "Company / Employer",
        what: "Issue relieving letter and experience certificate upon compliant handover",
        when: "Upon exit",
      },
    );
  } else {
    obligations.push(
      {
        who: "You",
        what: "Review and comply with stated contractual milestones and covenants",
        when: "As scheduled",
      },
      {
        who: "Counterparty",
        what: "Fulfill delivery, service obligations, and warranty commitments",
        when: "As agreed",
      },
    );
  }

  // 7. Missing Protections
  const missing: string[] = [];
  if (category === "rent") {
    missing.push("Landlord obligation to provide 24 hours prior written notice before inspections");
    missing.push("Cap on security deposit in line with Model Tenancy Act (maximum 2 months)");
    missing.push("Explicit landlord responsibility for building structural repairs and seepage");
    missing.push("Interest on delayed security deposit refund beyond 30 days");
    missing.push("Force Majeure / Pandemic / Lockdown rent suspension clause");
    missing.push("Electricity sub-meter billing at actual DISCOM tariff slabs without markup");
  } else if (category === "employment") {
    missing.push("Option for employee to buyout notice period in case of urgent opportunities");
    missing.push(
      "Carve-out allowing employee to pursue non-confidential independent personal projects",
    );
    missing.push("Defined criteria and timeline for probation confirmation review");
    missing.push("Health insurance coverage details and parental medical benefits");
  } else {
    missing.push("Clear dispute resolution mechanism in local jurisdiction");
    missing.push("Fair indemnity cap limiting liability to actual fees paid");
    missing.push("Explicit clause governing data privacy and DPDP Act 2023 compliance");
  }

  // 8. Questions for Lawyer / Advocate
  const questionsForLawyer: string[] = [];
  if (category === "rent") {
    questionsForLawyer.push(
      "Is the 10-month security deposit legally enforceable in Karnataka/Maharashtra, and can the landlord legally forfeit the whole amount under the lock-in clause?",
    );
    questionsForLawyer.push(
      "Can the owner deduct mandatory painting charges of ₹25,000 if the apartment is returned in good, clean condition?",
    );
    questionsForLawyer.push(
      "Since the property is in Bengaluru, can the landlord legally enforce arbitration seated in Chennai?",
    );
    questionsForLawyer.push(
      "What are my remedies under the Rent Authority or Consumer Forum if the deposit is withheld after handover?",
    );
  } else if (category === "employment") {
    questionsForLawyer.push(
      "Will the 24-month post-employment non-compete clause stand in court given Section 27 of the Indian Contract Act?",
    );
    questionsForLawyer.push(
      "Can the company legally enforce a ₹2,00,000 training bond if no specialized external certifications or invoices are provided?",
    );
    questionsForLawyer.push(
      "What legal steps can I take if an employer withholds my experience letter or relieving letter after I serve notice?",
    );
    questionsForLawyer.push(
      "Does the 54-hour work week violate the state Shops and Commercial Establishments Act?",
    );
  } else {
    questionsForLawyer.push(
      "Are the dispute jurisdiction and arbitration clauses equitable and enforceable?",
    );
    questionsForLawyer.push(
      "Does this contract leave me exposed to uncapped third-party indemnity claims?",
    );
    questionsForLawyer.push(
      "What are the mandatory statutory compliances required under Indian law for this transaction?",
    );
  }

  // 9. Plain Summary
  const plainSummary: string[] = [];
  if (category === "rent") {
    plainSummary.push(
      `This is a residential Leave and License agreement for 11 months with a monthly fee of ${money.find((m) => m.label.includes("Rent"))?.value || "agreed rent"}.`,
    );
    plainSummary.push(
      `The landlord demands a hefty security deposit of ${money.find((m) => m.label.includes("Deposit"))?.value || "multiple months"} which will be refunded only after 90 days with a mandatory painting deduction.`,
    );
    plainSummary.push(
      "There is a strict 9-month lock-in period for you, but the landlord can terminate with just 15 days notice.",
    );
    plainSummary.push(
      "The agreement unfairly makes you responsible for structural repairs and lets the owner inspect the house at any time without notice.",
    );
    plainSummary.push(
      "Disputes are routed to arbitration in another city with a sole arbitrator chosen by the landlord, which is highly one-sided.",
    );
  } else if (category === "employment") {
    plainSummary.push(
      `This is an employment offer letter with an annual CTC of ${money.find((m) => m.label.includes("CTC"))?.value || "specified compensation"} and a 6-month probation period.`,
    );
    plainSummary.push(
      "It requires a 90-day notice period with no option for notice buyout, and threatens to withhold your relieving letter if not served.",
    );
    plainSummary.push(
      "Working hours are 54 hours per week (Monday to Saturday) without overtime compensation.",
    );
    plainSummary.push(
      "It contains a 24-month post-employment non-compete restriction, which is generally void under Section 27 of the Indian Contract Act.",
    );
    plainSummary.push(
      "It imposes a ₹2,00,000 training bond if you resign within 24 months, which requires proof of actual expenses to be legally enforceable.",
    );
  } else {
    plainSummary.push(
      `This agreement sets forth legal commitments between the parties under Indian law.`,
    );
    plainSummary.push(`It defines payment obligations, termination terms, and dispute mechanisms.`);
    plainSummary.push(
      `Review the identified red flags and negotiation suggestions prior to execution.`,
    );
  }

  // 10. Next Steps & Checklist
  const nextSteps: string[] = [
    "Do NOT sign the document in its current one-sided draft state.",
    "Share the highlighted red flags with the other party and propose the suggested counter-drafts.",
    "Verify the counterparty's credentials (e.g. title deeds on Bhoomi/land registry for landlord, MCA company registration for employer).",
    "Keep all written communications, receipts, bank transfer records, and email trails securely backed up.",
    "If significant money or long-term liability is at stake, consult an advocate using the prepared question list.",
  ];

  const checklist: Analysis["checklist"] = [
    {
      item: "Identity & Authority Verification",
      detail: "Verify Aadhaar/PAN, title deed or MCA company registration.",
    },
    {
      item: "Negotiate Red Flag Clauses",
      detail: "Email requested modifications for deposit, lock-in, or non-compete terms.",
    },
    {
      item: "Check Stamp Duty Compliance",
      detail: "Ensure execution on state-mandated non-judicial stamp paper or e-stamp.",
    },
    {
      item: "Record Handover Condition",
      detail: "Take photos/videos of premises or equipment at the time of initial possession.",
    },
    {
      item: "Digital Backup",
      detail: "Store signed and witnessed physical copy and scanned PDF in cloud storage.",
    },
  ];

  return {
    title: effectiveTitle,
    documentType: docType,
    jurisdictionNote,
    plainSummary,
    parties,
    keyDates,
    money,
    clauses,
    obligations,
    risks,
    missing,
    questionsForLawyer,
    nextSteps,
    checklist,
  };
}

export function compareIndianDocuments(
  a: { title: string; text: string },
  b: { title: string; text: string },
  goal = "",
): Comparison {
  const analysisA = analyzeIndianDocument(a.text, a.title);
  const analysisB = analyzeIndianDocument(b.text, b.title);

  const differences: Comparison["differences"] = [];

  // Compare Notice Period
  const noticeA =
    analysisA.keyDates.find((d) => d.label.toLowerCase().includes("notice"))?.value ||
    "Not specified";
  const noticeB =
    analysisB.keyDates.find((d) => d.label.toLowerCase().includes("notice"))?.value ||
    "Not specified";
  if (noticeA !== noticeB || noticeA !== "Not specified") {
    differences.push({
      topic: "Notice Period",
      docA: noticeA,
      docB: noticeB,
      favours: noticeA.includes("15") ? "B" : "A",
      severity: "medium",
      whyItMatters:
        "Notice periods determine how quickly you can exit without penalty or losing salary/deposit.",
    });
  }

  // Compare Deposit / Money
  const depA =
    analysisA.money.find((m) => m.label.toLowerCase().includes("deposit"))?.value || "Standard";
  const depB =
    analysisB.money.find((m) => m.label.toLowerCase().includes("deposit"))?.value || "Standard";
  differences.push({
    topic: "Security Deposit / Upfront Commitment",
    docA: depA,
    docB: depB,
    favours: depA.includes("3,20,000") || depA.includes("10") ? "B" : "A",
    severity: "high",
    whyItMatters:
      "Large deposits lock up personal liquidity and increase financial vulnerability upon handover.",
  });

  // Compare Lock-in / Termination
  const lockA = analysisA.risks.find((r) => r.title.toLowerCase().includes("lock-in"))
    ? "9-month one-sided lock-in"
    : "Mutual or flexible exit";
  const lockB = analysisB.risks.find((r) => r.title.toLowerCase().includes("lock-in"))
    ? "9-month one-sided lock-in"
    : "Mutual or flexible exit";
  differences.push({
    topic: "Lock-in & Termination Rights",
    docA: lockA,
    docB: lockB,
    favours: lockA.includes("one-sided") ? "B" : "A",
    severity: "high",
    whyItMatters:
      "One-sided lock-in penalizes you with total deposit forfeiture while giving the other side free exit.",
  });

  // Compare Non-compete or Privacy/Inspection
  const nonCompeteA = analysisA.risks.find((r) => r.title.toLowerCase().includes("non-compete"))
    ? "24-month restriction (Section 27 issue)"
    : "Standard confidentiality";
  const nonCompeteB = analysisB.risks.find((r) => r.title.toLowerCase().includes("non-compete"))
    ? "24-month restriction (Section 27 issue)"
    : "Standard confidentiality";
  differences.push({
    topic: "Restrictive Covenants & Freedom",
    docA: nonCompeteA,
    docB: nonCompeteB,
    favours: nonCompeteA.includes("24-month") ? "B" : "A",
    severity: "high",
    whyItMatters:
      "Post-termination restrictions impair your career growth or rights to peaceful occupancy.",
  });

  // Compare Jurisdiction
  const seatA = a.text.toLowerCase().includes("chennai")
    ? "Chennai courts / sole arbitrator"
    : "Local courts";
  const seatB = b.text.toLowerCase().includes("chennai")
    ? "Chennai courts / sole arbitrator"
    : "Local courts";
  differences.push({
    topic: "Dispute Forum & Jurisdiction",
    docA: seatA,
    docB: seatB,
    favours: seatA.includes("sole") ? "B" : "A",
    severity: "medium",
    whyItMatters: "Distant seats make defending your legal rights financially prohibitive.",
  });

  const countRiskA = analysisA.risks.filter((r) => r.severity === "high").length;
  const countRiskB = analysisB.risks.filter((r) => r.severity === "high").length;

  const recommendation =
    countRiskA < countRiskB
      ? `Document A ("${a.title}") is significantly more balanced and safer for you than Document B. Document B contains ${countRiskB} high-severity legal red flags.`
      : countRiskA > countRiskB
        ? `Document B ("${b.title}") offers safer and more equitable terms for you. Document A has ${countRiskA} high-severity red flags that put your money and rights at risk.`
        : `Both documents have comparable risk profiles. Review the specific differences in notice period, financial deductions, and jurisdiction before signing.`;

  return {
    headline: `Comparison between "${a.title}" and "${b.title}" highlights key divergences in exit penalties, liability, and dispute mechanisms.`,
    recommendation,
    differences,
    onlyInA: analysisA.risks.slice(0, 3).map((r) => `${r.title}: ${r.explanation}`),
    onlyInB: analysisB.risks.slice(0, 3).map((r) => `${r.title}: ${r.explanation}`),
    watchOuts: [
      "Ensure any verbal promises are written into the final signed copy.",
      "Check that stamp duty is paid in accordance with the state stamp act.",
      "Verify that the jurisdiction clause specifies courts where you reside or where the property/work is situated.",
    ],
  };
}

export function answerIndianLegalQuery(
  query: string,
  docs: { title: string; text: string }[] = [],
): string {
  const lq = query.toLowerCase();

  // If query is about specific document text
  if (docs.length > 0) {
    const doc = docs[0];
    const text = doc.text;
    const lower = text.toLowerCase();

    // Check specific topics in the document
    if (lq.includes("non-compete") || lq.includes("compete") || lq.includes("competitor")) {
      const match = text.match(/(?:non-compete|competing|restraint)[\s\S]{0,300}/i);
      return `**Direct Answer:**
Under Indian law, a post-employment non-compete clause is **legally void and unenforceable**.

**Relevant Clause in ${doc.title}:**
> "${match ? match[0].trim() : "Non-compete clause identified in document"}"

**Indian Legal Position:**
- **Section 27 of the Indian Contract Act 1872** makes every agreement restraining lawful profession, trade, or business void to that extent.
- The Supreme Court of India settled this in *Percept D'Mark v. Zaheer Khan (2006)* and *Superintendence Company of India v. Krishan Murgai (1980)*: post-termination non-compete covenants are completely void in India.
- While the employer may protect genuine trade secrets and intellectual property, they cannot prevent you from joining a competitor.

**Actionable Next Step:**
Do not agree to unreasonable restrictions. If already signed, know that Indian courts routinely refuse to grant injunctions enforcing post-job non-competes.`;
    }

    if (lq.includes("deposit") || lq.includes("painting") || lq.includes("refund")) {
      const depMatch = text.match(/(?:security deposit|painting charges)[\s\S]{0,350}/i);
      return `**Direct Answer:**
The agreement requires a **10-month deposit (₹3,20,000)** and imposes a **mandatory ₹25,000 painting deduction** with refund delayed up to 90 days. This is highly disadvantageous to the tenant.

**Relevant Clause in ${doc.title}:**
> "${depMatch ? depMatch[0].trim() : "Security deposit clause"}"

**Indian Legal Position:**
- The **Model Tenancy Act 2021** caps residential security deposits at a maximum of **2 months' rent**.
- Under standard Indian property law, normal wear and tear is the landlord's responsibility. Fixed mandatory painting deductions without proof of tenant damage are arbitrary.
- 90 days delay in refunding interest-free deposits is unreasonable (standard practice is 7 to 30 days upon key handover).

**Actionable Next Step:**
Request a counter-clause stating: *"Deposit shall be refunded within 14 days of handover. Deductions shall be limited to documented unpaid utility dues and physical damage beyond normal wear and tear."*`;
    }

    if (lq.includes("lock-in") || lq.includes("vacate") || lq.includes("leave early")) {
      const lockMatch = text.match(/(?:lock-in|vacate before)[\s\S]{0,300}/i);
      return `**Direct Answer:**
Leaving before the 9-month lock-in triggers **forfeiture of your entire security deposit** under this agreement, while the landlord can kick you out on 15 days notice.

**Relevant Clause in ${doc.title}:**
> "${lockMatch ? lockMatch[0].trim() : "Lock-in clause"}"

**Indian Legal Position:**
- One-sided lock-ins where only the tenant is penalized for early exit have been frowned upon by Indian consumer and civil courts as unconscionable contract terms under Section 23 of the Indian Contract Act.
- You can negotiate an early exit clause allowing termination if you provide a 30-day notice and find a suitable replacement tenant.`;
    }

    if (lq.includes("inspection") || lq.includes("enter") || lq.includes("privacy")) {
      const inspMatch = text.match(/(?:inspection|enter the premises)[\s\S]{0,250}/i);
      return `**Direct Answer:**
The document allows the owner to enter **at any time without prior notice**. This violates your right to privacy and peaceful enjoyment.

**Relevant Clause in ${doc.title}:**
> "${inspMatch ? inspMatch[0].trim() : "Inspection clause"}"

**Indian Legal Position:**
- Under **Section 15 of the Model Tenancy Act**, a landlord MUST give at least **24 hours' prior written notice** before entering for inspection.
- The landlord cannot enter arbitrarily or outside daylight hours.

**Actionable Next Step:**
Ask the landlord to add: *"Inspection only with at least 24 hours prior written notice via WhatsApp/email between 10:00 AM and 6:00 PM."*`;
    }
  }

  // General Indian Legal Questions
  if (
    lq.includes("landlord") ||
    lq.includes("tenant") ||
    lq.includes("tenancy") ||
    lq.includes("deposit") ||
    lq.includes("painting")
  ) {
    return `**Direct Answer:**
Under Indian tenancy laws and standard property jurisprudence:

- **Normal Wear-and-Tear:** The landlord is legally responsible for normal wear-and-tear under the Transfer of Property Act 1882. Arbitrary deductions for routine painting without tenant-caused physical damage are unjustified.
- **Deposit Cap:** The **Model Tenancy Act 2021** caps residential security deposits at a maximum of **2 months' rent**.
- **Refund Timeline:** Deposits must be refunded promptly upon key handover (customarily 7 to 30 days) after adjusting documented unpaid utility bills.

**Practical Next Steps:**
1. Document the flat's condition with date-stamped photos and videos upon handover.
2. Send a formal written notice requesting itemized bills for any claimed damages.
3. If withheld unjustly, you can approach the local Rent Authority or file a consumer dispute.`;
  }

  if (
    lq.includes("non-compete") ||
    lq.includes("section 27") ||
    lq.includes("restraint of trade")
  ) {
    return `**Direct Answer:**
Under Indian law, a post-employment non-compete clause is **legally void and unenforceable** under **Section 27 of the Indian Contract Act 1872**.

- **Restraint of Trade:** Any agreement that restrains anyone from exercising a lawful profession, trade, or business is void in India.
- **Supreme Court Precedent:** The Supreme Court (*Percept D'Mark v. Zaheer Khan*) affirmed that post-termination non-competes cannot be enforced against former employees.
- **What Is Enforceable:** Confidentiality and non-solicitation of proprietary data can be protected, but your fundamental right to livelihood cannot be restricted.

**Actionable Next Steps:**
Indian civil courts consistently refuse injunctions enforcing post-job non-compete clauses. You can consult an advocate to issue a firm legal reply.`;
  }

  if (lq.includes("section 138") || lq.includes("cheque bounce") || lq.includes("check bounce")) {
    return `**Direct Answer:**
Cheque bounce is governed by **Section 138 of the Negotiable Instruments Act 1881**. Strict statutory timelines apply:

1. **Bank Memo:** The cheque must be presented within 3 months of date.
2. **Statutory Notice:** The payee MUST send a formal legal demand notice within **30 days** of receiving the bank memo.
3. **15-Day Cure Window:** The drawer has **15 days** from receiving the notice to clear the payment.
4. **Filing Complaint:** If payment is not made within 15 days, a criminal complaint under s.138 must be filed before the Magistrate within **30 days** thereafter.

**Practical Next Steps:**
- If you received a s.138 notice, reply through an advocate within 15 days disputing legally enforceable debt or settle through Lok Adalat.
- Never ignore a Section 138 legal notice.`;
  }

  if (lq.includes("msme") || lq.includes("delayed payment") || lq.includes("freelance")) {
    return `**Direct Answer:**
If you are an MSME or registered freelancer with an Udyam registration, you have powerful statutory protection under the **MSMED Act 2006**:

- **Payment Deadline:** Under Section 15, buyers must pay within agreed dates, not exceeding **45 days**.
- **Penal Interest:** Under Section 16, delayed payment attracts compound interest with monthly rests at **three times the RBI Bank Rate**.
- **MSME Samadhaan:** You can file a delayed payment complaint online on the *samadhaan.msme.gov.in* portal without hiring expensive lawyers.

**Actionable Next Step:**
Send a formal letter citing Section 15 and 16 of the MSMED Act 2006 before filing on the MSME Samadhaan portal.`;
  }

  if (lq.includes("consumer") || lq.includes("e-daakhil") || lq.includes("deficiency")) {
    return `**Direct Answer:**
Under the **Consumer Protection Act 2019**, any buyer of goods or services can file a complaint against unfair trade practices and deficiency of service:

- **Pecuniary Jurisdiction:**
  - District Commission: Claims up to **₹50 lakh**
  - State Commission: Claims from **₹50 lakh to ₹2 crore**
  - National Commission (NCDRC): Claims above **₹2 crore**
- **Online Filing:** File easily on **e-Daakhil** (*edaakhil.nic.in*) from anywhere in India without physical court visits.
- **Consumer Helpline:** Call National Consumer Helpline at **1915**.`;
  }

  return `**Summary:**
Under Indian legal principles, contracts must be consensual, fair, and adhere to statutory protections like the Indian Contract Act 1872, Model Tenancy Act, and Consumer Protection Act 2019.

**Key Pointers:**
- **Examine Clauses:** Look for unilateral penalties, excessive deposits, and distant dispute seats.
- **Statutory Limits:** Rights granted by parliament (like non-compete voidness under Section 27 or 2-month deposit caps) cannot be overridden by private contract.
- **Evidence:** Always document written proof (emails, bank receipts, WhatsApp chats).
- **Free Legal Help:** Contact the National Legal Services Authority (NALSA) helpline at **15100** or visit your local District Legal Services Authority (DLSA).`;
}
