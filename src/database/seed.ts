import bcrypt from "bcryptjs";

import { CompanyRole, UserRole } from "../shared/index.js";
import { env } from "../config/env.js";
import { UserModel } from "./models.js";

export const seedDefaultAdmin = async () => {
  const existingAdmin = await UserModel.findOne({ email: env.adminEmail.toLowerCase() });

  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, 10);

  return UserModel.create({
    email: env.adminEmail.toLowerCase(),
    passwordHash,
    fullName: env.adminName,
    userRole: UserRole.ADMIN,
    companyRole: CompanyRole.MANAGER,
    managerId: null,
    teamMemberIds: [],
    isActive: true,
    timezone: "Asia/Kolkata",
  });
};
