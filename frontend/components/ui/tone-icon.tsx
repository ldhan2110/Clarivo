/**
 * The five tone icons for toasts and confirm dialogs.
 *
 * These are inline SVGs, not `lucide-react` glyphs, on purpose: lucide ships
 * stroke-outline icons, and the approved look is a solid tone-coloured shape
 * with the glyph *knocked out* in the surface colour — something an outline
 * glyph cannot produce. Bodies are copied verbatim from the approved mockups
 * (`devspec/.../mockups/toast-stack.html`, `confirm-dialog.html`).
 *
 * Colour is the caller's: the shape fills with `currentColor`, so a `className`
 * like `text-success` or a `--tone` on an ancestor decides the hue. That is why
 * one component serves the toast (26px) and the dialog (28px).
 */
import type { ConfirmTone } from "@/types/confirm";
import { cn } from "@/lib/utils";

/** Glyph knocked out of the solid shape in the surface colour. */
const KNOCK = {
  fill: "none",
  stroke: "var(--popover)",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const DOT = { fill: "var(--popover)" } as const;

const SHAPES: Record<ConfirmTone, React.ReactNode> = {
  confirm: (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path
        d="M9.3 9.4a2.75 2.75 0 1 1 4.1 2.5c-.9.55-1.4 1.1-1.4 2.05v.35"
        {...KNOCK}
      />
      <circle cx="12" cy="17.6" r="1.3" {...DOT} />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m7.5 12.2 3.1 3.1 6-6.6" {...KNOCK} />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M12 11.2v5.6" {...KNOCK} />
      <circle cx="12" cy="7.6" r="1.35" {...DOT} />
    </>
  ),
  warning: (
    <>
      <path
        fill="currentColor"
        d="M10.17 3.3a2.1 2.1 0 0 1 3.66 0l8.1 14.3A2.1 2.1 0 0 1 20.1 20.8H3.9a2.1 2.1 0 0 1-1.83-3.2z"
      />
      <path d="M12 9v4.4" {...KNOCK} />
      <circle cx="12" cy="17" r="1.3" {...DOT} />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m8.6 8.6 6.8 6.8M15.4 8.6l-6.8 6.8" {...KNOCK} />
    </>
  ),
};

/** The tone colour each shape fills with. `confirm` and `info` share --primary. */
const TONE_COLOR: Record<ConfirmTone, string> = {
  confirm: "text-primary",
  success: "text-success",
  info: "text-primary",
  warning: "text-warning",
  error: "text-destructive",
};

export function ToneIcon({
  tone,
  size = 26,
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & {
  tone: ConfirmTone;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      data-slot="tone-icon"
      className={cn("block shrink-0", TONE_COLOR[tone], className)}
      {...props}
    >
      {SHAPES[tone]}
    </svg>
  );
}
