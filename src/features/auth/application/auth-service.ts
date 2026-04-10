import bcrypt from "bcryptjs";

import { AppError } from "../../../common/errors/app-error.js";
import { signAccessToken } from "../../../common/middleware/auth.js";
import { toPlain } from "../../../database/serializers.js";
import { UserModel } from "../../../database/models.js";

export class AuthService {
  async login(email: string, password: string) {
    const user = await UserModel.findOne({ email: email.toLowerCase() });

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
      accessToken: signAccessToken({
        id: safeUser.id,
        role: safeUser.userRole,
        email: safeUser.email,
      }),
      user: safeUser,
    };
  }

  async me(id: string) {
    const user = await UserModel.findById(id);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.isActive) {
      throw new AppError(401, "Account is blocked");
    }

    return this.toSafeUser(user);
  }

  private toSafeUser(user: InstanceType<typeof UserModel>) {
    const plain = toPlain(user);

    if (!plain) {
      throw new AppError(404, "User not found");
    }

    delete plain.passwordHash;
    return plain;
  }
}

export const authService = new AuthService();
