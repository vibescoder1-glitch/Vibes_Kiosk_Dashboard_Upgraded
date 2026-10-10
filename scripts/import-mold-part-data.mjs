import { config } from "dotenv";
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

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

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

const fileUrl = new URL("../data/mold-part-master.json", import.meta.url);
const master = JSON.parse(await readFile(fileUrl, "utf8"));
const now = new Date().toISOString();

try {
  await client.query("BEGIN");
  await client.query("DELETE FROM molds");
  await client.query("DELETE FROM parts");

  const moldSql = `INSERT INTO molds
    (family, mold_no, vibes_description, cavities, cycle_time, req_tonn, inspection_time, shot_wt, sheet_wt, flash_wt, shot_target, running_ok_cavities, inspection_target, old_mold_no, manufacturing_year, plant, mold_material, source_row, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`;
  for (let i = 0; i < master.molds.length; i += 1) {
    const m = master.molds[i];
    await client.query(moldSql, [
      m.family, m.mold_no, m.vibes_description, toNullableNumber(m.cavities), toNullableNumber(m.cycle_time),
      m.req_tonn === null ? null : String(m.req_tonn), toNullableNumber(m.inspection_time), toNullableNumber(m.shot_wt),
      toNullableNumber(m.sheet_wt), toNullableNumber(m.flash_wt), toNullableNumber(m.shot_target),
      toNullableNumber(m.running_ok_cavities), toNullableNumber(m.inspection_target), m.old_mold_no,
      m.manufacturing_year, m.plant, m.mold_material, i + 2, now,
    ]);
  }

  const partSql = `INSERT INTO parts
    (part_no, family, description, commodity, insert_part_no, rubber_compound, rejection_allowed, part_weight, inspection, final_inspection_target, source_row, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
  for (let i = 0; i < master.parts.length; i += 1) {
    const p = master.parts[i];
    await client.query(partSql, [
      p.part_no, p.family, p.description, p.commodity, p.insert_part_no, p.rubber_compound,
      toNullableNumber(p.rejection_allowed), toNullableNumber(p.part_weight), toNullableNumber(p.inspection),
      toNullableNumber(p.final_inspection_target), i + 3, now,
    ]);
  }

  await client.query("COMMIT");
  console.log(`Imported ${master.molds.length} mold rows and ${master.parts.length} part rows.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
