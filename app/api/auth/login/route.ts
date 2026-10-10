import { NextResponse } from "next/server";
import {
  authenticateApplicationUser,
  createApplicationSession,
} from "@/lib/operations-data";
import { sessionCookie } from "@/lib/company-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = {
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: "Please enter your company email and password." },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const requestedRole =
    typeof body.role === "string" ? body.role.trim().toLowerCase() : "supervisor";

  if (requestedRole !== "supervisor") {
    return NextResponse.json(
      { error: "This login is for supervisor accounts only." },
      { status: 403 },
    );
  }

  if (!email || email.indexOf("@") === -1 || !password) {
    return NextResponse.json(
      { error: "Please enter your company email and password." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticateApplicationUser(email, password, "Supervisor");

    if (!user || user.role !== "Supervisor" || Number(user.active) !== 1) {
      return NextResponse.json(
        { error: "Email or password is incorrect for the supervisor dashboard." },
        { status: 401 },
      );
    }

    const { token } = await createApplicationSession(user.email);
    const response = NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        plant: user.plant,
      },
      redirectTo: "/supervisor",
    });

    response.headers.append(
      "Set-Cookie",
      sessionCookie(token, process.env.NODE_ENV === "production"),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    // Do not expose SQL, hashes, tokens, or environment values to the browser.
    console.error("[SUPERVISOR LOGIN ERROR]", {
      message: error instanceof Error ? error.message : "Unknown login error",
    });

    return NextResponse.json(
      { error: "Supervisor login is temporarily unavailable. Please try again or contact the administrator." },
      { status: 500 },
    );
  }
}
