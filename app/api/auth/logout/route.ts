import { clearSessionCookie, readSessionToken } from "../../../../lib/company-auth";
import { deleteApplicationSession } from "../../../../lib/operations-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await deleteApplicationSession(readSessionToken(request.headers.get("cookie")));
  const requestedReturn = new URL(request.url).searchParams.get("returnTo") ?? "/";
  const returnTo = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "/";
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(returnTo, request.url).toString(),
      "Set-Cookie": clearSessionCookie(new URL(request.url).protocol === "https:"),
    },
  });
}
