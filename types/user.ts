export type UserRole = "SUPER_ADMIN" | "RESELLER" | "END_USER";

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  password: string | null;
  image: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  isActive?: boolean;
  role?: UserRole;
}
