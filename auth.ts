import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const isGoogleSsoEnabled = googleEnabled;

/**
 * Cross-subdomain cookie scope so a Google sign-in on one tenant subdomain
 * persists across all subdomains under NEXT_PUBLIC_ROOT_DOMAIN.
 *
 * dev: "localhost" — Chrome shares cookies across *.localhost
 * prod: ".example.com" — shared across <slug>.example.com and the apex
 */
function sessionCookieDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const host = root.split(":")[0];
  if (!host) return undefined;
  if (host === "localhost") return "localhost";
  return `.${host}`;
}

const useSecureCookies = process.env.NODE_ENV === "production";
const sessionCookieName = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: sessionCookieDomain(),
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      const dbUser =
        existing ??
        (await prisma.user.create({
          data: {
            email,
            name: user.name ?? null,
            passwordHash: null,
            isSuperAdmin: false,
          },
        }));

      // Surface DB id + privilege flag to the JWT callback.
      user.id = dbUser.id;
      (user as { isSuperAdmin?: boolean }).isSuperAdmin = dbUser.isSuperAdmin;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.isSuperAdmin = (user as { isSuperAdmin: boolean }).isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { id: string; isSuperAdmin: boolean }).id =
          token.uid as string;
        (session.user as typeof session.user & { id: string; isSuperAdmin: boolean }).isSuperAdmin =
          Boolean(token.isSuperAdmin);
      }
      return session;
    },
  },
});
