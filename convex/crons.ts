import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval('discard expired passkey challenges', { hours: 1 }, internal.passkeyStore.cleanupChallenges, {});
export default crons;
