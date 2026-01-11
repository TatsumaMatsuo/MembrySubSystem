import "next-auth";
import { MembershipType } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      employeeId?: string | null;
      employeeName?: string | null;
      department?: string | null;
      membershipType?: MembershipType | null;
    };
    accessToken?: string;
  }

  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
    employeeId?: string | null;
    employeeName?: string | null;
    department?: string | null;
    membershipType?: MembershipType | null;
    email?: string;
  }
}
