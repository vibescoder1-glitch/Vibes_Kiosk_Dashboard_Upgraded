# Vibes Components Factory Kiosk Operations

Production-ready factory operations dashboard for a Hostinger Node.js server and Hostinger MySQL.

## Included applications

- Single full-permission Supervisor dashboard: `/supervisor`
- Supervisor login: `/supervisor/login`
- Operator kiosk browser test page: `/kiosk`
- Separate Expo Android Production Entry app for plant tablets
- Operations and kiosk API routes
- MySQL database schema and setup script
- CSV, Excel-compatible XLS and JSON backup exports

The system supports three plants with twelve machines per plant. Operators can submit shots, actual weight, accepted quantity, rejection, scrap, downtime, batch, mould and remarks. Kiosk submissions use a unique client reference so retrying an offline record does not create a duplicate.

## Permissions

### Supervisor

- Creates, assigns and reschedules tasks
- Creates and changes operator schedules
- Registers and deletes kiosk devices
- Changes the supervisor password
- Manages company operator and machine data
- Enrolls consenting operators for optional face recognition
- Downloads reports and backups

### Operator kiosk

- Activates with a one-time kiosk registration code
- Identifies operators by QR code or employee ID
- Displays the operator's assigned work
- Accepts production readings without a formal task by using the schedule or an authorized plant machine
- Stores submissions locally when offline
- Automatically retries when connectivity returns

## Technology

- Node.js 22.13 or newer
- Next.js 16.2.6
- React 19.2.6
- TypeScript 5.9.3
- MySQL with `mysql2` connection pooling
- Drizzle ORM and Drizzle Kit

## Hostinger configuration

Use these values in the Hostinger Node.js application panel:

| Setting | Value |
| --- | --- |
| Node.js version | `22.x` |
| Application root | The directory containing `package.json` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Startup file, if requested | `server.js` |
| Port | Use Hostinger's `PORT` value |
| Public URL | Your connected domain or subdomain, such as `https://operations.your-company.com` |

The ZIP supplied for this project contains `package.json` at the archive root. Upload and extract it directly into the application root.

## Environment variables

Copy the names from `.env.example` into the Hostinger environment-variable panel:

```env
NODE_ENV=production
PORT=3000
APP_HOST=0.0.0.0
APP_TIME_ZONE=Asia/Kolkata

DATABASE_HOST=
DATABASE_PORT=3306
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_SSL=false
DATABASE_CONNECTION_LIMIT=10
DATABASE_MAX_IDLE=5

SESSION_SECRET=
FACE_TEMPLATE_SECRET=
FACE_MATCH_THRESHOLD=0.50

INITIAL_SUPERVISOR_NAME=Vibes Components
INITIAL_SUPERVISOR_EMAIL=supervisor@your-company.com
INITIAL_SUPERVISOR_PASSWORD=

SEED_DEMO_DATA=false
```

Generate independent `SESSION_SECRET` and `FACE_TEMPLATE_SECRET` values with at least 32 random characters each. Use an initial supervisor password with at least 12 characters. Do not commit or upload a real `.env` file.

Existing installations that already use `INITIAL_MANAGER_NAME`, `INITIAL_MANAGER_EMAIL` and `INITIAL_MANAGER_PASSWORD` may keep those names while upgrading. The internal database role stays `Manager` only for backward compatibility; the public application exposes only the Supervisor login and dashboard.

## MySQL setup

### Option 1: Hostinger terminal

1. Create a MySQL database and database user in Hostinger hPanel.
2. Add the database credentials and initial supervisor values as environment variables.
3. Open the Hostinger terminal in the application directory.
4. Run:

```bash
npm ci
npm run db:setup
npm run build
npm start
```

`db:setup` creates the schema and initial supervisor account. Running it again does not overwrite a password that was changed inside the dashboard.
It also normalizes unfinished legacy Evening assignments to the active Night shift. New operators, schedules and tasks accept only Morning or Night.

### Option 2: phpMyAdmin

1. Create the MySQL database and user in Hostinger.
2. Open phpMyAdmin and select the new database.
3. Choose **Import**.
4. Import `database/mysql-schema.sql`.
5. Configure the application environment variables.
6. Start the application and open `/supervisor/login`.

When the schema exists, the application creates the first supervisor from `INITIAL_SUPERVISOR_NAME`, `INITIAL_SUPERVISOR_EMAIL` and `INITIAL_SUPERVISOR_PASSWORD`.

## Local verification

Create `.env.local` from `.env.example`, then run:

