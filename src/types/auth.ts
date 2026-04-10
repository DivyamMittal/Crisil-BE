import type { UserRole } from "./enums.js";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
