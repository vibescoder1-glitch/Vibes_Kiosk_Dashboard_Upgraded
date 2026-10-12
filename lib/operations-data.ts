import { database } from "./postgres";
import moldPartMaster from "../data/mold-part-master.json";

const OPERATOR_NAMES = [
  "Abhishek", "Ajay Kumar", "Alangbar Basuma", "Amal Basumatar", "Deepak Bordore", "Dilkhush Kumar", "Raj Tamang Jb", "Ramesh D", "Shavendra Harij",
  "Bironjoy 1", "Birsha Munda Jg", "Budhu Munda Jg", "Chune Lal Jg", "Dipu Urang Jg", "Durgesh Singh", "Jeki Munda Jg", "Sandeep Kol Jg",
  "SJivan Sing Jg", "Kishan Lal", "Mankhush K", "Mithlesh Jg", "Nandeswar Nar", "Nibash Jg", "Pungka Basumata", "Sanjay Daimary",
  "Amit Saket", "Anil Kumar", "Bhagvan Ja", "Bharat Thakur", "Rahin Daimary", "Rahul Kumar", "Rahul Sing Jg", "Savan Puri", "Somnath Sing",
  "Birbal Basuma", "Devan Saket", "Dipak Kumar", "Fadaram Basumat", "Rajbahadur Sak", "Rupesh Kumar", "Saban Basumata", "Shankar", "Sonu Baiga", "Sukhiram Basumatry",
  "Fwajakhang Nar", "Gokul Kewat Jg", "Hananta Bastmat", "Hari Dayal Jg", "Sagar Singh Jg", "Samar Sing Jg", "Sanju Urang", "Sumnant", "Suraj", "Suraj Kumar",
  "Jaypal Saket", "Khanthai Wary", "Khushi Choudha", "Krishna Roy", "Santkumar Si Jg", "Swrang Basumata", "Umesh Sing Jg", "Swmdwm Basumatry", "Taisan",
  "Manjil Basumata", "Milan Basumata", "Pancham", "Panchoo Yadav", "Varis Deewan Jg", "Vijay Singh Jg", "Amit Kol", "Arjun Basumatry",
  "Pappu Saket", "Pwajakhang War", "Raju Khade Jb", "Ramesh Saket", "Arun Sahu", "Ashish Harijan", "Bal Bahadur Ch", "Biren", "Vijay Choudhary",
  "Ravikumar Kol", "Robin New", "Shubham Irpach", "Sudip Ch", "Chandi Den Ch", "Dwithun Khakla", "Jitendra Ku Ch", "Kishur Kumarbo", "Vikas Kol",
  "Thurun Basumata", "Arjun Sing Gond", "Biranjoy Dai 2", "Birju Boro", "Manik Baglari", "Mridul Borbolo", "Niral", "Prakash Ch", "Raja Basumatry",
];

const PRODUCTS = [
  "Cable Seal", "Connector Grommet", "Rubber Bellows", "EV",
  "Terminal Seal", "Wire Grommet", "Sensor Boot", "Engineering", "Motor",
];

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIME_ZONE?.trim() || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const ACTIVE_SHIFTS = ["Morning", "Night"] as const;

function requiredActiveShift(value: unknown) {
  const shift = String(value ?? "").trim();
  if (!ACTIVE_SHIFTS.includes(shift as (typeof ACTIVE_SHIFTS)[number])) {
    throw new Error("shift must be Morning or Night");
  }
  return shift;
}

const PASSWORD_ITERATIONS = 100_000;

