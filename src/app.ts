import { Hono } from "hono";
import { z } from "zod";

import { loadCameraRepository, type CameraRepository } from "./lib/camera-store.js";

const querySchema = z.object({
  cameraCode: z.string().trim().min(1, "cameraCode is required"),
});

export function createApp(dataPath: string) {
  const app = new Hono();
  let repositoryPromise: Promise<CameraRepository> | null = null;

  const getRepository = () => {
    if (!repositoryPromise) {
      repositoryPromise = loadCameraRepository(dataPath);
    }

    return repositoryPromise;
  };

  app.get("/", (c) =>
    c.json({
      name: "camera-kakaomap-gpt",
      ok: true,
      endpoints: [
        "/health",
        "/privacy",
        "/camera-link?cameraCode={managementNumber}",
        "/camera-link?cameraCode={last4Digits}",
      ],
    }),
  );

  app.get("/health", (c) =>
    c.json({
      ok: true,
      dataPath,
    }),
  );

  app.get("/privacy", (c) =>
    c.html(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Privacy Policy</title>
  </head>
  <body>
    <h1>Privacy Policy</h1>
    <p>This GPT uses the public national traffic enforcement camera standard dataset to return location lookup results.</p>
    <p>User-entered camera codes are only used to process lookup requests and are not intentionally stored beyond normal server logs.</p>
    <p>Contact: local deployment owner</p>
  </body>
</html>`),
  );

  app.get("/camera-link", async (c) => {
    const parsed = querySchema.safeParse({
      cameraCode: c.req.query("cameraCode"),
    });

    if (!parsed.success) {
      return c.json(
        {
          matched: false,
          message: parsed.error.issues[0]?.message ?? "Invalid query",
        },
        400,
      );
    }

    try {
      const repository = await getRepository();
      const result = repository.lookup(parsed.data.cameraCode);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          matched: false,
          message: "Camera dataset is temporarily unavailable.",
          error: error instanceof Error ? error.message : "Unknown repository error",
        },
        503,
      );
    }
  });

  return app;
}

const defaultDataPath = process.env.CAMERA_DATA_PATH ?? "data/cameras.json";

export default createApp(defaultDataPath);
