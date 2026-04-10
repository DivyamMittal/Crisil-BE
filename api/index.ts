import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";

await connectDatabase();
const app = createApp();

export default app;
