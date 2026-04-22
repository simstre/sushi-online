import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      isSuperAdmin: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    isSuperAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    isSuperAdmin: boolean;
  }
}
