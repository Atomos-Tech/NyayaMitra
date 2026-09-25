import { memo, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LegalMarkdownProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

/**
 * Pre-processes streaming text to auto-close uncompleted markdown markers (e.g. bold **),
 * strip dangling trailing asterisks (*), and prevent raw Markdown artifacts from flickering.
 */
function sanitizeStreamingMarkdown(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Strip dangling bullet starter at the very end of the stream (e.g. `\n* ` or `\n*`)
  text = text.replace(/(\n|^)\s*\*\s*$/, "");

  // 2. Count double asterisks (**) to detect unclosed bold syntax
  const doubleStarMatches = text.match(/\*\*/g);
  const doubleStarCount = doubleStarMatches ? doubleStarMatches.length : 0;
  if (doubleStarCount % 2 !== 0) {
    if (text.endsWith("**")) {
      // Just received opening **, strip it until content arrives
      text = text.slice(0, -2);
    } else {
      // Received partial bold text like `**three times`, close it temporarily
      text = text + "**";
    }
  }

  // 3. Check for unclosed code fence
  const codeFences = (text.match(/```/g) || []).length;
  if (codeFences % 2 !== 0) {
    text = text + "\n```";
  }

  return text;
}

interface InlineToken {
  type: "text" | "bold" | "italic" | "code";
  content: string;
}

/**
 * Parses inline string into styled React elements without showing raw asterisks.
 */
function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Match bold **...**, code `...`, italic *...*
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

function renderInlineTokens(tokens: InlineToken[], keyPrefix: string): ReactNode {
  return tokens.map((tok, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (tok.type) {
      case "bold":
        return (
          <strong key={key} className="font-semibold text-foreground">
            {tok.content}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic text-foreground/90">
            {tok.content}
          </em>
        );
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-secondary/80 px-1 py-0.5 font-mono text-[11px] text-accent font-medium"
          >
            {tok.content}
          </code>
        );
      case "text":
      default:
        return <span key={key}>{tok.content}</span>;
    }
  });
}

type Block =
  | { type: "paragraph"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "number"; items: string[] }
  | { type: "heading"; level: number; text: string }
  | { type: "subheading"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "codeblock"; language?: string; code: string };

function parseMarkdownBlocks(raw: string): Block[] {
  const lines = raw.split("\n");
  const blocks: Block[] = [];
  let currentList: { type: "bullet" | "number"; items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code fences
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          type: "codeblock",
          language: codeLang,
          code: codeBuffer.join("\n"),
        });
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = "";
      } else {
        if (currentList) {
          blocks.push(currentList);
          currentList = null;
        }
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      continue;
    }

    // Bullet items: starts with * or - or •
    const bulletMatch = trimmed.match(/^(\*|-|•)\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== "bullet") {
        if (currentList) blocks.push(currentList);
        currentList = { type: "bullet", items: [] };
      }
      currentList.items.push(bulletMatch[2]);
      continue;
    }

    // Numbered items: starts with 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (!currentList || currentList.type !== "number") {
        if (currentList) blocks.push(currentList);
        currentList = { type: "number", items: [] };
      }
      currentList.items.push(numMatch[2]);
      continue;
    }

    // If we were building a list and line is not a list item, flush it
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }

    // Blockquote: starts with >
    if (trimmed.startsWith(">")) {
      blocks.push({
        type: "blockquote",
        text: trimmed.replace(/^>\s*/, "").replace(/\*/g, ""),
      });
      continue;
    }

    // Markdown Headings: starts with #
    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#+)\s*(.*)$/);
      if (match) {
        blocks.push({
          type: "heading",
          level: match[1].length,
          text: match[2].replace(/\*/g, ""),
        });
        continue;
      }
    }

    // Standalone bold heading line like `**Practical Advice for MSMEs:**` or `**Next Steps:**`
    const boldHeadingMatch = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldHeadingMatch) {
      blocks.push({
        type: "subheading",
        text: boldHeadingMatch[1].trim(),
      });
      continue;
    }

    // Regular paragraph
    blocks.push({ type: "paragraph", text: trimmed });
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      type: "codeblock",
      language: codeLang,
      code: codeBuffer.join("\n"),
    });
  }

  if (currentList) {
    blocks.push(currentList);
  }

  return blocks;
}

export const LegalMarkdown = memo(function LegalMarkdown({
  content,
  className,
}: LegalMarkdownProps) {
  const blocks = useMemo(() => {
    const sanitized = sanitizeStreamingMarkdown(content);
    return parseMarkdownBlocks(sanitized);
  }, [content]);

  return (
    <div className={cn("space-y-3 leading-relaxed text-sm text-foreground/90", className)}>
      {blocks.map((block, idx) => {
        const key = `block-${idx}`;

        switch (block.type) {
          case "heading": {
            if (block.level === 1) {
              return (
                <h2
                  key={key}
                  className="font-display text-lg font-bold tracking-tight text-foreground mt-4 mb-2 border-b border-border/60 pb-1"
                >
                  {block.text}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3
                  key={key}
                  className="font-display text-base font-bold tracking-tight text-foreground mt-3.5 mb-1.5"
                >
                  {block.text}
                </h3>
              );
            }
            return (
              <h4
                key={key}
                className="font-display text-sm font-bold tracking-tight text-foreground mt-3 mb-1 text-accent"
              >
                {block.text}
              </h4>
            );
          }

          case "subheading": {
            return (
              <h4
                key={key}
                className="font-display text-sm font-bold text-foreground mt-3.5 mb-1.5 flex items-center gap-1.5"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                <span>{block.text}</span>
              </h4>
            );
          }

          case "bullet": {
            return (
              <ul key={key} className="space-y-1.5 my-2 pl-0.5">
                {block.items.map((item, itemIdx) => {
                  const tokens = tokenizeInline(item);
                  return (
                    <li
                      key={`bullet-${idx}-${itemIdx}`}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/80" />
                      <div className="flex-1 min-w-0">
                        {renderInlineTokens(tokens, `bullet-${idx}-${itemIdx}`)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          }

          case "number": {
            return (
              <ol key={key} className="space-y-1.5 my-2 pl-0.5">
                {block.items.map((item, itemIdx) => {
                  const tokens = tokenizeInline(item);
                  return (
                    <li
                      key={`num-${idx}-${itemIdx}`}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent mt-0.5">
                        {itemIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {renderInlineTokens(tokens, `num-${idx}-${itemIdx}`)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            );
          }

          case "blockquote": {
            return (
              <blockquote
                key={key}
                className="my-2.5 rounded-r-lg border-l-2 border-accent bg-accent/5 px-3.5 py-2 text-xs italic text-muted-foreground leading-relaxed"
              >
                {block.text}
              </blockquote>
            );
          }

          case "codeblock": {
            return (
              <div
                key={key}
                className="my-2.5 overflow-hidden rounded-lg border border-border bg-secondary/50 font-mono text-xs"
              >
                {block.language && (
                  <div className="border-b border-border/60 bg-surface/70 px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                    {block.language}
                  </div>
                )}
                <pre className="overflow-x-auto p-3 text-foreground leading-relaxed">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          }

          case "paragraph":
          default: {
            const tokens = tokenizeInline(block.text);
            return (
              <p key={key} className="leading-relaxed">
                {renderInlineTokens(tokens, `p-${idx}`)}
              </p>
            );
          }
        }
      })}
    </div>
  );
});
