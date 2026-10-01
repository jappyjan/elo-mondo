import { Password } from '@convex-dev/auth/providers/Password';
import { Email } from '@convex-dev/auth/providers/Email';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { MutationCtx } from './_generated/server';

function emailCode(id: string, subject: string) {
  return Email({
    id, maxAge: 15 * 60,
    async generateVerificationToken() {
      // 48 bits of entropy, with no biased modulo reduction.
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    },
    async sendVerificationRequest({ identifier, token }) {
      const url = process.env.AUTH_MAILPIT_URL;
      const from = process.env.AUTH_EMAIL_FROM;
      if (!url || !from) throw new Error('Email delivery is not configured');
      const response = await fetch(`${url.replace(/\/$/, '')}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: { Email: from, Name: 'EloMondo' }, To: [{ Email: identifier }], Subject: subject, Text: `Your EloMondo code is ${token}. It expires in 15 minutes. If you did not request this, you can ignore this email.` }),
      });
      if (!response.ok) throw new Error('Email could not be delivered');
    },
  });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({
    reset: emailCode('password-reset', 'Reset your EloMondo password'),
    verify: emailCode('email-verification', 'Verify your EloMondo email'),
    profile(params) {
      const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError('Enter a valid email');
      const name = typeof params.name === 'string' ? params.name.trim() : undefined;
      if (params.flow === 'signUp' && (!name || name.length < 2 || name.length > 100)) {
        throw new ConvexError('Display name must be between 2 and 100 characters');
      }
      return { email, ...(name ? { name } : {}) };
    },
  })],
  callbacks: {
    async beforeSessionCreation(context, { userId }) {
      const ctx = context as MutationCtx;
      const user = await ctx.db.get(userId);
      if (!user || user.disabled) throw new ConvexError('This account is unavailable');
    },
    async afterUserCreatedOrUpdated(context, { userId }) {
      const ctx = context as MutationCtx;
      const user = await ctx.db.get(userId);
      if (!user || user.disabled) throw new ConvexError('This account is unavailable');
      const businessUserId = user.legacyId ?? userId;
      const existing = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', businessUserId)).unique();
      if (!existing) {
        const name = user.name ?? user.email?.split('@')[0] ?? 'Player';
        const duplicate = await ctx.db.query('players').withIndex('by_name', q => q.eq('name', name)).first();
        const now = new Date().toISOString();
        await ctx.db.insert('players', { id: crypto.randomUUID(), name: duplicate ? `${name} ${businessUserId.slice(-6)}` : name, user_id: businessUserId, created_at: now, updated_at: now });
      }
    },
  },
});
