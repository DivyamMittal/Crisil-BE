import bcrypt from "bcryptjs";

import type { AuthenticatedUser } from "../types/auth.js";
import { AppError } from "../utils/app-error.js";
import { toPlain } from "../utils/serializers.js";
import type { UserRole } from "../types/enums.js";
import { UserRepository } from "../repositories/user-repository.js";

export interface TokenSigner {
  sign(payload: AuthenticatedUser): string;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenSigner: TokenSigner,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid credentials");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const safeUser = this.toSafeUser(user);

    return {
      accessToken: this.tokenSigner.sign({
        id: String(safeUser.id),
        role: safeUser.userRole as UserRole,
        email: String(safeUser.email),
      }),
      user: safeUser,
    };
  }

  async me(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.isActive) {
      throw new AppError(401, "Account is blocked");
    }

    return this.toSafeUser(user);
  }

  private toSafeUser(user: { _id: { toString(): string }; passwordHash?: string }) {
    const plain = toPlain(user);

    if (!plain) {
      throw new AppError(404, "User not found");
    }

    delete plain.passwordHash;
    return plain;
  }
}
