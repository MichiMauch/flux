"use client";

import { useEffect } from "react";

/**
 * Reports the document height to the embedding parent window so the host
 * page (e.g. kokomo.house) can size its <iframe> to fit — no inner scrollbar.
 *
 * The parent listens for `{ type: "flux-embed-height", token, height }`.
 * We include the token so a page with several Flux widgets can match the
 * message to the right iframe.
 */
export function EmbedAutoHeight({ token }: { token: string }) {
  useEffect(() => {
    if (window.parent === window) return;

    const post = () => {
      const height = Math.ceil(
        Math.max(
          document.body.scrollHeight,
          document.body.getBoundingClientRect().height
        )
      );
      window.parent.postMessage(
        { type: "flux-embed-height", token, height },
        "*"
      );
    };

    post();

    const ro = new ResizeObserver(post);
    ro.observe(document.body);

    // Images / the map settling after load can change height without a
    // resize of the root element — cover those with a load listener too.
    window.addEventListener("load", post);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
    };
  }, [token]);

  return null;
}