```bash
npm ci
npm run db:setup
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Test the database connection separately with:

```bash
npm run verify:hostinger
```

## Database storage

All central data is stored in the configured Hostinger MySQL database:

- `app_users`
- `auth_sessions`
- `operators`
- `machines`
- `schedules`
- `production_tasks`
- `production_entries`
- `kiosk_devices`
- `operator_face_templates` (AES-GCM encrypted numeric templates; no photographs)
- `face_scan_sessions`
- `face_recognition_events`

The operator kiosk uses browser storage only for temporary offline records waiting to synchronize. The central database does not depend on the computer used to upload or manage the site.

## Supervisor-to-operator workflow

1. Sign in at `/supervisor/login`.
2. Open **Production Tasks** and choose **Create task**.
3. Select the plant, machine, shift and product.
4. Select an operator now or leave the operator empty and assign one later from the task detail.
5. The task automatically records the signed-in supervisor's name.
6. The Android kiosk receives it by operator ID, with employee-code matching as a safe import fallback.

Formal tasks are optional for production capture. If no task exists, the kiosk can submit against the operator's schedule or a manually selected machine from the kiosk's authorized plant. The entry remains duplicate-safe and appears in Live Monitoring, History, Reports and exports.

## Connecting the Android kiosk after Hostinger deployment

Set the Android app build environment to the same public HTTPS URL used for this dashboard:

```env
EXPO_PUBLIC_API_BASE_URL=https://operations.your-company.com
```

Rebuild and reinstall the APK/AAB after changing this value. Registration codes are stored in the connected MySQL database and therefore work only when the Android app and Supervisor dashboard point to the same Hostinger deployment.

Use an **APK** for direct installation on company tablets. Use an **AAB** only when publishing through Google Play or a managed Play deployment. The Expo source package includes both build profiles.

## Face recognition setup

Face recognition is optional and consent-based. Operators can always use QR or employee ID instead.

1. Configure a unique `FACE_TEMPLATE_SECRET` in Hostinger. Never change it after enrolling operators unless every face is enrolled again.
2. Run `npm run db:setup` to create the three face-recognition tables.
3. Sign in as supervisor and open **Company Data → Operator face enrollment**.
4. Select the operator, record their informed consent, capture three samples and save.
5. Install the updated Android kiosk app and point it at this same public **HTTPS** dashboard URL.
6. Tap **Scan face** on the kiosk. The operator blinks once, the match is checked for that kiosk's authorized plant, and their name/details open in the production-entry form.

No camera photo or video is uploaded or retained. The browser/WebView calculates a 128-number descriptor locally; the server stores only an AES-GCM encrypted averaged template. Database backups intentionally exclude encrypted descriptors. `FACE_MATCH_THRESHOLD` defaults to `0.50`; adjust it only after a controlled plant pilot.

The included blink check is basic liveness protection. For high-security or attendance/payroll use, obtain legal/privacy review and replace it with a certified anti-spoofing service. Do not use face results for performance, discipline or employment decisions.

## Deployment troubleshooting

- **Database connection error:** confirm the host, database name, user, password and port exactly match hPanel.
- **Tables do not exist:** run `npm run db:setup` or import `database/mysql-schema.sql`.
- **Supervisor cannot sign in:** confirm the initial supervisor environment variables, restart the application and use the configured email.
- **Application does not start:** confirm `npm run build` completed and the start command is `npm start`.
- **Secure cookie issue:** use an HTTPS domain and ensure Hostinger's SSL certificate is active.
- **Kiosk cannot synchronize:** confirm the kiosk can reach the same public HTTPS domain and that it has been registered by the supervisor.
- **Kiosk reports no assigned task:** confirm the task's operator employee code, plant and machine match the authorized kiosk. Unfinished overdue tasks remain available to the kiosk.

## Main source files

- `app/operations-dashboard.tsx`: single Supervisor application shell
- `app/operation-modules.tsx`: scheduling, tasks, monitoring, history, reports and kiosk modules
- `app/kiosk/kiosk-client.tsx`: operator kiosk and offline synchronization
- `app/api/operations/route.ts`: authenticated Supervisor API
- `app/api/kiosk/route.ts`: authorized kiosk API
- `app/api/face-scan/route.ts`: short-lived, plant-scoped face matching sessions
- `app/face-scan/page.tsx`: kiosk WebView scanner with blink liveness
- `app/face-enrollment.tsx`: consent and Supervisor enrollment interface
- `lib/operations-data.ts`: operations, authentication and database queries
- `lib/mysql.ts`: MySQL connection pool and transaction adapter
- `db/schema.ts`: Drizzle MySQL schema
- `database/mysql-schema.sql`: phpMyAdmin-compatible schema
- `scripts/setup-database.mjs`: schema and initial-Supervisor setup
- `server.js`: Hostinger production startup file

## Mold and product master data

The company workbook `Part n Mold data.xlsx` has been converted into `data/mold-part-master.json`. The database stores this data in `molds` and `parts` tables. Run `npm run db:setup` first, then `npm run db:import-mold-data` to load or refresh the master data. The operator kiosk uses the selected mold number to resolve its family and then suggests products from the same family. A mold/product may still be entered manually if the master data has not yet been mapped.
