import { Hono } from "hono";
import type { HealthResponse } from "@/shared/health";
import { pingDatabase } from "./db";

export type AppEnv = { Bindings: Env };

export const app = new Hono<AppEnv>().basePath("/api");

app.get("/health", async (c) => {
  await pingDatabase(c.env.DB);
  return c.json<HealthResponse>({ ok: true });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});
