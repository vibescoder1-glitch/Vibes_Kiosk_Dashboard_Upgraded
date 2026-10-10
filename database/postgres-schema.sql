-- PostgreSQL schema for Vibes Components Factory Kiosk Operations.
-- Ported from database/mysql-schema.sql (Hostinger/MySQL) for Render/PostgreSQL hosting.

CREATE TABLE IF NOT EXISTS operators (
  id VARCHAR(64) NOT NULL,
  employee_code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  shift VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  skill_level VARCHAR(16) NOT NULL DEFAULT 'L1',
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (employee_code)
);

CREATE TABLE IF NOT EXISTS machines (
  id VARCHAR(64) NOT NULL,
  machine_no VARCHAR(32) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Idle',
  current_operator_id VARCHAR(64) NULL,
  product VARCHAR(191) NOT NULL DEFAULT 'Unassigned',
  output_today INT NOT NULL DEFAULT 0,
  target_today INT NOT NULL DEFAULT 500,
  last_updated VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (plant, machine_no),
  CONSTRAINT machines_operator_fk FOREIGN KEY (current_operator_id)
    REFERENCES operators (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS machines_plant_idx ON machines (plant);

CREATE TABLE IF NOT EXISTS supervisors (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (plant, name)
);
CREATE INDEX IF NOT EXISTS supervisors_plant_idx ON supervisors (plant);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  schedule_date VARCHAR(10) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  shift VARCHAR(32) NOT NULL,
  machine_id VARCHAR(64) NOT NULL,
  operator_id VARCHAR(64) NOT NULL,
  product VARCHAR(191) NOT NULL,
  target_qty INT NOT NULL DEFAULT 500,
  status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
  created_by VARCHAR(191) NOT NULL DEFAULT 'Supervisor',
  created_at VARCHAR(32) NOT NULL,
  UNIQUE (schedule_date, shift, machine_id),
  CONSTRAINT schedules_machine_fk FOREIGN KEY (machine_id)
    REFERENCES machines (id),
  CONSTRAINT schedules_operator_fk FOREIGN KEY (operator_id)
    REFERENCES operators (id)
);
CREATE INDEX IF NOT EXISTS schedules_date_plant_idx ON schedules (schedule_date, plant);
CREATE INDEX IF NOT EXISTS schedules_operator_idx ON schedules (operator_id);

CREATE TABLE IF NOT EXISTS production_tasks (
  id VARCHAR(64) NOT NULL,
  task_code VARCHAR(191) NOT NULL,
  title VARCHAR(191) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  machine_id VARCHAR(64) NOT NULL,
  supervisor_name VARCHAR(191) NOT NULL,
  operator_id VARCHAR(64) NULL,
  shift VARCHAR(32) NOT NULL,
  product VARCHAR(191) NOT NULL,
  mold_no VARCHAR(96) NOT NULL DEFAULT '',
  target_shots INT NOT NULL DEFAULT 0,
  target_weight_grams INT NOT NULL DEFAULT 0,
  due_date VARCHAR(10) NOT NULL,
  priority VARCHAR(24) NOT NULL DEFAULT 'Normal',
  status VARCHAR(32) NOT NULL DEFAULT 'Assigned',
  instructions TEXT NOT NULL,
  created_by VARCHAR(191) NOT NULL DEFAULT 'Supervisor',
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (task_code),
  CONSTRAINT production_tasks_machine_fk FOREIGN KEY (machine_id)
    REFERENCES machines (id),
  CONSTRAINT production_tasks_operator_fk FOREIGN KEY (operator_id)
    REFERENCES operators (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS production_tasks_due_plant_idx ON production_tasks (due_date, plant);
CREATE INDEX IF NOT EXISTS production_tasks_operator_idx ON production_tasks (operator_id);
CREATE INDEX IF NOT EXISTS production_tasks_machine_idx ON production_tasks (machine_id);

CREATE TABLE IF NOT EXISTS production_entries (
  id SERIAL PRIMARY KEY,
  entry_code VARCHAR(191) NOT NULL,
  client_ref VARCHAR(191) NOT NULL,
  task_id VARCHAR(64) NULL,
  plant VARCHAR(64) NOT NULL,
  machine_id VARCHAR(64) NOT NULL,
  operator_id VARCHAR(64) NOT NULL,
  schedule_id INT NULL,
  supervisor_name VARCHAR(191) NOT NULL DEFAULT '',
  shift VARCHAR(32) NOT NULL,
  product VARCHAR(191) NOT NULL,
  mold_no VARCHAR(96) NOT NULL,
  colour VARCHAR(64) NOT NULL DEFAULT '',
  rubber_compound VARCHAR(191) NOT NULL DEFAULT '',
  compound_received_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  compound_used_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  compound_balance_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  batch_no VARCHAR(96) NOT NULL,
  shot_count INT NOT NULL DEFAULT 0,
  actual_weight_grams INT NOT NULL DEFAULT 0,
  weight_unit VARCHAR(16) NOT NULL DEFAULT 'grams',
  running_cavities INT NOT NULL DEFAULT 0,
  operator_hours DECIMAL(6,2) NOT NULL DEFAULT 8,
  ok_qty INT NOT NULL DEFAULT 0,
  rejection_qty INT NOT NULL DEFAULT 0,
  scrap_qty INT NOT NULL DEFAULT 0,
  downtime_minutes INT NOT NULL DEFAULT 0,
  downtime_reason VARCHAR(191) NOT NULL DEFAULT '',
  remarks TEXT NOT NULL,
  synced_from VARCHAR(191) NOT NULL DEFAULT 'Kiosk',
  created_at VARCHAR(32) NOT NULL,
  UNIQUE (entry_code),
  UNIQUE (client_ref),
  CONSTRAINT production_entries_task_fk FOREIGN KEY (task_id)
    REFERENCES production_tasks (id) ON DELETE SET NULL,
  CONSTRAINT production_entries_machine_fk FOREIGN KEY (machine_id)
    REFERENCES machines (id),
  CONSTRAINT production_entries_operator_fk FOREIGN KEY (operator_id)
    REFERENCES operators (id),
  CONSTRAINT production_entries_schedule_fk FOREIGN KEY (schedule_id)
    REFERENCES schedules (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS production_entries_created_idx ON production_entries (created_at);
CREATE INDEX IF NOT EXISTS production_entries_plant_idx ON production_entries (plant);
CREATE INDEX IF NOT EXISTS production_entries_machine_idx ON production_entries (machine_id);
CREATE INDEX IF NOT EXISTS production_entries_operator_idx ON production_entries (operator_id);
CREATE INDEX IF NOT EXISTS production_entries_schedule_idx ON production_entries (schedule_id);
CREATE INDEX IF NOT EXISTS production_entries_task_idx ON production_entries (task_id);

CREATE TABLE IF NOT EXISTS kiosk_devices (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Online',
  last_seen VARCHAR(32) NOT NULL,
  pending_sync INT NOT NULL DEFAULT 0,
  app_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  authorization_status VARCHAR(32) NOT NULL DEFAULT 'Pending',
  registration_code VARCHAR(32) NULL,
  token_hash VARCHAR(64) NULL,
  authorized_at VARCHAR(32) NULL,
  authorized_by VARCHAR(191) NULL,
  last_offline_test VARCHAR(32) NULL,
  offline_test_status VARCHAR(32) NOT NULL DEFAULT 'Untested',
  PRIMARY KEY (id),
  UNIQUE (registration_code),
  UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS kiosk_plant_idx ON kiosk_devices (plant);

CREATE TABLE IF NOT EXISTS molds (
  id SERIAL PRIMARY KEY,
  family VARCHAR(191) NOT NULL,
  mold_no VARCHAR(96) NOT NULL,
  vibes_description VARCHAR(255) NULL,
  cavities INT NULL,
  cycle_time DECIMAL(12,3) NULL,
  req_tonn VARCHAR(64) NULL,
  inspection_time DECIMAL(12,3) NULL,
  shot_wt DECIMAL(12,4) NULL,
  sheet_wt DECIMAL(12,4) NULL,
  flash_wt DECIMAL(12,4) NULL,
  shot_target DECIMAL(12,3) NULL,
  running_ok_cavities INT NULL,
  inspection_target DECIMAL(12,3) NULL,
  old_mold_no VARCHAR(191) NULL,
  manufacturing_year VARCHAR(32) NULL,
  plant VARCHAR(64) NULL,
  mold_material VARCHAR(191) NULL,
  source_row INT NULL,
  created_at VARCHAR(32) NOT NULL
);
CREATE INDEX IF NOT EXISTS molds_mold_no_idx ON molds (mold_no);
CREATE INDEX IF NOT EXISTS molds_family_idx ON molds (family);
CREATE INDEX IF NOT EXISTS molds_plant_idx ON molds (plant);
CREATE INDEX IF NOT EXISTS molds_family_mold_idx ON molds (family, mold_no);

CREATE TABLE IF NOT EXISTS parts (
  id SERIAL PRIMARY KEY,
  part_no VARCHAR(191) NOT NULL,
  family VARCHAR(191) NOT NULL,
  description VARCHAR(255) NULL,
  commodity VARCHAR(191) NULL,
  insert_part_no VARCHAR(191) NULL,
  rubber_compound VARCHAR(191) NULL,
  rejection_allowed DECIMAL(12,4) NULL,
  part_weight DECIMAL(12,4) NULL,
  inspection DECIMAL(12,3) NULL,
  final_inspection_target DECIMAL(12,3) NULL,
  source_row INT NULL,
  created_at VARCHAR(32) NOT NULL,
  UNIQUE (part_no)
);
CREATE INDEX IF NOT EXISTS parts_family_idx ON parts (family);
CREATE INDEX IF NOT EXISTS parts_description_idx ON parts (description);

CREATE TABLE IF NOT EXISTS operator_face_templates (
  operator_id VARCHAR(64) NOT NULL,
  descriptor_ciphertext TEXT NOT NULL,
  descriptor_iv VARCHAR(128) NOT NULL,
  model_version VARCHAR(64) NOT NULL DEFAULT 'face-api-1.7.15',
  sample_count INT NOT NULL DEFAULT 3,
  consent_granted SMALLINT NOT NULL DEFAULT 0,
  enrolled_by VARCHAR(191) NOT NULL,
  enrolled_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (operator_id),
  CONSTRAINT operator_face_operator_fk FOREIGN KEY (operator_id)
    REFERENCES operators (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS operator_face_consent_idx ON operator_face_templates (consent_granted);

CREATE TABLE IF NOT EXISTS face_scan_sessions (
  token_hash VARCHAR(64) NOT NULL,
  kiosk_id VARCHAR(64) NOT NULL,
  plant VARCHAR(64) NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  used_at VARCHAR(32) NULL,
  PRIMARY KEY (token_hash),
  CONSTRAINT face_scan_sessions_kiosk_fk FOREIGN KEY (kiosk_id)
    REFERENCES kiosk_devices (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS face_scan_sessions_expiry_idx ON face_scan_sessions (expires_at);
CREATE INDEX IF NOT EXISTS face_scan_sessions_kiosk_idx ON face_scan_sessions (kiosk_id);

CREATE TABLE IF NOT EXISTS face_recognition_events (
  id SERIAL PRIMARY KEY,
  kiosk_id VARCHAR(64) NOT NULL,
  operator_id VARCHAR(64) NULL,
  outcome VARCHAR(32) NOT NULL,
  distance_millis INT NULL,
  created_at VARCHAR(32) NOT NULL,
  CONSTRAINT face_events_kiosk_fk FOREIGN KEY (kiosk_id)
    REFERENCES kiosk_devices (id) ON DELETE CASCADE,
  CONSTRAINT face_events_operator_fk FOREIGN KEY (operator_id)
    REFERENCES operators (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS face_recognition_events_created_idx ON face_recognition_events (created_at);
CREATE INDEX IF NOT EXISTS face_recognition_events_operator_idx ON face_recognition_events (operator_id);
CREATE INDEX IF NOT EXISTS face_recognition_events_kiosk_idx ON face_recognition_events (kiosk_id);

CREATE TABLE IF NOT EXISTS app_users (
  email VARCHAR(191) NOT NULL,
  login_id VARCHAR(191) NULL,
  password_salt VARCHAR(128) NULL,
  password_hash VARCHAR(128) NULL,
  password_iterations INT NULL,
  name VARCHAR(191) NOT NULL,
  role VARCHAR(32) NOT NULL,
  plant VARCHAR(64) NULL,
  active SMALLINT NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (email),
  UNIQUE (login_id)
);
CREATE INDEX IF NOT EXISTS app_users_role_idx ON app_users (role);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash VARCHAR(64) NOT NULL,
  user_email VARCHAR(191) NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (token_hash),
  CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_email)
    REFERENCES app_users (email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_email);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
