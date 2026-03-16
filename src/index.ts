import "dotenv/config";

import { createApp } from "./app.js";

const dataPath = process.env.CAMERA_DATA_PATH ?? "data/cameras.json";

const app = createApp(dataPath);

export default app;
