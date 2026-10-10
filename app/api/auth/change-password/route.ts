import { changeApplicationPassword } from "../../../../lib/operations-data";
import { clearSessionCookie, getRequestCompanyUser } from "../../../../lib/company-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getRequestCompanyUser(request);
    if (!user || user.role !== "Manager") {
      return Response.json({ error: "Supervisor authentication is required" }, { status: 401 });
    }
    const payload = await request.json() as { currentPassword?: string; newPassword?: string };
    if (!payload.currentPassword || !payload.newPassword) {
      return Response.json({ error: "Current and new passwords are required" }, { status: 400 });
    }
    await changeApplicationPassword(user.email, payload.currentPassword, payload.newPassword);
    return Response.json(
      { ok: true, message: "Password changed. Sign in again with your new password." },
      { headers: { "Set-Cookie": clearSessionCookie(new URL(request.url).protocol === "https:") } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change password";
    return Response.json({ error: message }, { status: message.includes("incorrect") || message.includes("must") ? 400 : 500 });
  }
}
