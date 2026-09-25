import test from "node:test";
import assert from "node:assert/strict";

// Test markdown preprocessing logic
function sanitizeStreamingMarkdown(raw: string): string {
  if (!raw) return "";
  let text = raw;

  text = text.replace(/(\n|^)\s*\*\s*$/, "");

  const doubleStarMatches = text.match(/\*\*/g);
  const doubleStarCount = doubleStarMatches ? doubleStarMatches.length : 0;
  if (doubleStarCount % 2 !== 0) {
    if (text.endsWith("**")) {
      text = text.slice(0, -2);
    } else {
      text = text + "**";
    }
  }

  const codeFences = (text.match(/```/g) || []).length;
  if (codeFences % 2 !== 0) {
    text = text + "\n```";
  }

  return text;
}

function tokenizeInline(text: string) {
  const tokens: { type: string; content: string }[] = [];
  const regex = /(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.substring(lastIndex, match.index).replace(/\*/g, "");
      if (plain) tokens.push({ type: "text", content: plain });
    }

    const matched = match[0];
    if (matched.startsWith("**") && matched.endsWith("**")) {
      tokens.push({ type: "bold", content: matched.slice(2, -2).replace(/\*/g, "") });
    } else if (matched.startsWith("`") && matched.endsWith("`")) {
      tokens.push({ type: "code", content: matched.slice(1, -1) });
    } else if (matched.startsWith("*") && matched.endsWith("*")) {
      tokens.push({ type: "italic", content: matched.slice(1, -1).replace(/\*/g, "") });
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    const plain = text.substring(lastIndex).replace(/\*/g, "");
    if (plain) tokens.push({ type: "text", content: plain });
  }

  return tokens;
}

test("LegalMarkdown: Streaming Bold Normalization", () => {
  // Incomplete stream chunk
  const partial = "Interest at **three times the bank rate";
  const sanitized = sanitizeStreamingMarkdown(partial);
  assert.equal(sanitized, "Interest at **three times the bank rate**");

  const tokens = tokenizeInline(sanitized);
  const boldToken = tokens.find((t) => t.type === "bold");
  assert.ok(boldToken, "Should parse bold token without asterisks");
  assert.equal(boldToken?.content, "three times the bank rate");
  assert.ok(!boldToken?.content.includes("*"), "Token should contain zero asterisks");
});

test("LegalMarkdown: Trailing Asterisk Suppression", () => {
  const trailingBullet = "Here is the summary:\n* ";
  const sanitized = sanitizeStreamingMarkdown(trailingBullet);
  assert.equal(sanitized, "Here is the summary:");

  const trailingDoubleStar = "Interest rate is **";
  const sanitizedDouble = sanitizeStreamingMarkdown(trailingDoubleStar);
  assert.equal(sanitizedDouble, "Interest rate is ");
});

test("LegalMarkdown: Full MSMED Breakdown Parsing", () => {
  const sample = `*   **Bank Rate:** The rate at which RBI lends.
*   **Calculation:** Interest is **3 times** the RBI rate.`;

  const lines = sample.split("\n");
  for (const line of lines) {
    const bulletMatch = line.trim().match(/^(\*|-|•)\s+(.*)$/);
    assert.ok(bulletMatch, "Line should be detected as a bullet item");
    const content = bulletMatch[2];
    const tokens = tokenizeInline(content);
    // Verify none of the token contents contain raw asterisks
    for (const token of tokens) {
      assert.ok(
        !token.content.includes("*"),
        `Token '${token.content}' should not contain asterisks`,
      );
    }
  }
});
