/**
 * React Query cache keys. A plain module (no hooks, no 'use client') so server components can use the
 * same keys when they prefetch data for <HydrationBoundary>.
 */
export const queryKeys = {
  guests: ['guests'] as const,
} as const;
