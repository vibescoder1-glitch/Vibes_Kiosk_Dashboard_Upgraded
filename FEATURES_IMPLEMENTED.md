# Requested changes included in this source package

1. Production Reports now groups entries by India-local date, operator, and plant and displays daily operator efficiency. Formula: total actual shots / total target shots * 100. Target shots are read from the task when present, otherwise from Mold Master. A separate XLSX export is available for daily operator efficiency.
2. Kiosk displays Part Number and Family Number from the selected mold/part master and includes both fields in the production-entry payload and local CSV export. Dashboard database migration persists these values and the production Excel export includes them.
3. Full database backup is an XLSX workbook with a Backup Info sheet and separate sheets for each backed-up table.
4. Company Data includes an Excel Mold Master upload control using the existing authenticated mold-import API. The workbook needs Part and Mold sheets.
5. Production entry export uses a date-only column and excludes Entry Code, Client Reference, timestamp time, Machine, Employee Code, and Source. Part Number and Family Number are included.

Operator efficiency is calculated as actual shots / target shots * 100. Rows with no configured target do not have a calculated efficiency.

Security: local .env files and installed dependencies are intentionally excluded from the ZIP. Configure environment variables from .env.example before running.

Validation note: source edits were applied, but a complete Next.js/Expo build could not be run in this environment because dependency installation timed out. Run `npm ci` and `npm run typecheck` / `npm run build` in the Dashboard project, and `npm ci` / `npm run check` in the Android project before production deployment.
