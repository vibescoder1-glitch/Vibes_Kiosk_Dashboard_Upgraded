import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectUrl = new URL("../", import.meta.url);

test("uses standard Next.js production scripts", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", projectUrl), "utf8"));
  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "node server.js");
  assert.equal(packageJson.dependencies.mysql2, "3.14.5");
  assert.equal(packageJson.dependencies.vinext, undefined);
  assert.equal(packageJson.devDependencies.wrangler, undefined);
});

test("contains the required Hostinger MySQL tables", async () => {
  const schema = await readFile(new URL("database/mysql-schema.sql", projectUrl), "utf8");
  for (const table of [
    "operators",
    "machines",
    "schedules",
    "production_tasks",
    "production_entries",
    "kiosk_devices",
    "app_users",
    "auth_sessions",
    "operator_face_templates",
    "face_scan_sessions",
    "face_recognition_events",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test("contains no external gpt.site redirects", async () => {
  const files = [
    "app/kiosk/page.tsx",
    "app/operation-modules.tsx",
    "app/operations-dashboard.tsx",
  ];
  for (const file of files) {
    const contents = await readFile(new URL(file, projectUrl), "utf8");
    assert.doesNotMatch(contents, /gpt\.site/i);
  }
});

test("keeps the single supervisor dashboard protected by the legacy admin role", async () => {
  const route = await readFile(new URL("app/api/operations/route.ts", projectUrl), "utf8");
  assert.match(route, /applicationUser\.role !== "Manager"/);
  assert.match(route, /Supervisor authorization is required/);
});

test("keeps kiosk synchronization duplicate-safe", async () => {
  const schema = await readFile(new URL("database/mysql-schema.sql", projectUrl), "utf8");
  const operations = await readFile(new URL("lib/operations-data.ts", projectUrl), "utf8");
  assert.match(schema, /UNIQUE KEY production_entries_client_ref_unique/);
  assert.match(operations, /SELECT entry_code FROM production_entries WHERE client_ref = \?/);
});

test("uses one supervisor dashboard and automatically records its task owner", async () => {
  const operationModules = await readFile(new URL("app/operation-modules.tsx", projectUrl), "utf8");
  const operations = await readFile(new URL("lib/operations-data.ts", projectUrl), "utf8");
  const login = await readFile(new URL("app/api/auth/login/route.ts", projectUrl), "utf8");
  assert.doesNotMatch(operationModules, /Supervisor account/);
  assert.doesNotMatch(operationModules, /supervisorEmail/);
  assert.match(operations, /assignedBy\.name/);
  assert.match(login, /destination: "\/supervisor"/);
});

test("supports task-free kiosk entries and only active shifts", async () => {
  const kioskRoute = await readFile(new URL("app/api/kiosk/route.ts", projectUrl), "utf8");
  const operations = await readFile(new URL("lib/operations-data.ts", projectUrl), "utf8");
  assert.match(kioskRoute, /createProductionEntry/);
  assert.match(operations, /const taskId = String\\(input\\.taskId \\?\\? ""\\)\\.trim\\(\\) \\|\\| null/);
  assert.match(operations, /ACTIVE_SHIFTS = \["Morning", "Night"\]/);
  assert.match(operations, /UPDATE operators SET shift = 'Night' WHERE LOWER\(shift\) = 'evening'/);
});

test("keeps face recognition consent-based, encrypted, and supervisor controlled", async () => {
  const schema = await readFile(new URL("database/mysql-schema.sql", projectUrl), "utf8");
  const operations = await readFile(new URL("lib/operations-data.ts", projectUrl), "utf8");
  const route = await readFile(new URL("app/api/operations/route.ts", projectUrl), "utf8");
  const enrollment = await readFile(new URL("app/face-enrollment.tsx", projectUrl), "utf8");

  assert.match(schema, /descriptor_ciphertext MEDIUMTEXT NOT NULL/);
  assert.match(schema, /consent_granted TINYINT NOT NULL/);
  assert.match(schema, /enrolled_at VARCHAR\(32\) NOT NULL/);
  assert.doesNotMatch(schema, /face_(?:photo|image|video)/i);
  assert.match(operations, /crypto\.subtle\.encrypt/);
  assert.match(operations, /\{ name: "AES-GCM", iv \}/);
  assert.match(route, /enrollOperatorFace/);
  assert.match(route, /revokeOperatorFace/);
  assert.match(enrollment, /operator gave informed, documented consent/i);
});

test("uses short-lived, single-use face scan sessions and liveness checks", async () => {
  const schema = await readFile(new URL("database/mysql-schema.sql", projectUrl), "utf8");
  const faceScanApi = await readFile(new URL("app/api/face-scan/route.ts", projectUrl), "utf8");
  const faceScanPage = await readFile(new URL("app/face-scan/page.tsx", projectUrl), "utf8");

  assert.match(schema, /expires_at VARCHAR\(32\) NOT NULL/);
  assert.match(schema, /used_at VARCHAR\(32\) NULL/);
  assert.match(faceScanApi, /completeFaceScan/);
  assert.match(faceScanPage, /Blink once/);
  assert.match(faceScanPage, /stableCount < 2/);
});

test("validates task operator references before writing foreign keys", async () => {
  const operations = await readFile(new URL("lib/operations-data.ts", projectUrl), "utf8");
  assert.match(operations, /validateTaskReferences/);
  assert.match(operations, /Selected operator no longer exists/);
  assert.match(operations, /Selected operator does not belong to the selected plant/);
  assert.match(operations, /Completed tasks cannot be reassigned/);
});

test("keeps pending kiosk activation codes visible only to the supervisor dashboard", async () => {
  const operations = await readFile(new URL("lib/operations-data.ts", projectUrl), "utf8");
  const modules = await readFile(new URL("app/operation-modules.tsx", projectUrl), "utf8");
  const dashboard = await readFile(new URL("app/operations-dashboard.tsx", projectUrl), "utf8");
  const route = await readFile(new URL("app/api/operations/route.ts", projectUrl), "utf8");
  assert.match(operations, /registrationCode/);
  assert.match(operations, /regenerateKioskRegistrationCode/);
  assert.match(modules, /Activation code/);
  assert.match(modules, /New code/);
  assert.match(dashboard, /registration_code: string \| null/);
  assert.match(route, /regenerateKioskRegistrationCode/);
  assert.match(operations, /registration_code = NULL/);
});

test("uses Vibes Components as the configured supervisor display name", async () => {
  const envExample = await readFile(new URL(".env.example", projectUrl), "utf8");
  const envLocal = await readFile(new URL(".env.local", projectUrl), "utf8");
  assert.match(envExample, /INITIAL_SUPERVISOR_NAME=Vibes Components/);
  assert.match(envLocal, /INITIAL_SUPERVISOR_NAME=Vibes Components/);
});
