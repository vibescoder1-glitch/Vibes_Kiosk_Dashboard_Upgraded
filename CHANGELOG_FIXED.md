# Kiosk project fixes

## Task assignment
- Fixed the dashboard exception constructor to use JavaScript's `Error` (`new Error(...)`).
- Fixed the underlying MySQL foreign-key failure by validating the selected machine and operator before creating or assigning a task.
- Operators must exist, belong to the task plant, and be Active.
- Completed tasks cannot be reassigned.
- Scheduling now uses the same reference validation, preventing the same foreign-key problem there.

## Kiosk activation codes
- Pending kiosk activation codes are now visible in the Supervisor dashboard under Kiosk Devices.
- The code is not exposed in the Android kiosk snapshot.
- Pending kiosks have a `New code` action so a forgotten code can be regenerated without creating an orphan kiosk record.
- Authorized kiosks have already consumed their one-time code. To issue a completely new code for an authorized device, delete/revoke that kiosk and register it again.

## Display name
- Configured supervisor display name is now `Vibes Components`.

## Hostinger compatibility
- The project remains a standard Next.js + Node.js + MySQL application suitable for Hostinger Node.js hosting.
- Local testing remains supported. The Android local test configuration points to `http://192.168.1.8:3000`; change it to the final HTTPS Hostinger URL for the production APK/AAB.


## 2026-09-16 production/export fix
- Production entry exports now use one canonical all-record query and include Weight Unit, Running Cavities and Operator Hours.
- Today/week/month export ranges use Asia/Kolkata calendar dates.
- Operator Hours is stored per production entry with an 8-hour kiosk default and is visible in Production History/export.
- Shift selection on the kiosk is explicitly Morning (default) or Night.
