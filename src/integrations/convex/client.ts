import { ConvexReactClient } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) throw new Error('Set VITE_CONVEX_URL in .env.local; run npx convex dev to configure the backend.');
export const convex = new ConvexReactClient(url);
export { api };

export async function fetchAnalyticsThrows(groupId: string, start?: string, end?: string) {
  const rows = [];
  let cursor: string | null = null;
  for (;;) {
    const result = await convex.query(api.data.throwsPage, {
      groupId, ...(start ? { start } : {}), ...(end ? { end } : {}),
      paginationOpts: { numItems: 500, cursor },
    });
    rows.push(...result.page);
    if (result.isDone) return rows;
    cursor = result.continueCursor;
  }
}
