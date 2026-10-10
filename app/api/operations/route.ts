import {
  addOperator,
  addSupervisor,
  assignTask,
  createTask,
  createProductionEntry,
  enrollOperatorFace,
  getFaceEnrollmentStatuses,
  getOperationsSnapshot,
  deleteKiosk,
  registerKiosk,
  regenerateKioskRegistrationCode,
  replaceCompanyData,
  revokeOperatorFace,
  saveSchedule,
  syncKiosk,
  updateMachineStatus,
  updateOperatorStatus,
  updateSupervisorStatus,
} from "../../../lib/operations-data";
import { getRequestCompanyUser } from "../../../lib/company-auth";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

async function requireApplicationUser(request: Request) {
  const applicationUser = await getRequestCompanyUser(request);
  if (!applicationUser) throw new Error("AUTHENTICATION_REQUIRED");
  return applicationUser;
}

export async function GET(request: Request) {
  try {
    const applicationUser = await requireApplicationUser(request);
    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    const snapshot = await getOperationsSnapshot(date);
    return Response.json({
      ...snapshot,
      users: [],
      faceEnrollments: applicationUser.role === "Manager" ? await getFaceEnrollmentStatuses() : [],
    });
  } catch (error) {
    const message = errorMessage(error);
    if (message === "AUTHENTICATION_REQUIRED") return Response.json({ error: "Sign in is required" }, { status: 401 });
    if (message === "ACCESS_DENIED") return Response.json({ error: "Your account is not authorized" }, { status: 403 });
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const applicationUser = await requireApplicationUser(request);
    const payload = (await request.json()) as Record<string, unknown>;
    let result: unknown = { ok: true };
    if (applicationUser.role !== "Manager") {
      return Response.json({ error: "Supervisor authorization is required" }, { status: 403 });
    }

    switch (payload.action) {
      case "saveSchedule":
        await saveSchedule(payload);
        break;
      case "createEntry":
        result = await createProductionEntry(payload);
        break;
      case "createTask":
        result = await createTask(payload, { email: applicationUser.email, name: applicationUser.name });
        break;
      case "assignTask":
        await assignTask(payload);
        break;
      case "addOperator":
        result = await addOperator(payload);
        break;
      case "updateOperatorStatus":
        await updateOperatorStatus(payload);
        break;
      case "addSupervisor":
        result = await addSupervisor(payload);
        break;
      case "updateSupervisorStatus":
        await updateSupervisorStatus(payload);
        break;
      case "updateMachineStatus":
        await updateMachineStatus(payload);
        break;
      case "syncKiosk":
        await syncKiosk(payload);
        break;
      case "registerKiosk":
        result = await registerKiosk(payload, applicationUser.email);
        break;
      case "regenerateKioskRegistrationCode":
        result = await regenerateKioskRegistrationCode(payload);
        break;
      case "deleteKiosk":
        result = await deleteKiosk(payload);
        break;
      case "replaceCompanyData":
        result = await replaceCompanyData(payload);
        break;
      case "enrollOperatorFace":
        result = await enrollOperatorFace(payload, applicationUser.email);
        break;
      case "revokeOperatorFace":
        result = await revokeOperatorFace(payload);
        break;
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    return Response.json(result, { status: 200 });
  } catch (error) {
    const message = errorMessage(error);
    const status = message === "AUTHENTICATION_REQUIRED" ? 401
      : message === "ACCESS_DENIED" ? 403
        : message.includes("required") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
