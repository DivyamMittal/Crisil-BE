import mongoose from "mongoose";

import { env } from "../config/env.js";
import { seedDefaultAdmin } from "./seed.js";

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    await seedDefaultAdmin();
    return mongoose;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri);
  }

  await connectionPromise;
  await seedDefaultAdmin();
  return mongoose;
};

mongoose.set("strictQuery", true);
