import { config } from "dotenv";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

config({ path: ".env.local" });
config();

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const requiredEither = (preferredName, legacyName) => {
  const value = process.env[preferredName]?.trim() || process.env[legacyName]?.trim();
  if (!value) throw new Error(`${preferredName} is not configured`);
  return value;
};

const supervisorEmail = requiredEither("INITIAL_SUPERVISOR_EMAIL", "INITIAL_MANAGER_EMAIL").toLowerCase();
const supervisorName = requiredEither("INITIAL_SUPERVISOR_NAME", "INITIAL_MANAGER_NAME");
const supervisorPassword = requiredEither("INITIAL_SUPERVISOR_PASSWORD", "INITIAL_MANAGER_PASSWORD");

if (!supervisorEmail.includes("@")) throw new Error("INITIAL_SUPERVISOR_EMAIL is invalid");
if (supervisorPassword.length < 12) {
  throw new Error("INITIAL_SUPERVISOR_PASSWORD must contain at least 12 characters");
}

const sslEnabled = process.env.DATABASE_SSL?.toLowerCase() !== "false";
const connectionString = process.env.DATABASE_URL?.trim();

const client = connectionString
  ? new Client({ connectionString, ssl: sslEnabled ? { rejectUnauthorized: false } : undefined })
  : new Client({
    host: required("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: required("DATABASE_NAME"),
    user: required("DATABASE_USER"),
    password: required("DATABASE_PASSWORD"),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

await client.connect();

try {
  const schemaUrl = new URL("../database/postgres-schema.sql", import.meta.url);
  await client.query(await readFile(schemaUrl, "utf8"));
  await client.query(`
    UPDATE operators SET shift = 'Night' WHERE LOWER(shift) = 'evening';
    UPDATE schedules SET shift = 'Night' WHERE LOWER(shift) = 'evening';
    UPDATE production_tasks SET shift = 'Night'
      WHERE LOWER(shift) = 'evening' AND LOWER(status) <> 'completed';
  `);

  const salt = randomBytes(16);
  const iterations = 100_000;
  const hash = pbkdf2Sync(supervisorPassword, salt, iterations, 32, "sha256");
  const now = new Date().toISOString();

  await client.query(
    `INSERT INTO app_users
      (email, login_id, password_salt, password_hash, password_iterations, name, role, plant, active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Supervisor', NULL, 1, $7)
     ON CONFLICT (email) DO UPDATE SET
       login_id = EXCLUDED.login_id,
       password_salt = EXCLUDED.password_salt,
       password_hash = EXCLUDED.password_hash,
       password_iterations = EXCLUDED.password_iterations,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       active = 1`,
    [
      supervisorEmail,
      supervisorEmail,
      salt.toString("base64"),
      hash.toString("base64"),
      iterations,
      supervisorName,
      now,
    ],
  );

  console.log("PostgreSQL schema is ready and the supervisor account is configured.");
} finally {
  await client.end();
}
