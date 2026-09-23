import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false beim Server-Render und bei der Hydration, danach true. Ersetzt das
 * Muster `useEffect(() => setMounted(true), [])`, das einen zusätzlichen
 * Render anstösst — etwa für Portale, die `document` brauchen.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
