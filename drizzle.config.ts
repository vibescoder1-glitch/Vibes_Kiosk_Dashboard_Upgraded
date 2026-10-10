import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  out: "./drizzle-postgres",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? `postgresql://${process.env.DATABASE_USER ?? ""}:${process.env.DATABASE_PASSWORD ?? ""}@${process.env.DATABASE_HOST ?? "localhost"}:${process.env.DATABASE_PORT ?? 5432}/${process.env.DATABASE_NAME ?? ""}`,
  },
});
