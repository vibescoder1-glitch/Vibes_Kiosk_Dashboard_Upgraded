import {
  activateKiosk,
  authorizeKioskToken,
  createProductionEntry,
  createFaceScanSession,
  getKioskSnapshot,
  recordOfflineTest,
  touchKiosk,
} from "../../../lib/operations-data";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function GET(request: Request) {
  try {
    const kiosk = await authorizeKioskToken(bearerToken(request));
    if (!kiosk) return Response.json({ error: "This kiosk is not authorized" }, { status: 401 });
    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    await touchKiosk(kiosk.id);
    return Response.json(await getKioskSnapshot(kiosk, date));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    if (payload.action === "activate") {
      return Response.json(await activateKiosk(String(payload.registrationCode ?? "")));
    }

    const kiosk = await authorizeKioskToken(bearerToken(request));
    if (!kiosk) return Response.json({ error: "This kiosk is not authorized" }, { status: 401 });

    if (payload.action === "recordOfflineTest") {
      return Response.json(await recordOfflineTest(kiosk.id));
    }
    if (payload.action === "createFaceScanSession") {
      return Response.json(await createFaceScanSession(kiosk));
    }
    if (payload.action === "heartbeat") {
      await touchKiosk(kiosk.id, Number(payload.pendingSync ?? 0));
      return Response.json({ ok: true });
    }
    if (payload.action === "createEntry") {
      if (String(payload.plant ?? "") !== kiosk.plant) {
        return Response.json({ error: "Entry plant does not match this kiosk authorization" }, { status: 403 });
      }
      const snapshot = await getKioskSnapshot(kiosk);
      const validOperator = snapshot.operators.some((row) => String((row as { id: string }).id) === String(payload.operatorId));
      const validMachine = snapshot.machines.some((row) => String((row as { id: string }).id) === String(payload.machineId));
      if (!validOperator || !validMachine) {
        return Response.json({ error: "Operator or machine is not authorized for this plant" }, { status: 403 });
      }
      const taskId = String(payload.taskId ?? "").trim();
      if (taskId) {
        const validTask = snapshot.tasks.some((row) => {
          const task = row as { id: string; operator_id: string | null; machine_id: string; status: string };
          return task.id === taskId
            && task.operator_id === String(payload.operatorId)
            && task.machine_id === String(payload.machineId)
            && task.status.toLowerCase() !== "completed";
        });
        if (!validTask) {
          return Response.json({ error: "The selected task is not assigned to this operator and machine" }, { status: 403 });
        }
      }
      console.log("KIOSK PRODUCTION PAYLOAD:", {
        shotCount: payload.shotCount,
        actualWeightGrams: payload.actualWeightGrams,
        okQty: payload.okQty,
        rejectionQty: payload.rejectionQty,
        downtimeMinutes: payload.downtimeMinutes,
        remarks: payload.remarks,
      });
      const result = await createProductionEntry({ ...payload, syncedFrom: kiosk.id });
      await touchKiosk(kiosk.id);
      return Response.json(result);
    }

    return Response.json({ error: "Unknown kiosk action" }, { status: 400 });
  } catch (error) {
    const message = errorMessage(error);
    return Response.json({ error: message }, { status: message.includes("required") ? 400 : 500 });
  }
}
