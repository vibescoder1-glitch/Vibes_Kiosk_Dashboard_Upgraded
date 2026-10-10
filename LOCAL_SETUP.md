# Local testing setup

The web app is intended to run locally during development and on Hostinger in production.

1. Copy `.env.example` to `.env.local`.
2. Set the local MySQL credentials for the `vibes_factory_operations` database.
3. Keep `APP_HOST=0.0.0.0` so a tablet on the same Wi-Fi can reach the Mac.
4. Run `npm install`, then `npm run dev -- -H 0.0.0.0`.
5. For the Android local test, use `EXPO_PUBLIC_API_BASE_URL=http://<MAC-LAN-IP>:3000` in the Android project's `.env`.
6. For Hostinger, replace the Android API URL with the final HTTPS Hostinger domain before building the APK/AAB.

Do not commit `.env.local` or production secrets.
