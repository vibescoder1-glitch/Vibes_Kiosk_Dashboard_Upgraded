import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getApplicationSession,
  type ApplicationUser,
} from "./operations-data";

export const SESSION_COOKIE = "vibes_session";

const DEV_USER: ApplicationUser = {
  email: "dev@vibescomponents.com",
  login_id: "DEV",
  name: "Development User",
  role: "Supervisor",
  plant: null,
  active: 1,
};

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function readSessionToken(cookieHeader: string | null): string {
  if (!cookieHeader) return "";

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find(
      (part) => part.indexOf(`${SESSION_COOKIE}=`) === 0,
    );

  if (!cookie) return "";

  try {
    return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
  } catch {
    return "";
  }
}

export async function getRequestCompanyUser(
  request: Request,
): Promise<ApplicationUser | null> {
  if (isDevelopment()) return DEV_USER;
  return getApplicationSession(readSessionToken(request.headers.get("cookie")));
}

export async function getCurrentCompanyUser(): Promise<ApplicationUser | null> {
  if (isDevelopment()) return DEV_USER;

  const requestHeaders = await headers();
  return getApplicationSession(readSessionToken(requestHeaders.get("cookie")));
}

export async function requireCompanyUser(
  role: ApplicationUser["role"],
  loginPath: string,
): Promise<ApplicationUser> {
  const user = await getCurrentCompanyUser();
  if (!user || user.role !== role) redirect(loginPath);
  return user;
}

export function sessionCookie(
  token: string,
  secure = process.env.NODE_ENV === "production",
  maxAge = 8 * 60 * 60,
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(
  secure = process.env.NODE_ENV === "production",
): string {
  return sessionCookie("", secure, 0);
}