async function runtimeVariable(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function getDatabase() {
  return database;
}

type OperationsDatabase = Awaited<ReturnType<typeof getDatabase>>;
type OperationsStatement = ReturnType<OperationsDatabase["prepare"]>;

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getDatabase();
      try {
        await db.prepare("ALTER TABLE production_entries ADD COLUMN supervisor_name VARCHAR(191) NOT NULL DEFAULT ''").run();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const code = (error as { code?: string })?.code ?? "";
        if (code !== "42701" && !message.includes("duplicate column") && !message.includes("already exists")) throw error;
      }
      try {
        await db.prepare("ALTER TABLE production_entries ADD COLUMN colour VARCHAR(64) NOT NULL DEFAULT ''").run();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const code = (error as { code?: string })?.code ?? "";
        if (code !== "42701" && !message.includes("duplicate column") && !message.includes("already exists")) throw error;
      }
      for (const statement of [
        "ALTER TABLE production_entries ADD COLUMN weight_unit VARCHAR(16) NOT NULL DEFAULT 'grams'",
        "ALTER TABLE production_entries ADD COLUMN running_cavities INT NOT NULL DEFAULT 0",
        "ALTER TABLE production_entries ADD COLUMN operator_hours DECIMAL(6,2) NOT NULL DEFAULT 8",
        "ALTER TABLE production_entries ADD COLUMN rubber_compound VARCHAR(191) NOT NULL DEFAULT ''",
        "ALTER TABLE production_entries ADD COLUMN compound_received_kg DECIMAL(12,3) NOT NULL DEFAULT 0",
        "ALTER TABLE production_entries ADD COLUMN compound_used_kg DECIMAL(12,3) NOT NULL DEFAULT 0",
        "ALTER TABLE production_entries ADD COLUMN compound_balance_kg DECIMAL(12,3) NOT NULL DEFAULT 0",
        "ALTER TABLE production_entries ADD COLUMN part_number VARCHAR(191) NOT NULL DEFAULT ''",
        "ALTER TABLE production_entries ADD COLUMN family_number VARCHAR(191) NOT NULL DEFAULT ''",
      ]) {
        try { await db.prepare(statement).run(); }
        catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          const code = (error as { code?: string })?.code ?? "";
          if (code !== "42701" && !message.includes("duplicate column") && !message.includes("already exists")) throw error;
        }
      }
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS supervisors (
          id VARCHAR(64) NOT NULL,
          name VARCHAR(191) NOT NULL,
          plant VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'Active',
          created_at VARCHAR(32) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE (plant, name)
        )`,
      ).run();
      await db.prepare("CREATE INDEX IF NOT EXISTS supervisors_plant_idx ON supervisors (plant)").run();
      // Remove only the legacy demo production rows created by the old seed routine.
      // Real kiosk entries use android-* client references (or a kiosk device id) and are untouched.
      await db.prepare("DELETE FROM production_entries WHERE client_ref LIKE 'seed-%'").run();
      const supervisorCount = await db.prepare("SELECT COUNT(*) AS total FROM supervisors").first<{ total: number }>();
      if (!supervisorCount || Number(supervisorCount.total) === 0) {
        const defaultSupervisors = [
          ["Plant 1", "Yogesh Jadhav "],
          ["Plant 2", "Ravi Sir "],
          ["Plant 3", "Muthumani sir"],
        ] as const;
        const createdAt = nowIso();
        await db.batch(
          defaultSupervisors.map(([plant, name]) => db.prepare(
            "INSERT INTO supervisors (id, name, plant, status, created_at) VALUES (?, ?, ?, 'Active', ?)",
          ).bind(`SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name, plant, createdAt)),
        );
      }
      await db.batch([
        db.prepare("UPDATE operators SET shift = 'Night' WHERE LOWER(shift) = 'evening'"),
        db.prepare("UPDATE schedules SET shift = 'Night' WHERE LOWER(shift) = 'evening'"),
        db.prepare("UPDATE production_tasks SET shift = 'Night' WHERE LOWER(shift) = 'evening' AND LOWER(status) <> 'completed'"),
      ]);
      await db.prepare(`
        UPDATE production_entries
        SET colour = CASE
          WHEN TRIM(COALESCE(colour, '')) <> '' THEN colour
          WHEN product ~ '-00($|-)' THEN 'Transparent'
          WHEN product ~ '-10($|-)' THEN 'White'
          WHEN product ~ '-20($|-)' THEN 'Red'
          WHEN product ~ '-21($|-)' THEN 'Brown'
          WHEN product ~ '-30($|-)' THEN 'Black'
          WHEN product ~ '-40($|-)' THEN 'Yellow'
          WHEN product ~ '-50($|-)' THEN 'Green'
          WHEN product ~ '-60($|-)' THEN 'Blue'
          WHEN product ~ '-70($|-)' THEN 'Grey'
          WHEN product ~ '-80($|-)' THEN 'Orange'
          ELSE COALESCE(colour, '')
        END
        WHERE TRIM(COALESCE(colour, '')) = ''
      `).run();
      await db.prepare(`
        UPDATE production_entries e
        SET rubber_compound = COALESCE(p.rubber_compound, '')
        FROM parts p
        WHERE TRIM(COALESCE(e.rubber_compound, '')) = ''
          AND p.part_no = e.product
          AND TRIM(COALESCE(p.rubber_compound, '')) <> ''
      `).run();
      await db.prepare(`
        UPDATE production_entries
        SET compound_balance_kg = GREATEST(0, compound_received_kg - compound_used_kg)
        WHERE compound_balance_kg = 0
          AND (compound_received_kg > 0 OR compound_used_kg > 0)
      `).run();
      const existingManager = await db.prepare(
        "SELECT email, password_iterations FROM app_users WHERE role IN ('Manager', 'Supervisor') ORDER BY CASE WHEN role = 'Supervisor' THEN 0 ELSE 1 END LIMIT 1",
      ).first<{ email: string; password_iterations: number | null }>();
      if (!existingManager || !existingManager.password_iterations) {
        const managerEmail = (
          await runtimeVariable("INITIAL_SUPERVISOR_EMAIL")
          || await runtimeVariable("INITIAL_MANAGER_EMAIL")
        ).trim().toLowerCase();
        const managerName = (
          await runtimeVariable("INITIAL_SUPERVISOR_NAME")
          || await runtimeVariable("INITIAL_MANAGER_NAME")
        ).trim() || "Factory Supervisor";
        const managerPassword = (
          await runtimeVariable("INITIAL_SUPERVISOR_PASSWORD")
          || await runtimeVariable("INITIAL_MANAGER_PASSWORD")
        );
        if (!managerEmail.includes("@")) throw new Error("INITIAL_SUPERVISOR_EMAIL must contain a valid company email");
        if (managerPassword.length < 12) throw new Error("INITIAL_SUPERVISOR_PASSWORD must contain at least 12 characters");
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passwordHash = await derivePasswordHash(managerPassword, salt);
        if (!existingManager) {
          await db.prepare(
            `INSERT INTO app_users (email, login_id, password_salt, password_hash, password_iterations, name, role, plant, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'Manager', NULL, 1, ?)`,
          ).bind(
            managerEmail,
            managerEmail,
            bytesToBase64(salt),
            passwordHash,
            PASSWORD_ITERATIONS,
            managerName,
            nowIso(),
          ).run();
        } else {
          await db.prepare(
            "UPDATE app_users SET login_id = ?, password_salt = ?, password_hash = ?, password_iterations = ?, name = ? WHERE email = ?",
          ).bind(
            existingManager.email,
            bytesToBase64(salt),
            passwordHash,
            PASSWORD_ITERATIONS,
            managerName,
            existingManager.email,
          ).run();
        }
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function runBatches(statements: OperationsStatement[]) {
  const db = await getDatabase();
  for (let start = 0; start < statements.length; start += 80) {
    await db.batch(statements.slice(start, start + 80));
  }
}

export async function ensureSeedData() {
  await ensureSchema();
  if (process.env.SEED_DEMO_DATA?.toLowerCase() !== "true") return;
  const db = await getDatabase();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM operators").first<{ total: number }>();
  if (Number(count?.total ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();
  const today = todayIso();
  const statements: OperationsStatement[] = [];

  OPERATOR_NAMES.forEach((name, index) => {
    const plant = `Plant ${Math.floor(index / 12) + 1}`;
    const shift = ACTIVE_SHIFTS[index % ACTIVE_SHIFTS.length];
    statements.push(
      db.prepare(
        "INSERT INTO operators (id, employee_code, name, plant, shift, status, skill_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        `OP-${String(index + 1).padStart(3, "0")}`,
        `VC${String(index + 1).padStart(3, "0")}`,
        name,
        plant,
        shift,
        index < 31 ? "Active" : "Off Shift",
        `L${(index % 3) + 1}`,
        createdAt,
      ),
    );
  });

  for (let plantNumber = 1; plantNumber <= 3; plantNumber += 1) {
    for (let machineNumber = 1; machineNumber <= 12; machineNumber += 1) {
      const globalIndex = (plantNumber - 1) * 12 + machineNumber - 1;
      const status = globalIndex < 29
        ? "Running"
        : globalIndex < 33
          ? "Idle"
          : globalIndex < 35
            ? "Maintenance"
            : "Breakdown";
      const machineId = `P${plantNumber}-M${String(machineNumber).padStart(2, "0")}`;
      const shift = machineNumber <= 6 ? "Morning" : "Night";
      const operatorIndex = globalIndex;
      const output = status === "Running" ? 260 + ((globalIndex * 47) % 220) : 0;

      statements.push(
        db.prepare(
          "INSERT INTO machines (id, machine_no, plant, status, current_operator_id, product, output_today, target_today, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          machineId,
          `M${machineNumber}`,
          `Plant ${plantNumber}`,
          status,
          operatorIndex < 31 ? `OP-${String(operatorIndex + 1).padStart(3, "0")}` : null,
          PRODUCTS[globalIndex % PRODUCTS.length],
          output,
          500,
          createdAt,
        ),
      );

      statements.push(
        db.prepare(
          "INSERT INTO schedules (schedule_date, plant, shift, machine_id, operator_id, product, target_qty, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          today,
          `Plant ${plantNumber}`,
          shift,
          machineId,
          `OP-${String((operatorIndex % 36) + 1).padStart(3, "0")}`,
          PRODUCTS[globalIndex % PRODUCTS.length],
          500,
          shift === "Morning" ? "In Progress" : "Scheduled",
          "Supervisor",
          createdAt,
        ),
      );
    }
  }

  [1, 2, 3].forEach((plantNumber) => {
    statements.push(
      db.prepare(
        "INSERT INTO kiosk_devices (id, name, plant, status, last_seen, pending_sync, app_version) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        `KIOSK-P${plantNumber}`,
        `Plant ${plantNumber} Kiosk`,
        `Plant ${plantNumber}`,
        plantNumber === 3 ? "Offline" : "Online",
        new Date(Date.now() - plantNumber * 7 * 60_000).toISOString(),
        plantNumber === 2 ? 2 : plantNumber === 3 ? 18 : 0,
        "1.0.0",
      ),
    );
  });

  for (let index = 0; index < 6; index += 1) {
    const plantNumber = (index % 3) + 1;
    const machineNumber = index + 1;
    const machineId = `P${plantNumber}-M${String(machineNumber).padStart(2, "0")}`;
    const operatorId = `OP-${String(((plantNumber - 1) * 12 + machineNumber)).padStart(3, "0")}`;
    statements.push(
      db.prepare(
        "INSERT INTO production_tasks (id, task_code, title, plant, machine_id, supervisor_name, operator_id, shift, product, mold_no, target_shots, target_weight_grams, due_date, priority, status, instructions, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        `TASK-${String(index + 1).padStart(3, "0")}`,
        `PT-${today.replaceAll("-", "")}-${String(index + 1).padStart(2, "0")}`,
        `Run ${PRODUCTS[index % PRODUCTS.length]}`,
        `Plant ${plantNumber}`,
        machineId,
        ["Yogesh Jadhav", "Ravi sir ", "Mutumani"][plantNumber - 1],
        operatorId,
        ACTIVE_SHIFTS[index % ACTIVE_SHIFTS.length],
        PRODUCTS[index % PRODUCTS.length],
        `MD-${210 + index}`,
        500 + index * 50,
        18 + index * 2,
        today,
        index === 0 ? "High" : "Normal",
        index < 3 ? "Ready" : "Assigned",
        "Record shots, part weight and any downtime before completing the task.",
        "Factory Supervisor",
        createdAt,
        createdAt,
      ),
    );
  }



  await runBatches(statements);
}

export async function getOperationsSnapshot(date = todayIso()) {
  const db = await getDatabase();
  await ensureSeedData();
  const [operators, machines, supervisors, schedules, tasks, entries, kiosks, molds, parts] = await Promise.all([
    db.prepare("SELECT * FROM operators ORDER BY plant, name").all(),
    db.prepare("SELECT * FROM machines ORDER BY plant, CAST(regexp_replace(machine_no, '\\D', '', 'g') AS INTEGER)").all(),
    db.prepare("SELECT * FROM supervisors ORDER BY plant, name").all(),
    db.prepare(
      "SELECT s.*, o.name AS operator_name, o.employee_code, m.machine_no FROM schedules s JOIN operators o ON o.id = s.operator_id JOIN machines m ON m.id = s.machine_id WHERE s.schedule_date = ? ORDER BY s.plant, s.shift, CAST(regexp_replace(m.machine_no, '\\D', '', 'g') AS INTEGER)",
    ).bind(date).all(),
    db.prepare(
      "SELECT t.*, m.machine_no, o.name AS operator_name, o.employee_code FROM production_tasks t JOIN machines m ON m.id = t.machine_id LEFT JOIN operators o ON o.id = t.operator_id WHERE t.due_date = ? ORDER BY CASE t.priority WHEN 'High' THEN 0 ELSE 1 END, t.plant, t.created_at DESC",
    ).bind(date).all(),
    db.prepare(
      "SELECT e.*, o.name AS operator_name, o.employee_code, m.machine_no FROM production_entries e JOIN operators o ON o.id = e.operator_id JOIN machines m ON m.id = e.machine_id WHERE COALESCE(e.client_ref, '') NOT LIKE 'seed-%' ORDER BY e.created_at DESC, e.id DESC",
    ).all(),
    db.prepare("SELECT * FROM kiosk_devices ORDER BY plant").all(),
    db.prepare("SELECT * FROM molds ORDER BY family, mold_no, id").all(),
    db.prepare("SELECT * FROM parts ORDER BY family, part_no").all(),
  ]);

  return {
    date,
    operators: operators.results,
    machines: machines.results,
    supervisors: supervisors.results,
    schedules: schedules.results,
    tasks: tasks.results,
    entries: entries.results,
    kiosks: kiosks.results,
    molds: molds.results,
    parts: parts.results,
  };
}

export type ApplicationUser = {
  email: string;
  login_id: string | null;
  name: string;
  role: "Manager" | "Supervisor";
  plant: string | null;
  active: number;
};

export async function getApplicationUser(email: string) {
  await ensureSchema();
  const db = await getDatabase();
  return db.prepare(
    "SELECT email, login_id, name, role, plant, active FROM app_users WHERE lower(email) = lower(?) AND active = 1",
  ).bind(email).first<ApplicationUser>();
}

export async function getApplicationUsers() {
  await ensureSchema();
  const db = await getDatabase();
  const result = await db.prepare(
    "SELECT email, login_id, name, role, plant, active FROM app_users ORDER BY role, name",
  ).all<ApplicationUser>();
  return result.results;
}

export async function authorizeApplicationUser(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const name = String(input.name ?? "").trim();
  const role = "Supervisor";
  if (!email || !email.includes("@") || !name) throw new Error("Name and company email are required");
  if (password.length < 10) throw new Error("Password must contain at least 10 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePasswordHash(password, salt);
  await db.prepare(
    `INSERT INTO app_users (email, login_id, password_salt, password_hash, password_iterations, name, role, plant, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT (email) DO UPDATE SET login_id = EXCLUDED.login_id, password_salt = EXCLUDED.password_salt,
       password_hash = EXCLUDED.password_hash, password_iterations = EXCLUDED.password_iterations,
       name = EXCLUDED.name, role = EXCLUDED.role, plant = EXCLUDED.plant, active = 1`,
  ).bind(email, email, bytesToBase64(salt), passwordHash, PASSWORD_ITERATIONS, name, role, input.plant || null, nowIso()).run();
  return { email, role };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const normalizedSalt = Uint8Array.from(salt);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: normalizedSalt, iterations: Math.min(PASSWORD_ITERATIONS, Math.max(1, iterations)) },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function authenticateApplicationUser(emailValue: string, password: string, role: string) {
  await ensureSchema();
  const db = await getDatabase();
  const email = emailValue.trim().toLowerCase();
  const user = await db.prepare(
    "SELECT email, login_id, name, role, plant, active, password_salt, password_hash, password_iterations FROM app_users WHERE lower(email) = lower(?) AND active = 1 AND role IN ('Supervisor')",
  ).bind(email).first<{
    email: string;
    login_id: string | null;
    name: string;
    role: string;
    plant: string | null;
    active: number;
    password_salt: string | null;
    password_hash: string | null;
    password_iterations: number | null;
  }>();
  if (
    !user?.password_salt ||
    !user?.password_hash ||
    !["Supervisor"].includes(user.role)
  ) return null;
  const candidate = await derivePasswordHash(password, base64ToBytes(user.password_salt), Number(user.password_iterations ?? PASSWORD_ITERATIONS));
  if (!safeEqual(candidate, user.password_hash)) return null;
  return { email: user.email, login_id: user.login_id, name: user.name, role: user.role, plant: user.plant, active: user.active };
}

export async function changeApplicationPassword(email: string, currentPassword: string, newPassword: string) {
  await ensureSchema();
  const db = await getDatabase();
  if (newPassword.length < 10) throw new Error("New password must contain at least 10 characters");
  if (newPassword === currentPassword) throw new Error("New password must be different from the current password");
  const user = await db.prepare(
    "SELECT password_salt, password_hash, password_iterations FROM app_users WHERE email = ? AND active = 1",
  ).bind(email).first<{ password_salt: string | null; password_hash: string | null; password_iterations: number | null }>();
  if (!user?.password_salt || !user.password_hash) throw new Error("Password account is not configured");
  const currentHash = await derivePasswordHash(
    currentPassword,
    base64ToBytes(user.password_salt),
    Number(user.password_iterations ?? PASSWORD_ITERATIONS),
  );
  if (!safeEqual(currentHash, user.password_hash)) throw new Error("Current password is incorrect");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newHash = await derivePasswordHash(newPassword, salt);
  await db.batch([
    db.prepare(
      "UPDATE app_users SET password_salt = ?, password_hash = ?, password_iterations = ? WHERE email = ?",
    ).bind(bytesToBase64(salt), newHash, PASSWORD_ITERATIONS, email),
    db.prepare("DELETE FROM auth_sessions WHERE user_email = ?").bind(email),
  ]);
}

export async function createApplicationSession(email: string) {
  await ensureSchema();
  const db = await getDatabase();

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));

  const token = bytesToBase64(tokenBytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  const tokenHash = await hashToken(token);

  const expiresAt = new Date(
    Date.now() + 8 * 60 * 60 * 1000,
  ).toISOString();

  await db
    .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
    .bind(nowIso())
    .run();

  await db
    .prepare(
      "INSERT INTO auth_sessions (token_hash, user_email, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(
      tokenHash,
      email,
      expiresAt,
      nowIso(),
    )
    .run();

  console.log("[SESSION CREATED]", {
    email,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function getApplicationSession(token: string) {
  if (!token) return null;

  await ensureSchema();

  const db = await getDatabase();
  const tokenHash = await hashToken(token);

  const sessionUser = await db
    .prepare(
      `SELECT u.email, u.login_id, u.name, u.role, u.plant, u.active
       FROM auth_sessions s
       JOIN app_users u ON u.email = s.user_email
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .bind(tokenHash, nowIso())
    .first<ApplicationUser>();

  console.log("[SESSION CHECK]", {
    tokenReceived: Boolean(token),
    sessionFound: Boolean(sessionUser),
    email: sessionUser?.email ?? null,
    role: sessionUser?.role ?? null,
    active: sessionUser?.active ?? null,
  });

  return sessionUser;
}

export async function deleteApplicationSession(token: string) {
  if (!token) return;

  await ensureSchema();

  const db = await getDatabase();

  await db
    .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
    .bind(await hashToken(token))
    .run();
}

function normalizeId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type ImportRow = Record<string, unknown>;

export async function replaceCompanyData(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const operators = Array.isArray(input.operators) ? input.operators as ImportRow[] : [];
  const machines = Array.isArray(input.machines) ? input.machines as ImportRow[] : [];
  if (!operators.length || !machines.length) throw new Error("Both operator and machine files are required");

  const seenEmployees = new Set<string>();
  const normalizedOperators = operators.map((row, index) => {
    const employeeCode = String(row.employee_code ?? row.employeeCode ?? "").trim().toUpperCase();
    const name = String(row.name ?? "").trim();
    const plant = String(row.plant ?? "").trim();
    if (!employeeCode || !name || !plant) throw new Error(`Operator row ${index + 1} needs employee_code, name and plant`);
    if (seenEmployees.has(employeeCode)) throw new Error(`Duplicate employee code: ${employeeCode}`);
    seenEmployees.add(employeeCode);
    return {
      id: `OP-${normalizeId(employeeCode)}`,
      employeeCode,
      name,
      plant,
      shift: requiredActiveShift(row.shift ?? "Morning"),
      status: String(row.status ?? "Active").trim() || "Active",
      skillLevel: String(row.skill_level ?? row.skillLevel ?? "L1").trim() || "L1",
    };
  });

  const seenMachines = new Set<string>();
  const normalizedMachines = machines.map((row, index) => {
    const machineNo = String(row.machine_no ?? row.machineNo ?? "").trim().toUpperCase();
    const plant = String(row.plant ?? "").trim();
    if (!machineNo || !plant) throw new Error(`Machine row ${index + 1} needs machine_no and plant`);
    const key = `${plant.toLowerCase()}::${machineNo}`;
    if (seenMachines.has(key)) throw new Error(`Duplicate machine: ${plant} ${machineNo}`);
    seenMachines.add(key);
    const operatorCode = String(row.current_operator_code ?? row.currentOperatorCode ?? "").trim().toUpperCase();
    return {
      id: `MC-${normalizeId(plant)}-${normalizeId(machineNo)}`,
      machineNo,
      plant,
      status: String(row.status ?? "Idle").trim() || "Idle",
      currentOperatorId: operatorCode ? `OP-${normalizeId(operatorCode)}` : null,
      product: String(row.product ?? "Unassigned").trim() || "Unassigned",
      targetToday: Math.max(0, Number(row.target_today ?? row.targetToday ?? 500)),
    };
  });

  await db.batch([
    db.prepare("DELETE FROM production_entries"),
    db.prepare("DELETE FROM production_tasks"),
    db.prepare("DELETE FROM schedules"),
    db.prepare("DELETE FROM machines"),
    db.prepare("DELETE FROM operators"),
  ]);

  const createdAt = nowIso();
  await runBatches(normalizedOperators.map((operator) => db.prepare(
    "INSERT INTO operators (id, employee_code, name, plant, shift, status, skill_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(operator.id, operator.employeeCode, operator.name, operator.plant, operator.shift, operator.status, operator.skillLevel, createdAt)));
  await runBatches(normalizedMachines.map((machine) => db.prepare(
    "INSERT INTO machines (id, machine_no, plant, status, current_operator_id, product, output_today, target_today, last_updated) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)",
  ).bind(machine.id, machine.machineNo, machine.plant, machine.status, machine.currentOperatorId, machine.product, machine.targetToday, createdAt)));

  return { operators: normalizedOperators.length, machines: normalizedMachines.length };
}

function registrationCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

async function hashToken(token: string) {
  const sessionSecret = process.env.SESSION_SECRET?.trim() ?? "";
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function faceMatchThreshold() {
  const configured = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.5);
  return Number.isFinite(configured) ? Math.min(0.65, Math.max(0.35, configured)) : 0.5;
}

async function faceTemplateKey() {
  const secret = process.env.FACE_TEMPLATE_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("FACE_TEMPLATE_SECRET must contain at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function validateFaceDescriptor(value: unknown) {
  if (!Array.isArray(value) || value.length !== 128) {
    throw new Error("A valid 128-value face descriptor is required");
  }
  const descriptor = value.map(Number);
  if (descriptor.some((item) => !Number.isFinite(item) || Math.abs(item) > 2)) {
    throw new Error("The face descriptor contains invalid values");
  }
  return descriptor;
}

async function encryptFaceDescriptor(descriptor: number[]) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(descriptor));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await faceTemplateKey(),
    plaintext,
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

async function decryptFaceDescriptor(ciphertext: string, iv: string) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    await faceTemplateKey(),
    base64ToBytes(ciphertext),
  );
  return validateFaceDescriptor(JSON.parse(new TextDecoder().decode(plaintext)) as unknown);
}

export type FaceEnrollmentStatus = {
  operator_id: string;
  employee_code: string;
  name: string;
  plant: string;
  enrolled: number;
  consent_granted: number;
  sample_count: number | null;
  enrolled_at: string | null;
  updated_at: string | null;
};

export async function getFaceEnrollmentStatuses() {
  await ensureSchema();
  const db = await getDatabase();
  const result = await db.prepare(
    `SELECT o.id AS operator_id, o.employee_code, o.name, o.plant,
       CASE WHEN f.operator_id IS NULL THEN 0 ELSE 1 END AS enrolled,
       COALESCE(f.consent_granted, 0) AS consent_granted,
       f.sample_count, f.enrolled_at, f.updated_at
     FROM operators o
     LEFT JOIN operator_face_templates f ON f.operator_id = o.id
     WHERE o.status = 'Active'
     ORDER BY o.plant, o.name`,
  ).all<FaceEnrollmentStatus>();
  return result.results;
}

export async function enrollOperatorFace(input: Record<string, unknown>, enrolledBy: string) {
  await ensureSchema();
  const db = await getDatabase();
  const operatorId = String(input.operatorId ?? "").trim();
  const consentGranted = input.consentGranted === true;
  const sampleCount = Math.min(10, Math.max(1, Number(input.sampleCount ?? 3)));
  if (!operatorId) throw new Error("Operator is required");
  if (!consentGranted) throw new Error("Documented operator consent is required before enrollment");
  const operator = await db.prepare(
    "SELECT id FROM operators WHERE id = ? AND status = 'Active'",
  ).bind(operatorId).first<{ id: string }>();
  if (!operator) throw new Error("Active operator was not found");
  const encrypted = await encryptFaceDescriptor(validateFaceDescriptor(input.descriptor));
  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO operator_face_templates
       (operator_id, descriptor_ciphertext, descriptor_iv, model_version, sample_count, consent_granted, enrolled_by, enrolled_at, updated_at)
     VALUES (?, ?, ?, 'face-api-1.7.15', ?, 1, ?, ?, ?)
     ON CONFLICT (operator_id) DO UPDATE SET descriptor_ciphertext = EXCLUDED.descriptor_ciphertext,
       descriptor_iv = EXCLUDED.descriptor_iv, model_version = EXCLUDED.model_version,
       sample_count = EXCLUDED.sample_count, consent_granted = 1,
       enrolled_by = EXCLUDED.enrolled_by, updated_at = EXCLUDED.updated_at`,
  ).bind(operatorId, encrypted.ciphertext, encrypted.iv, sampleCount, enrolledBy, timestamp, timestamp).run();
  return { operatorId, enrolledAt: timestamp };
}

export async function revokeOperatorFace(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const operatorId = String(input.operatorId ?? "").trim();
  if (!operatorId) throw new Error("Operator is required");
  await db.prepare("DELETE FROM operator_face_templates WHERE operator_id = ?").bind(operatorId).run();
  return { operatorId, revoked: true };
}

export async function createFaceScanSession(kiosk: AuthorizedKiosk) {
  await ensureSchema();
  const db = await getDatabase();
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM face_scan_sessions WHERE expires_at <= ? OR used_at IS NOT NULL").bind(nowIso()),
    db.prepare(
      "INSERT INTO face_scan_sessions (token_hash, kiosk_id, plant, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)",
    ).bind(await hashToken(token), kiosk.id, kiosk.plant, expiresAt, nowIso()),
  ]);
  return { sessionToken: token, expiresAt };
}

type FaceScanSession = {
  token_hash: string;
  kiosk_id: string;
  plant: string;
  expires_at: string;
  used_at: string | null;
};

async function activeFaceScanSession(token: string) {
  if (!token) return null;
  await ensureSchema();
  const db = await getDatabase();
  return db.prepare(
    "SELECT token_hash, kiosk_id, plant, expires_at, used_at FROM face_scan_sessions WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL",
  ).bind(await hashToken(token), nowIso()).first<FaceScanSession>();
}

export async function getFaceScanPayload(token: string) {
  const session = await activeFaceScanSession(token);
  if (!session) throw new Error("Face scan session is invalid or expired");
  const db = await getDatabase();
  const result = await db.prepare(
    `SELECT o.id, o.employee_code, o.name, o.plant, o.shift, o.skill_level,
      f.descriptor_ciphertext, f.descriptor_iv
     FROM operator_face_templates f
     JOIN operators o ON o.id = f.operator_id
     WHERE o.status = 'Active' AND f.consent_granted = 1
     ORDER BY o.name`
  ).all<{
    id: string;
    employee_code: string;
    name: string;
    plant: string;
    shift: string;
    skill_level: string;
    descriptor_ciphertext: string;
    descriptor_iv: string;
  }>();
  const operators = await Promise.all(result.results.map(async (operator) => ({
    id: operator.id,
    employeeCode: operator.employee_code,
    name: operator.name,
    plant: operator.plant,
    shift: operator.shift,
    skillLevel: operator.skill_level,
    descriptor: await decryptFaceDescriptor(operator.descriptor_ciphertext, operator.descriptor_iv),
  })));
  return {
    plant: session.plant,
    operators,
    threshold: faceMatchThreshold(),
    expiresAt: session.expires_at,
  };
}

export async function completeFaceScan(token: string, input: Record<string, unknown>) {
  const session = await activeFaceScanSession(token);
  if (!session) throw new Error("Face scan session is invalid or expired");
  const db = await getDatabase();
  const operatorId = String(input.operatorId ?? "").trim();
  const distance = Number(input.distance);
  if (!operatorId || !Number.isFinite(distance) || distance < 0 || distance > faceMatchThreshold()) {
    throw new Error("Face match could not be verified");
  }
  const operator = await db.prepare(
    `SELECT o.id, o.employee_code, o.name, o.plant, o.shift, o.skill_level
       FROM operators o JOIN operator_face_templates f ON f.operator_id = o.id
       WHERE o.id = ? AND o.status = 'Active' AND f.consent_granted = 1`,
  ).bind(operatorId).first<{
    id: string;
    employee_code: string;
    name: string;
    plant: string;
    shift: string;
    skill_level: string;
  }>();
  if (!operator) throw new Error("Matched operator is not authorized for this plant");
  const timestamp = nowIso();
  await db.batch([
    db.prepare(
      "INSERT INTO face_recognition_events (kiosk_id, operator_id, outcome, distance_millis, created_at) VALUES (?, ?, 'Matched', ?, ?)",
    ).bind(session.kiosk_id, operator.id, Math.round(distance * 1000), timestamp),
    db.prepare("UPDATE face_scan_sessions SET used_at = ? WHERE token_hash = ? AND used_at IS NULL")
      .bind(timestamp, session.token_hash),
  ]);
  return {
    operator: {
      id: operator.id,
      employeeCode: operator.employee_code,
      name: operator.name,
      plant: operator.plant,
      shift: operator.shift,
      skillLevel: operator.skill_level,
    },
  };
}

export async function registerKiosk(input: Record<string, unknown>, authorizedBy: string) {
  await ensureSchema();
  const db = await getDatabase();
  const name = String(input.name ?? "").trim();
  const plant = String(input.plant ?? "").trim();
  if (!name || !plant) throw new Error("Kiosk name and plant are required");
  const id = `KIOSK-${normalizeId(plant)}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const code = registrationCode();
  await db.prepare(
    "INSERT INTO kiosk_devices (id, name, plant, status, last_seen, pending_sync, app_version, authorization_status, registration_code, authorized_by, offline_test_status) VALUES (?, ?, ?, 'Pending', ?, 0, '1.1.0', 'Pending', ?, ?, 'Untested')",
  ).bind(id, name, plant, nowIso(), code, authorizedBy).run();
  return { id, registrationCode: code };
}

export async function regenerateKioskRegistrationCode(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const kioskId = String(input.kioskId ?? "").trim();
  if (!kioskId) throw new Error("Kiosk ID is required");
  const kiosk = await db.prepare(
    "SELECT id, authorization_status FROM kiosk_devices WHERE id = ?",
  ).bind(kioskId).first<{ id: string; authorization_status: string }>();
  if (!kiosk) throw new Error("Kiosk device was not found");
  if (kiosk.authorization_status.toLowerCase() === "authorized") {
    throw new Error("This kiosk is already authorized. Delete it and register a new kiosk if you need a new activation code.");
  }
  const code = registrationCode();
  await db.prepare(
    "UPDATE kiosk_devices SET registration_code = ?, authorization_status = 'Pending', status = 'Offline', last_seen = ? WHERE id = ?",
  ).bind(code, nowIso(), kioskId).run();
  return { id: kioskId, registrationCode: code };
}

export async function deleteKiosk(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const kioskId = String(input.kioskId ?? "").trim();
  if (!kioskId) throw new Error("Kiosk ID is required");
  const result = await db.prepare("DELETE FROM kiosk_devices WHERE id = ?").bind(kioskId).run();
  if (!result.meta.changes) throw new Error("Kiosk device was not found");
  return { deleted: kioskId };
}

export type AuthorizedKiosk = {
  id: string;
  name: string;
  plant: string;
  authorization_status: string;
};

export async function activateKiosk(codeValue: string) {
  await ensureSchema();
  const db = await getDatabase();
  const code = codeValue.trim().toUpperCase();
  const kiosk = await db.prepare(
    "SELECT id, name, plant, authorization_status FROM kiosk_devices WHERE registration_code = ?",
  ).bind(code).first<AuthorizedKiosk>();
  if (!kiosk) throw new Error("Registration code is invalid or expired");
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await hashToken(token);
  await db.prepare(
    "UPDATE kiosk_devices SET token_hash = ?, registration_code = NULL, authorization_status = 'Authorized', authorized_at = ?, status = 'Online', last_seen = ? WHERE id = ?",
  ).bind(tokenHash, nowIso(), nowIso(), kiosk.id).run();
  return { token, kiosk: { ...kiosk, authorization_status: "Authorized" } };
}

export async function authorizeKioskToken(token: string) {
  await ensureSchema();
  if (!token) return null;
  const db = await getDatabase();
  const tokenHash = await hashToken(token);
  return db.prepare(
    "SELECT id, name, plant, authorization_status FROM kiosk_devices WHERE token_hash = ? AND authorization_status = 'Authorized'",
  ).bind(tokenHash).first<AuthorizedKiosk>();
}

export async function getKioskSnapshot(kiosk: AuthorizedKiosk, date = todayIso()) {
  const snapshot = await getOperationsSnapshot(date);
  const db = await getDatabase();
  const openTaskRows = await db.prepare(
    `SELECT t.*, m.machine_no, o.name AS operator_name, o.employee_code
     FROM production_tasks t
     JOIN machines m ON m.id = t.machine_id
     LEFT JOIN operators o ON o.id = t.operator_id
     WHERE t.plant = ?
       AND (t.due_date = ? OR (t.due_date < ? AND LOWER(t.status) <> 'completed'))
     ORDER BY CASE t.priority WHEN 'High' THEN 0 ELSE 1 END, t.due_date DESC, t.created_at DESC`,
  ).bind(kiosk.plant, date, date).all();
  return {
    ...snapshot,
    operators: snapshot.operators.filter((row) => String((row as { status?: string }).status ?? "Active").toLowerCase() === "active"),
    machines: snapshot.machines.filter((row) => String((row as { plant: string }).plant) === kiosk.plant),
    schedules: snapshot.schedules.filter((row) => String((row as { plant: string }).plant) === kiosk.plant),
    tasks: openTaskRows.results,
    entries: [],
    kiosks: snapshot.kiosks.filter((row) => String((row as { id: string }).id) === kiosk.id),
    device: kiosk,
  };
}

export async function touchKiosk(kioskId: string, pendingSync = 0) {
  const db = await getDatabase();
  await db.prepare(
    "UPDATE kiosk_devices SET status = 'Online', last_seen = ?, pending_sync = ? WHERE id = ?",
  ).bind(nowIso(), Math.max(0, pendingSync), kioskId).run();
}

export async function recordOfflineTest(kioskId: string) {
  const db = await getDatabase();
  const testedAt = nowIso();
  await db.prepare(
    "UPDATE kiosk_devices SET last_offline_test = ?, offline_test_status = 'Passed', status = 'Online', last_seen = ? WHERE id = ?",
  ).bind(testedAt, testedAt, kioskId).run();
  return { testedAt, status: "Passed" };
}

export async function getDatabaseBackup() {
  await ensureSchema();
  const db = await getDatabase();
  const tableNames = [
    "app_users",
    "operators",
    "machines",
    "schedules",
    "production_tasks",
    "production_entries",
    "kiosk_devices",
    "operator_face_templates",
    "face_recognition_events",
    "molds",
    "parts",
  ];
  const tables: Record<string, unknown[]> = {};
  for (const table of tableNames) {
    const result = await db.prepare(
      table === "app_users"
        ? "SELECT email, login_id, name, role, plant, active, created_at FROM app_users"
        : table === "operator_face_templates"
          ? "SELECT operator_id, model_version, sample_count, consent_granted, enrolled_by, enrolled_at, updated_at FROM operator_face_templates"
          : table === "production_entries"
            ? "SELECT * FROM production_entries WHERE COALESCE(client_ref, '') NOT LIKE 'seed-%' ORDER BY created_at DESC, id DESC"
            : `SELECT * FROM ${table}`,
    ).all();
    tables[table] = result.results;
  }
  return { createdAt: nowIso(), schemaVersion: 8, biometricTemplatesExcluded: true, tables };
}

const EXPORT_RANGE_COLUMNS: Record<string, string> = {
  entries: "e.created_at",
  daily_operator_efficiency: "e.created_at",
  tasks: "t.due_date",
};

function exportRangeClause(type: string, range: string) {
  const column = EXPORT_RANGE_COLUMNS[type];
  if (!column || !range || range === "all") return "";
  // Factory reporting is based on India local calendar dates, not the Render/UTC date.
  const localDate = `((${column})::timestamptz AT TIME ZONE 'Asia/Kolkata')::date`;
  if (range === "today") return ` AND ${localDate} = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`;
  if (range === "week") return ` AND ${localDate} >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - 6`;
  if (range === "month") return ` AND ${localDate} >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - 29`;
  return "";
}

export async function getExportRows(type: string, range = "all") {
  await ensureSchema();
  const db = await getDatabase();
  const queries: Record<string, string> = {
    entries: `SELECT
      ((e.created_at)::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::text AS "Date",
      e.plant AS "Plant",
      o.name AS "Operator Name",
      e.supervisor_name AS "Supervisor",
      e.shift AS "Shift",
      e.product AS "Product",
      COALESCE(NULLIF(e.part_number, ''), p.part_no, '') AS "Part Number",
      COALESCE(NULLIF(e.family_number, ''), p.family, mo.family, '') AS "Family Number",
      e.mold_no AS "Mold No.",
      CASE
        WHEN TRIM(COALESCE(e.colour, '')) <> '' THEN e.colour
        WHEN e.product ~ '-00($|-)' THEN 'Transparent'
        WHEN e.product ~ '-10($|-)' THEN 'White'
        WHEN e.product ~ '-20($|-)' THEN 'Red'
        WHEN e.product ~ '-21($|-)' THEN 'Brown'
        WHEN e.product ~ '-30($|-)' THEN 'Black'
        WHEN e.product ~ '-40($|-)' THEN 'Yellow'
        WHEN e.product ~ '-50($|-)' THEN 'Green'
        WHEN e.product ~ '-60($|-)' THEN 'Blue'
        WHEN e.product ~ '-70($|-)' THEN 'Grey'
        WHEN e.product ~ '-80($|-)' THEN 'Orange'
        ELSE ''
      END AS "Colour",
      e.rubber_compound AS "Rubber Compound",
      e.compound_received_kg AS "Compound Received (kg)",
      e.compound_used_kg AS "Compound Used (kg)",
      e.compound_balance_kg AS "Compound Balance (kg)",
      e.batch_no AS "Batch No.",
      e.shot_count AS "Shot Count",
      e.actual_weight_grams AS "Actual Weight",
      e.weight_unit AS "Weight Unit",
      e.running_cavities AS "Running Cavities",
      e.operator_hours AS "Operator Hours",
      e.ok_qty AS "OK Quantity",
      e.rejection_qty AS "Rejection Quantity",
      e.scrap_qty AS "Scrap Quantity",
      e.downtime_minutes AS "Downtime",
      e.downtime_reason AS "Downtime Reason",
      e.remarks AS "Remarks",
      CASE WHEN COALESCE(NULLIF(t.target_shots, 0), NULLIF(mo.shot_target, 0), 0) > 0
        THEN ROUND((e.shot_count::numeric / COALESCE(NULLIF(t.target_shots, 0), NULLIF(mo.shot_target, 0))) * 100, 2)
        ELSE NULL END AS "Operator Efficiency %"
      FROM production_entries e
      LEFT JOIN operators o ON o.id = e.operator_id
      LEFT JOIN production_tasks t ON t.id = e.task_id
      LEFT JOIN molds mo ON LOWER(TRIM(mo.mold_no)) = LOWER(TRIM(e.mold_no))
      LEFT JOIN parts p ON LOWER(TRIM(p.family)) = LOWER(TRIM(mo.family)) AND (p.part_no = e.product OR p.description = e.product)
      WHERE COALESCE(e.client_ref, '') NOT LIKE 'seed-%'${exportRangeClause("entries", range)}
      ORDER BY e.created_at DESC, e.id DESC`,
    daily_operator_efficiency: `SELECT
      ((e.created_at)::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::text AS "Date",
      o.name AS "Operator Name", e.plant AS "Plant",
      COUNT(*) AS "Production Entries", SUM(e.shot_count) AS "Actual Shots",
      SUM(COALESCE(NULLIF(t.target_shots, 0), NULLIF(mo.shot_target, 0), 0)) AS "Target Shots",
      CASE WHEN SUM(COALESCE(NULLIF(t.target_shots, 0), NULLIF(mo.shot_target, 0), 0)) > 0
        THEN ROUND(SUM(e.shot_count)::numeric / SUM(COALESCE(NULLIF(t.target_shots, 0), NULLIF(mo.shot_target, 0), 0)) * 100, 2)
        ELSE NULL END AS "Operator Efficiency %"
      FROM production_entries e
      LEFT JOIN operators o ON o.id = e.operator_id
      LEFT JOIN production_tasks t ON t.id = e.task_id
      LEFT JOIN molds mo ON LOWER(TRIM(mo.mold_no)) = LOWER(TRIM(e.mold_no))
      WHERE COALESCE(e.client_ref, '') NOT LIKE 'seed-%'${exportRangeClause("daily_operator_efficiency", range)}
      GROUP BY ((e.created_at)::timestamptz AT TIME ZONE 'Asia/Kolkata')::date, o.name, e.plant
      ORDER BY "Date" DESC, o.name`,
    operators: "SELECT employee_code, name, plant, shift, status, skill_level FROM operators ORDER BY plant, name",
    machines: "SELECT machine_no, plant, status, product, output_today, target_today, last_updated FROM machines ORDER BY plant, machine_no",
    supervisors: "SELECT name, plant, status, created_at FROM supervisors ORDER BY plant, name",
    tasks: `SELECT t.task_code, t.title, t.plant, m.machine_no, t.supervisor_name, o.employee_code, o.name AS operator_name, t.shift, t.product, t.mold_no, t.target_shots, t.target_weight_grams, t.due_date, t.priority, t.status, t.instructions FROM production_tasks t LEFT JOIN machines m ON m.id = t.machine_id LEFT JOIN operators o ON o.id = t.operator_id WHERE 1 = 1${exportRangeClause("tasks", range)} ORDER BY t.due_date DESC`,
  };
  const query = queries[type];
  if (!query) throw new Error("Unknown export type");
  const result = await db.prepare(query).all();
  return result.results as Record<string, unknown>[];
}

export async function saveSchedule(input: Record<string, unknown>) {
  const db = await getDatabase();
  const required = ["scheduleDate", "plant", "shift", "machineId", "operatorId", "product"];
  for (const field of required) {
    if (!String(input[field] ?? "").trim()) throw new Error(`${field} is required`);
  }
  const shift = requiredActiveShift(input.shift);
  const references = await validateTaskReferences(db, input.plant, input.machineId, input.operatorId);
  await db.prepare(
    `INSERT INTO schedules (schedule_date, plant, shift, machine_id, operator_id, product, target_qty, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (schedule_date, shift, machine_id) DO UPDATE SET
       plant = EXCLUDED.plant,
       operator_id = EXCLUDED.operator_id,
       product = EXCLUDED.product,
       target_qty = EXCLUDED.target_qty,
       status = EXCLUDED.status,
       created_by = EXCLUDED.created_by`,
  ).bind(
    input.scheduleDate,
    references.plant,
    shift,
    references.machineId,
    references.operatorId,
    input.product,
    Number(input.targetQty ?? 500),
    input.status ?? "Scheduled",
    input.createdBy ?? "Supervisor",
    nowIso(),
  ).run();

  await db.prepare(
    "UPDATE machines SET current_operator_id = ?, product = ?, target_today = ?, last_updated = ? WHERE id = ?",
  ).bind(references.operatorId, input.product, Number(input.targetQty ?? 500), nowIso(), references.machineId).run();
}

export async function createProductionEntry(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const required = ["plant", "machineId", "operatorId", "shift", "product", "moldNo", "batchNo"];
  for (const field of required) {
    if (!String(input[field] ?? "").trim()) throw new Error(`${field} is required`);
  }

  const clientRef = String(input.clientRef ?? crypto.randomUUID());
  const existing = await db.prepare(
    "SELECT entry_code FROM production_entries WHERE client_ref = ?",
  ).bind(clientRef).first<{ entry_code: string }>();
  if (existing) return { entryCode: existing.entry_code, duplicate: true };

  const entryCode = `PE-${todayIso().replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const taskId = String(input.taskId ?? "").trim() || null;
  const shift = requiredActiveShift(input.shift);
  const okQty = Math.max(0, Number(input.okQty ?? 0));
  const downtimeMinutes = Math.max(0, Number(input.downtimeMinutes ?? 0));
  const createdAt = nowIso();

  const statements = [
    db.prepare(
      "INSERT INTO production_entries (entry_code, client_ref, task_id, plant, machine_id, operator_id, schedule_id, supervisor_name, shift, product, mold_no, part_number, family_number, colour, rubber_compound, compound_received_kg, compound_used_kg, compound_balance_kg, batch_no, shot_count, actual_weight_grams, weight_unit, running_cavities, operator_hours, ok_qty, rejection_qty, scrap_qty, downtime_minutes, downtime_reason, remarks, synced_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      entryCode,
      clientRef,
      taskId,
      input.plant,
      input.machineId,
      input.operatorId,
      input.scheduleId ?? null,
      input.supervisorName ?? "Not specified",
      shift,
      input.product,
      input.moldNo,
      String(input.partNumber ?? "").trim(),
      String(input.familyNumber ?? "").trim(),
      String(input.colour ?? "").trim(),
      String(input.rubberCompound ?? "").trim(),
      Math.max(0, Number(input.compoundReceivedKg ?? 0)),
      Math.max(0, Number(input.compoundUsedKg ?? 0)),
      Math.max(0, Number(input.compoundBalanceKg ?? (Number(input.compoundReceivedKg ?? 0) - Number(input.compoundUsedKg ?? 0)))),
      input.batchNo,
      Math.max(0, Number(input.shotCount ?? 0)),
      Math.max(0, Number(input.actualWeightGrams ?? 0)),
      String(input.weightUnit ?? "grams").trim() === "count" ? "count" : "grams",
      Math.max(0, Number(input.runningCavities ?? 0)),
      Math.min(24, Math.max(0, Number(input.operatorHours ?? 8))),
      okQty,
      Math.max(0, Number(input.rejectionQty ?? 0)),
      Math.max(0, Number(input.scrapQty ?? 0)),
      downtimeMinutes,
      input.downtimeReason ?? "",
      input.remarks ?? "",
      input.syncedFrom ?? "Kiosk",
      createdAt,
    ),
    db.prepare(
      "UPDATE machines SET output_today = output_today + ?, status = ?, last_updated = ? WHERE id = ?",
    ).bind(okQty, downtimeMinutes > 0 ? "Idle" : "Running", createdAt, input.machineId),
  ];
  if (taskId) {
    statements.push(db.prepare(
      "UPDATE production_tasks SET status = 'Completed', updated_at = ? WHERE id = ?",
    ).bind(createdAt, taskId));
  }
  await db.batch(statements);

  return { entryCode, duplicate: false };
}

async function validateTaskReferences(db: OperationsDatabase, plantValue: unknown, machineIdValue: unknown, operatorIdValue?: unknown) {
  const plant = String(plantValue ?? "").trim();
  const machineId = String(machineIdValue ?? "").trim();
  const operatorId = String(operatorIdValue ?? "").trim();
  if (!plant || !machineId) throw new Error("Plant and machine are required");

  const machine = await db.prepare(
    "SELECT id, plant FROM machines WHERE id = ?",
  ).bind(machineId).first<{ id: string; plant: string }>();
  if (!machine) throw new Error("Selected machine does not exist");
  if (machine.plant !== plant) throw new Error("Selected machine does not belong to the selected plant");

  if (operatorId) {
    const operator = await db.prepare(
      "SELECT id, plant, status FROM operators WHERE id = ?",
    ).bind(operatorId).first<{ id: string; plant: string; status: string }>();
    if (!operator) throw new Error("Selected operator no longer exists. Refresh the operator list and try again.");
    if (operator.status.toLowerCase() !== "active") throw new Error("Selected operator is not active");
  }

  return { plant, machineId, operatorId: operatorId || null };
}

export async function createTask(
  input: Record<string, unknown>,
  assignedBy: { email: string; name: string },
) {
  const db = await getDatabase();
  const required = ["title", "plant", "machineId", "shift", "product", "dueDate"];
  for (const field of required) {
    if (!String(input[field] ?? "").trim()) throw new Error(`${field} is required`);
  }
  const shift = requiredActiveShift(input.shift);
  const references = await validateTaskReferences(db, input.plant, input.machineId, input.operatorId);
  let targetShots = Number(input.targetShots ?? 0);
  if (!targetShots) {
    const moldNo = String(input.moldNo ?? "").trim();
    if (moldNo) {
      const mold = await db.prepare("SELECT shot_target FROM molds WHERE LOWER(TRIM(mold_no)) = LOWER(TRIM(?)) LIMIT 1").bind(moldNo).first<{ shot_target: number | null }>();
      targetShots = Number(mold?.shot_target ?? 0);
    }
  }
  const id = `TASK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const taskCode = `PT-${String(input.dueDate).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const createdAt = nowIso();
  await db.prepare(
    "INSERT INTO production_tasks (id, task_code, title, plant, machine_id, supervisor_name, operator_id, shift, product, mold_no, target_shots, target_weight_grams, due_date, priority, status, instructions, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    id, taskCode, input.title, references.plant, references.machineId,
    String(input.supervisorName ?? "").trim() || assignedBy.name,
    references.operatorId, shift, input.product, input.moldNo ?? "",
    Math.max(0, targetShots),
    Math.max(0, Number(input.targetWeightGrams ?? 0)),
    input.dueDate, input.priority ?? "Normal", references.operatorId ? "Ready" : "Assigned",
    input.instructions ?? "", assignedBy.name || assignedBy.email || "Supervisor", createdAt, createdAt,
  ).run();
  return { id, taskCode };
}

export async function assignTask(input: Record<string, unknown>) {
  const db = await getDatabase();
  const taskId = String(input.taskId ?? "").trim();
  const operatorId = String(input.operatorId ?? "").trim();
  if (!taskId || !operatorId) throw new Error("Task and operator are required");

  const task = await db.prepare(
    "SELECT id, plant, machine_id, status FROM production_tasks WHERE id = ?",
  ).bind(taskId).first<{ id: string; plant: string; machine_id: string; status: string }>();
  if (!task) throw new Error("The selected task no longer exists. Refresh the dashboard and try again.");
  if (task.status.toLowerCase() === "completed") throw new Error("Completed tasks cannot be reassigned");

  await validateTaskReferences(db, task.plant, task.machine_id, operatorId);

  const result = await db.prepare(
    "UPDATE production_tasks SET operator_id = ?, status = 'Ready', updated_at = ? WHERE id = ?",
  ).bind(operatorId, nowIso(), taskId).run();
  if (!result.meta.changes) throw new Error("The task could not be updated. Refresh the dashboard and try again.");
  return { id: taskId, operatorId, status: "Ready" };
}

export async function addMachine(input: Record<string, unknown>) {
  const db = await getDatabase();
  const machineNo = String(input.machineNo ?? "").trim().toUpperCase();
  const plant = String(input.plant ?? "").trim();
  if (!machineNo || !plant) throw new Error("Machine number and plant are required");
  const id = `MCH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await db.prepare(
    "INSERT INTO machines (id, machine_no, plant, status, product, output_today, target_today, last_updated) VALUES (?, ?, ?, 'Idle', 'Unassigned', 0, ?, ?)",
  ).bind(id, machineNo, plant, Number(input.targetToday ?? 500), nowIso()).run();
  return { id };
}

export async function addOperator(input: Record<string, unknown>) {
  const db = await getDatabase();
  const name = String(input.name ?? "").trim();
  const employeeCode = String(input.employeeCode ?? "").trim().toUpperCase();
  if (!name || !employeeCode) throw new Error("Name and employee code are required");
  const shift = requiredActiveShift(input.shift ?? "Morning");
  const id = `OP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await db.prepare(
    "INSERT INTO operators (id, employee_code, name, plant, shift, status, skill_level, created_at) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)",
  ).bind(id, employeeCode, name, input.plant ?? "Plant 1", shift, input.skillLevel ?? "L1", nowIso()).run();
  return { id };
}

export async function updateOperatorStatus(input: Record<string, unknown>) {
  const db = await getDatabase();
  await db.prepare("UPDATE operators SET status = ? WHERE id = ?")
    .bind(input.status ?? "Active", input.operatorId).run();
}

export async function addSupervisor(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  const name = String(input.name ?? "").trim();
  const plant = String(input.plant ?? "").trim();
  if (!name || !plant) throw new Error("Name and plant are required");
  const id = `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await db.prepare(
    "INSERT INTO supervisors (id, name, plant, status, created_at) VALUES (?, ?, ?, 'Active', ?)",
  ).bind(id, name, plant, nowIso()).run();
  return { id };
}

export async function updateSupervisorStatus(input: Record<string, unknown>) {
  await ensureSchema();
  const db = await getDatabase();
  await db.prepare("UPDATE supervisors SET status = ? WHERE id = ?")
    .bind(input.status ?? "Active", input.supervisorId).run();
}

export async function updateMachineStatus(input: Record<string, unknown>) {
  const db = await getDatabase();
  await db.prepare("UPDATE machines SET status = ?, last_updated = ? WHERE id = ?")
    .bind(input.status ?? "Idle", nowIso(), input.machineId).run();
}

export async function syncKiosk(input: Record<string, unknown>) {
  const db = await getDatabase();
  await db.prepare(
    "UPDATE kiosk_devices SET status = 'Online', last_seen = ?, pending_sync = 0 WHERE id = ?",
  ).bind(nowIso(), input.kioskId).run();
}

export async function deleteSupervisor(input: Record<string, unknown>) {
  await ensureSchema();

  const db = await getDatabase();
  const supervisorId = String(input.supervisorId ?? "").trim();

  if (!supervisorId) {
    throw new Error("Supervisor ID is required");
  }

  const result = await db
    .prepare("DELETE FROM supervisors WHERE id = ?")
    .bind(supervisorId)
    .run();

  if (!result.meta.changes) {
    throw new Error("Supervisor was not found");
  }

  return { deleted: supervisorId };
}
