import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { kv as redis } from "@/lib/kv";

const PRODUCTION_URL = "https://shohei-contoroller.vercel.app";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
          redirect_uri: `${PRODUCTION_URL}/api/auth/callback/google`,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        if (account.refresh_token) {
          await redis.set("push:refresh_token", account.refresh_token).catch(() => {});
        }
        return token;
      }

      // トークンがまだ有効なら（60秒バッファ）そのまま返す
      if (Date.now() < (token.expiresAt as number) * 1000 - 60_000) {
        return token;
      }

      // 期限切れ → リフレッシュトークンで更新
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const refreshed = await res.json();
        if (!res.ok) throw refreshed;
        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Math.floor(Date.now() / 1000 + refreshed.expires_in),
        };
      } catch (e) {
        console.error("Token refresh failed", e);
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
};
