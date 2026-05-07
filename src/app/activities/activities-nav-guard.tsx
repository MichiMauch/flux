"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from "react";
import { FeedSkeleton } from "./feed-skeleton";

interface NavGuardCtx {
  navigate: (href: string) => void;
  pending: boolean;
}

const Ctx = createContext<NavGuardCtx>({
  navigate: () => {},
  pending: false,
});

/**
 * Wraps the activities filter + feed in a shared `useTransition`. The
 * transition's `pending` flag is exposed via context so that:
 *   - the date filter / sport filter can call `navigate(href)` instead of
 *     `router.push` directly (so we hold the transition handle ourselves);
 *   - the `<NavGuardFeed>` wrapper can render a skeleton while the new
 *     server-rendered tree is in flight.
 *
 * Why not just rely on <Suspense fallback={…}>? Next.js wraps every
 * client navigation (router.push, <Link>) in an internal transition,
 * and React transitions explicitly suppress Suspense fallbacks ("avoid
 * showing a loading indicator"). So Suspense is fine for the FIRST
 * render of a route, but for subsequent searchParams-only navigations
 * the fallback never appears. This guard sidesteps that by reading
 * `pending` ourselves and unconditionally swapping in the skeleton.
 */
export function ActivitiesNavGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  return <Ctx.Provider value={{ navigate, pending }}>{children}</Ctx.Provider>;
}

export function useActivitiesNav(): NavGuardCtx {
  return useContext(Ctx);
}

export function NavGuardFeed({
  variant,
  children,
}: {
  variant: "list" | "editorial";
  children: ReactNode;
}) {
  const { pending } = useContext(Ctx);
  if (pending) return <FeedSkeleton variant={variant} />;
  return <>{children}</>;
}
