"use client";

import { Toaster as Sonner } from "sonner";
import { ToneIcon } from "@/components/ui/tone-icon";

/**
 * Toast surface. Every value here is measured off the approved mockup
 * (`mockups/toast-stack.html`) — 364px wide, 12px radius, 14px padding, the
 * `--popover` surface of `dropdown-menu.tsx`, and tone carried by the icon alone.
 *
 * Two sonner props are deliberately absent:
 * - `richColors` floods the whole surface with the tone colour, which stops
 *   matching the app's `--popover` components.
 * - `theme` reads the OS preference. This app's dark mode is the `.dark` class,
 *   so `theme` would put a dark toast on a light app. The Tailwind classes below
 *   follow `.dark` the same way every other component does.
 *
 * ponytail: the `!` modifiers are not decoration — sonner's own rules are
 * `[data-sonner-toast][data-styled=true] …` (specificity 0,3,0) and injected at
 * runtime, so a plain utility class loses. Drop a `!` only after checking the
 * computed style in the browser.
 */

export function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      position="top-right"
      duration={4000}
      visibleToasts={3}
      // The mockup draws the three toasts 10px apart, not collapsed behind each
      // other — `gap` only applies to an expanded stack.
      expand
      gap={10}
      offset={16}
      // 58px mobile app bar + 8px, so a toast never covers the hamburger or the bell
      mobileOffset={{ top: 66, left: 16, right: 16 }}
      closeButton
      style={{ "--width": "364px" } as React.CSSProperties}
      icons={{
        success: <ToneIcon tone="success" />,
        info: <ToneIcon tone="info" />,
        warning: <ToneIcon tone="warning" />,
        error: <ToneIcon tone="error" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "shadow-toast bg-popover! text-popover-foreground! border! border-border! rounded-[12px]! p-[14px]! pr-[44px]! gap-[12px]! items-center!",
          // 26px tone icon, vertically centred so it spans title through description
          icon: "size-[26px]! m-0! self-center! [&>svg]:m-0!",
          content: "gap-[3px]!",
          title: "text-[13.5px]! leading-[1.35]! font-semibold! tracking-[-0.005em]",
          description: "text-[12.5px]! leading-[1.45]! font-normal! text-muted-foreground!",
          closeButton:
            "left-auto! right-[14px]! top-[14px]! size-[18px]! transform-none! rounded-[4px]! border-0! bg-transparent! p-0! text-muted-foreground! opacity-55 transition-opacity hover:bg-accent! hover:opacity-100 [&>svg]:size-[13px]!",
        },
      }}
      {...props}
    />
  );
}
