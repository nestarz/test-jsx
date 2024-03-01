// @deno-types="@types/react"
import { createElement as h } from "react";

// @deno-types="@types/react-dom/client"
import { hydrateRoot as hydrate } from "react-dom/client";

export const namespace = "@bureaudouble/bureau";

export type UseClient = { h: typeof h; hydrate: typeof hydrate };

export default (async (
  url: string,
): Promise<{ h: typeof h; hydrate: typeof hydrate }> => {
  if (!globalThis.document) {
    const island = (await import("@bureaudouble/islet/client")).default;
    island(url, namespace);
  }
  return { h, hydrate };
});
