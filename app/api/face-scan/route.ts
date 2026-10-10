import { completeFaceScan, getFaceScanPayload } from "../../../lib/operations-data";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function sessionToken(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("session")?.trim()
    || request.headers.get("x-face-session")?.trim()
    || "";
}

export async function GET(request: Request) {
  try {
    return Response.json(await getFaceScanPayload(sessionToken(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = errorMessage(error);
    return Response.json(
      { error: message },
      { status: message.includes("invalid or expired") ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    return Response.json(await completeFaceScan(sessionToken(request), payload), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = errorMessage(error);
    return Response.json(
      { error: message },
      {
        status: message.includes("invalid or expired")
          ? 401
          : message.includes("verified") || message.includes("authorized")
            ? 403
            : 500,
      },
    );
  }
}
