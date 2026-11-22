import { QueryClient, isServer } from '@tanstack/react-query';

/** The defaults for every query in the dashboard. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // data from the server render counts as fresh for 30 s, so the page doesn't fetch it again at once
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** On the server: a new client for every request. In the browser: one client for the whole session. */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  return (browserClient ??= makeQueryClient());
}
