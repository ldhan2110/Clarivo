"use client";

import { useEffect, useRef, useState } from "react";

let seq = 0;

/**
 * The only module that imports mermaid, and it is loaded through next/dynamic
 * with ssr:false by diagram-block.tsx — so a page with no diagram pays nothing
 * for the library.
 *
 * A render failure shows the source with the message, never a blank box: an
 * empty element is indistinguishable from a bug, and the source is still the
 * thing the author needs to fix.
 */
export default function MermaidFigure({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        seq += 1;
        const { svg } = await mermaid.render(`clarivo-diagram-${seq}`, source);
        if (cancelled) return;
        setError(null);
        if (container.current) container.current.innerHTML = svg;
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message || "The diagram could not be rendered");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return (
      <div
        data-testid="diagram-error"
        className="rounded-[10px] border border-warning/35 bg-warning/10 p-3"
      >
        <p className="text-xs font-medium text-warning">This diagram could not be rendered</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <pre className="mt-2 overflow-x-auto rounded-[8px] bg-secondary p-2.5 font-mono text-xs text-foreground">
          {source}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={container}
      data-testid="diagram-svg"
      className="overflow-x-auto rounded-[10px] border border-border bg-card p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
    />
  );
}
