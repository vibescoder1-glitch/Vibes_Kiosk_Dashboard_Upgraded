import {
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const id = (name: string) => varchar(name, { length: 64 });
const shortText = (name: string) => varchar(name, { length: 191 });
const timestampText = (name: string) => varchar(name, { length: 32 });

export const operators = pgTable(
  "operators",
  {
    id: id("id").primaryKey(),
    employeeCode: shortText("employee_code").notNull(),
    name: shortText("name").notNull(),
    plant: varchar("plant", { length: 64 }).notNull(),
    shift: varchar("shift", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("Active"),
    skillLevel: varchar("skill_level", { length: 16 }).notNull().default("L1"),
    createdAt: timestampText("created_at").notNull(),
  },
  (table) => [uniqueIndex("operators_employee_code_unique").on(table.employeeCode)],
);

export const machines = pgTable(
  "machines",
  {
    id: id("id").primaryKey(),
    machineNo: varchar("machine_no", { length: 32 }).notNull(),
    plant: varchar("plant", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("Idle"),
    currentOperatorId: id("current_operator_id").references(() => operators.id, { onDelete: "set null" }),
    product: shortText("product").notNull().default("Unassigned"),
    outputToday: integer("output_today").notNull().default(0),
    targetToday: integer("target_today").notNull().default(500),
    lastUpdated: timestampText("last_updated").notNull(),
  },
  (table) => [
    uniqueIndex("machines_plant_number_unique").on(table.plant, table.machineNo),
    index("machines_plant_idx").on(table.plant),
  ],
);

export const supervisors = pgTable(
  "supervisors",
  {
    id: id("id").primaryKey(),
    name: shortText("name").notNull(),
    plant: varchar("plant", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("Active"),
    createdAt: timestampText("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("supervisors_plant_name_unique").on(table.plant, table.name),
    index("supervisors_plant_idx").on(table.plant),
  ],
);

export const schedules = pgTable(
  "schedules",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    scheduleDate: varchar("schedule_date", { length: 10 }).notNull(),
    plant: varchar("plant", { length: 64 }).notNull(),
    shift: varchar("shift", { length: 32 }).notNull(),
    machineId: id("machine_id").notNull().references(() => machines.id),
    operatorId: id("operator_id").notNull().references(() => operators.id),
    product: shortText("product").notNull(),
    targetQty: integer("target_qty").notNull().default(500),
    status: varchar("status", { length: 32 }).notNull().default("Scheduled"),
    createdBy: shortText("created_by").notNull().default("Supervisor"),
    createdAt: timestampText("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("schedules_slot_unique").on(table.scheduleDate, table.shift, table.machineId),
    index("schedules_date_plant_idx").on(table.scheduleDate, table.plant),
  ],
);

export const productionTasks = pgTable(
  "production_tasks",
  {
    id: id("id").primaryKey(),
    taskCode: shortText("task_code").notNull(),
    title: shortText("title").notNull(),
    plant: varchar("plant", { length: 64 }).notNull(),
    machineId: id("machine_id").notNull().references(() => machines.id),
    supervisorName: shortText("supervisor_name").notNull(),
    operatorId: id("operator_id").references(() => operators.id, { onDelete: "set null" }),
    shift: varchar("shift", { length: 32 }).notNull(),
    product: shortText("product").notNull(),
    moldNo: varchar("mold_no", { length: 96 }).notNull().default(""),
    targetShots: integer("target_shots").notNull().default(0),
    targetWeightGrams: integer("target_weight_grams").notNull().default(0),
    dueDate: varchar("due_date", { length: 10 }).notNull(),
    priority: varchar("priority", { length: 24 }).notNull().default("Normal"),
    status: varchar("status", { length: 32 }).notNull().default("Assigned"),
    instructions: text("instructions").notNull(),
    createdBy: shortText("created_by").notNull().default("Supervisor"),
    createdAt: timestampText("created_at").notNull(),
    updatedAt: timestampText("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("production_tasks_code_unique").on(table.taskCode),
    index("production_tasks_due_plant_idx").on(table.dueDate, table.plant),
    index("production_tasks_operator_idx").on(table.operatorId),
  ],
);

export const productionEntries = pgTable(
  "production_entries",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    entryCode: shortText("entry_code").notNull(),
    clientRef: shortText("client_ref").notNull(),
    taskId: id("task_id").references(() => productionTasks.id, { onDelete: "set null" }),
    plant: varchar("plant", { length: 64 }).notNull(),
    machineId: id("machine_id").notNull().references(() => machines.id),
    operatorId: id("operator_id").notNull().references(() => operators.id),
    scheduleId: integer("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    supervisorName: shortText("supervisor_name").notNull().default(""),
    shift: varchar("shift", { length: 32 }).notNull(),
    product: shortText("product").notNull(),
    moldNo: varchar("mold_no", { length: 96 }).notNull(),
    partNumber: shortText("part_number").notNull().default(""),
    familyNumber: shortText("family_number").notNull().default(""),
    colour: varchar("colour", { length: 64 }).notNull().default(""),
    rubberCompound: shortText("rubber_compound").notNull().default(""),
    compoundReceivedKg: numeric("compound_received_kg", { precision: 12, scale: 3 }).notNull().default("0"),
    compoundUsedKg: numeric("compound_used_kg", { precision: 12, scale: 3 }).notNull().default("0"),
    compoundBalanceKg: numeric("compound_balance_kg", { precision: 12, scale: 3 }).notNull().default("0"),
    batchNo: varchar("batch_no", { length: 96 }).notNull(),
    shotCount: integer("shot_count").notNull().default(0),
    actualWeightGrams: integer("actual_weight_grams").notNull().default(0),
    weightUnit: varchar("weight_unit", { length: 16 }).notNull().default("grams"),
    runningCavities: integer("running_cavities").notNull().default(0),
    operatorHours: numeric("operator_hours", { precision: 6, scale: 2 }).notNull().default("8"),
    okQty: integer("ok_qty").notNull().default(0),
    rejectionQty: integer("rejection_qty").notNull().default(0),
    scrapQty: integer("scrap_qty").notNull().default(0),
    downtimeMinutes: integer("downtime_minutes").notNull().default(0),
    downtimeReason: shortText("downtime_reason").notNull().default(""),
    remarks: text("remarks").notNull(),
    syncedFrom: shortText("synced_from").notNull().default("Kiosk"),
    createdAt: timestampText("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("production_entries_code_unique").on(table.entryCode),
    uniqueIndex("production_entries_client_ref_unique").on(table.clientRef),
    index("production_entries_created_idx").on(table.createdAt),
    index("production_entries_plant_idx").on(table.plant),
  ],
);

export const kioskDevices = pgTable("kiosk_devices", {
  id: id("id").primaryKey(),
  name: shortText("name").notNull(),
  plant: varchar("plant", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Online"),
  lastSeen: timestampText("last_seen").notNull(),
  pendingSync: integer("pending_sync").notNull().default(0),
  appVersion: varchar("app_version", { length: 32 }).notNull().default("1.0.0"),
  authorizationStatus: varchar("authorization_status", { length: 32 }).notNull().default("Pending"),
  registrationCode: varchar("registration_code", { length: 32 }),
  tokenHash: varchar("token_hash", { length: 64 }),
  authorizedAt: timestampText("authorized_at"),
  authorizedBy: shortText("authorized_by"),
  lastOfflineTest: timestampText("last_offline_test"),
  offlineTestStatus: varchar("offline_test_status", { length: 32 }).notNull().default("Untested"),
});

export const operatorFaceTemplates = pgTable(
  "operator_face_templates",
  {
    operatorId: id("operator_id").primaryKey().references(() => operators.id, { onDelete: "cascade" }),
    descriptorCiphertext: text("descriptor_ciphertext").notNull(),
    descriptorIv: varchar("descriptor_iv", { length: 128 }).notNull(),
    modelVersion: varchar("model_version", { length: 64 }).notNull().default("face-api-1.7.15"),
    sampleCount: integer("sample_count").notNull().default(3),
    consentGranted: smallint("consent_granted").notNull().default(0),
    enrolledBy: shortText("enrolled_by").notNull(),
    enrolledAt: timestampText("enrolled_at").notNull(),
    updatedAt: timestampText("updated_at").notNull(),
  },
  (table) => [index("operator_face_consent_idx").on(table.consentGranted)],
);

export const faceScanSessions = pgTable(
  "face_scan_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    kioskId: id("kiosk_id").notNull().references(() => kioskDevices.id, { onDelete: "cascade" }),
    plant: varchar("plant", { length: 64 }).notNull(),
    expiresAt: timestampText("expires_at").notNull(),
    createdAt: timestampText("created_at").notNull(),
    usedAt: timestampText("used_at"),
  },
  (table) => [
    index("face_scan_sessions_expiry_idx").on(table.expiresAt),
    index("face_scan_sessions_kiosk_idx").on(table.kioskId),
  ],
);

export const faceRecognitionEvents = pgTable(
  "face_recognition_events",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    kioskId: id("kiosk_id").notNull().references(() => kioskDevices.id, { onDelete: "cascade" }),
    operatorId: id("operator_id").references(() => operators.id, { onDelete: "set null" }),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    distanceMillis: integer("distance_millis"),
    createdAt: timestampText("created_at").notNull(),
  },
  (table) => [
    index("face_recognition_events_created_idx").on(table.createdAt),
    index("face_recognition_events_operator_idx").on(table.operatorId),
    index("face_recognition_events_kiosk_idx").on(table.kioskId),
  ],
);

export const appUsers = pgTable("app_users", {
  email: shortText("email").primaryKey(),
  loginId: shortText("login_id").unique(),
  passwordSalt: varchar("password_salt", { length: 128 }),
  passwordHash: varchar("password_hash", { length: 128 }),
  passwordIterations: integer("password_iterations"),
  name: shortText("name").notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  plant: varchar("plant", { length: 64 }),
  active: smallint("active").notNull().default(1),
  createdAt: timestampText("created_at").notNull(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userEmail: shortText("user_email").notNull().references(() => appUsers.email, { onDelete: "cascade" }),
    expiresAt: timestampText("expires_at").notNull(),
    createdAt: timestampText("created_at").notNull(),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userEmail),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
  ],
);
