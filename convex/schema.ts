import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const timestamps = { created_at: v.string() };
const identified = { id: v.string() };

// Business IDs remain UUID strings, preserving URLs and historical references.
// Convex's own _id is used for document updates and authentication internals.
export const businessTables = {
  groups: defineTable({ ...identified, ...timestamps, name: v.string(), created_by: nullableString }).index('by_business_id', ['id']),
  players: defineTable({ ...identified, ...timestamps, updated_at: v.string(), name: v.string(), user_id: nullableString })
    .index('by_business_id', ['id']).index('by_user', ['user_id']).index('by_name', ['name']),
  group_members: defineTable({ ...identified, group_id: v.string(), player_id: v.string(), role: v.union(v.literal('admin'), v.literal('member')), joined_at: v.string() })
    .index('by_business_id', ['id']).index('by_group', ['group_id']).index('by_player', ['player_id']).index('by_group_player', ['group_id', 'player_id']),
  group_invite_codes: defineTable({ ...identified, ...timestamps, group_id: v.string(), invite_code: v.string() })
    .index('by_business_id', ['id']).index('by_group', ['group_id']).index('by_code', ['invite_code']),
  group_invites: defineTable({ ...identified, ...timestamps, group_id: v.string(), email: v.string(), invited_by: nullableString, expires_at: v.string() })
    .index('by_business_id', ['id']).index('by_group_email', ['group_id', 'email']),
  matches: defineTable({ ...identified, ...timestamps, group_id: v.string(), winner_id: v.string(), loser_id: v.string(), match_type: v.union(v.literal('1v1'), v.literal('multiplayer')), total_players: v.number() })
    .index('by_business_id', ['id']).index('by_group_date', ['group_id', 'created_at']),
  match_participants: defineTable({ ...identified, ...timestamps, match_id: v.string(), player_id: v.string(), is_winner: v.boolean(), rank: v.number() })
    .index('by_business_id', ['id']).index('by_match', ['match_id']),
  live_games: defineTable({ ...identified, group_id: v.string(), created_by: v.string(), game_type: v.union(v.literal('301'), v.literal('501')), start_rule: v.union(v.literal('straight-in'), v.literal('double-in')), end_rule: v.union(v.literal('straight-out'), v.literal('double-out')), status: v.union(v.literal('in_progress'), v.literal('completed'), v.literal('abandoned')), started_at: v.string(), finished_at: nullableString })
    .index('by_business_id', ['id']).index('by_group', ['group_id']),
  live_game_players: defineTable({ ...identified, game_id: v.string(), player_id: nullableString, player_name: v.string(), is_temporary: v.boolean(), play_order: v.number(), starting_score: v.number(), finished_rank: nullableNumber })
    .index('by_business_id', ['id']).index('by_game', ['game_id']),
  game_throws: defineTable({ ...identified, ...timestamps, group_id: v.string(), game_id: v.string(), game_player_id: v.string(), turn_number: v.number(), throw_index: v.number(), segment: v.number(), multiplier: v.number(), score: v.number(), label: v.string() })
    .index('by_business_id', ['id']).index('by_game_date', ['game_id', 'created_at']).index('by_group_date', ['group_id', 'created_at'])
    .index('by_throw', ['game_id', 'game_player_id', 'turn_number', 'throw_index']),
};

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()), image: v.optional(v.string()), email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()), phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()), isAnonymous: v.optional(v.boolean()),
    legacyId: v.optional(v.string()), disabled: v.optional(v.boolean()),
  }).index('email', ['email']).index('phone', ['phone']).index('by_legacy_id', ['legacyId']),
  ...businessTables,
});
