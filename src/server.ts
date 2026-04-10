import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { createApp } from "./app.js";

const start = async () => {
  await connectDatabase();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
