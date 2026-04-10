import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database/mongoose.js";

await connectDatabase();
const app = createApp();

export default app;

