"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // ponytail: one client per browser session; kept in state so Fast Refresh/SSR don't share it
  const [client] = useState(
    () =>
      new QueryClient({
        // Every failed mutation reports once, from here, so no call site has to
        // remember to. Queries are deliberately NOT wired: a background refetch
        // failing must not pop a toast — a query renders its error inline.
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            // React Query runs cache-level AND mutation-level handlers — they do
            // not replace each other — so this check is the only thing that makes
            // a local `onError` an override. Known cost: a mutation defining
            // `onError` for an unrelated reason (an optimistic rollback, say)
            // silently loses its error toast. The fix at that call site is one
            // `toast.error(apiErrorMessage(error))` line.
            if (mutation.options.onError) return;
            toast.error(apiErrorMessage(error));
          },
        }),
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
