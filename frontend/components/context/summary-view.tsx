"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders the knowledge summary markdown. A light hand renderer (no
 * react-markdown, per the project's rule): `##`/`###` headings, bullets,
 * paragraphs, the `Sources:` line and the `⚠ Sources differ` note get styling;
 * ```mermaid fences render as diagrams via a lazy-loaded mermaid.
 */
export function SummaryView({ markdown }: { markdown: string }) {
  const blocks = splitMermaid(markdown);
  return (
    <div className="space-y-1">
      {blocks.map((b, i) =>
        b.type === "mermaid" ? (
          <MermaidBlock key={i} code={b.content} />
        ) : (
          <Prose key={i} text={b.content} />
        ),
      )}
    </div>
  );
}

type Block = { type: "text" | "mermaid"; content: string };

function splitMermaid(md: string): Block[] {
  const blocks: Block[] = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m.index > last) blocks.push({ type: "text", content: md.slice(last, m.index) });
    blocks.push({ type: "mermaid", content: m[1].trim() });
    last = re.lastIndex;
  }
  if (last < md.length) blocks.push({ type: "text", content: md.slice(last) });
  return blocks;
}

function Prose({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length) {
      out.push(
        <ul key={key} className="my-2 list-disc pl-5 text-sm">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  lines.forEach((line, i) => {
    const l = line.trim();
    if (!l) {
      flush(`f${i}`);
      return;
    }
    if (l.startsWith("## ")) {
      flush(`f${i}`);
      out.push(
        <h2 key={i} className="mt-5 mb-1.5 border-b border-border pb-1 text-[15px] font-semibold">
          {l.slice(3)}
        </h2>,
      );
    } else if (l.startsWith("### ")) {
      flush(`f${i}`);
      out.push(
        <h3 key={i} className="mt-3 mb-1 text-sm font-semibold">
          {l.slice(4)}
        </h3>,
      );
    } else if (l.startsWith("- ") || l.startsWith("* ")) {
      bullets.push(l.slice(2));
    } else if (/^sources:/i.test(l)) {
      flush(`f${i}`);
      out.push(
        <p key={i} className="my-1 text-xs text-muted-foreground">
          {l}
        </p>,
      );
    } else if (l.startsWith("⚠")) {
      flush(`f${i}`);
      out.push(
        <p key={i} className="my-1 text-xs font-medium text-warning">
          {l}
        </p>,
      );
    } else if (/^_thin/i.test(l)) {
      flush(`f${i}`);
      out.push(
        <p key={i} className="my-1 text-sm italic text-muted-foreground">
          {l.replace(/_/g, "")}
        </p>,
      );
    } else {
      flush(`f${i}`);
      out.push(
        <p key={i} className="my-1.5 text-sm">
          {l}
        </p>,
      );
    }
  });
  flush("end");
  return <>{out}</>;
}

/** Renders one mermaid diagram; on a parse error shows the source, never a blank box. */
function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    return (
      <pre className="my-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs">
        {code}
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className={cn("my-3 flex justify-center rounded-md border border-border bg-muted/40 p-3")}
    />
  );
}
