import * as XLSX from "xlsx";
import { database } from "../../../lib/postgres";
import { getRequestCompanyUser } from "../../../lib/company-auth";

export const dynamic = "force-dynamic";
const norm = (value: unknown) => String(value ?? "").trim();
const key = (value: unknown) => norm(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (value: unknown) => { if (value === null || value === undefined || norm(value) === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; };
function rowsFor(sheet: XLSX.WorkSheet, headerNeedle: string) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true }) as unknown[][];
  const headerIndex = rows.findIndex((row) => row.some((cell) => key(cell) === key(headerNeedle)));
  if (headerIndex < 0) throw new Error(`Could not find the ${headerNeedle} header in sheet ${sheet}`);
  const headers = rows[headerIndex].map(key);
  return rows.slice(headerIndex + 1).map((row, offset) => ({ rowNumber: headerIndex + offset + 2, values: Object.fromEntries(headers.map((header, i) => [header, row[i]])) })).filter(({ values }) => Object.values(values).some((value) => norm(value)));
}
function val(row: Record<string, unknown>, ...names: string[]) { for (const name of names) { const v = row[key(name)]; if (v !== null && v !== undefined && norm(v) !== "") return v; } return null; }
export async function POST(request: Request) {
  const user = await getRequestCompanyUser(request);
  // The current dashboard login is provisioned for Supervisors. Permit both
  // authenticated Supervisor and Manager accounts to maintain the shared master.
  if (!user || !["Manager", "Supervisor"].includes(user.role)) {
    return Response.json({ error: "Supervisor or Manager authorization is required" }, { status: 403 });
  }
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an Excel workbook first" }, { status: 400 });
    if (!/\.(xlsx|xls)$/i.test(file.name)) return Response.json({ error: "Upload an .xlsx or .xls workbook" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Workbook must be smaller than 15 MB" }, { status: 400 });
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const partSheet = workbook.Sheets[workbook.SheetNames.find((name) => key(name) === "part") ?? ""];
    const moldSheet = workbook.Sheets[workbook.SheetNames.find((name) => key(name) === "mold") ?? ""];
    if (!partSheet || !moldSheet) return Response.json({ error: "Workbook must contain sheets named 'part' and 'Mold'" }, { status: 400 });
    const parts = rowsFor(partSheet, "Vibes part no").map(({ rowNumber, values }) => ({ rowNumber, partNo: norm(val(values, "Vibes part no", "Part No", "part_no")), family: norm(val(values, "Family")), description: norm(val(values, "DESCRIPTION", "Description")), commodity: norm(val(values, "Commodity")), insertPartNo: norm(val(values, "Insert Part no")), rubberCompound: norm(val(values, "RUBBER COMPOUND")), rejectionAllowed: num(val(values, "Rejection allowed")), partWeight: num(val(values, "Part Wt.")), inspection: num(val(values, "Inspection")), finalInspectionTarget: num(val(values, "Final Inspection Target")) })).filter((p) => p.partNo);
    const molds = rowsFor(moldSheet, "Mold no").map(({ rowNumber, values }) => ({ rowNumber, family: norm(val(values, "Family")), moldNo: norm(val(values, "Mold no")), description: norm(val(values, "Vibes description")), cavities: num(val(values, "Cavities")), cycleTime: num(val(values, "Cycle time")), reqTonn: norm(val(values, "Req Tonn")), inspectionTime: num(val(values, "Inspection time")), shotWt: num(val(values, "Shot wt")), sheetWt: num(val(values, "Sheet wt")), flashWt: num(val(values, "flash wt")), shotTarget: num(val(values, "Shot Target")), runningCavities: num(val(values, "Running ok cavities")), inspectionTarget: num(val(values, "INSPECTION TARGET")), oldMoldNo: norm(val(values, "old mold no")), manufacturingYear: norm(val(values, "Manufacturing year")), plant: norm(val(values, "PLANT")), moldMaterial: norm(val(values, "Mold Material")) })).filter((m) => m.moldNo && m.family);
    if (!parts.length || !molds.length) return Response.json({ error: "No valid part or mold records were found. Check the workbook headers and data." }, { status: 400 });
    const warnings: string[] = [];
    const moldCounts = new Map<string, number>(); for (const mold of molds) moldCounts.set(mold.moldNo.toLowerCase(), (moldCounts.get(mold.moldNo.toLowerCase()) ?? 0) + 1);
    const duplicateCount = [...moldCounts.values()].filter((count) => count > 1).length;
    if (duplicateCount) warnings.push(`${duplicateCount} mold numbers occur more than once; records were matched by mold number, family and plant.`);
    const partFamilies = new Set(parts.map((p) => p.family.toLowerCase()));
    const unmatched = new Set(molds.map((m) => m.family).filter((family) => !partFamilies.has(family.toLowerCase())));
    if (unmatched.size) warnings.push(`${unmatched.size} mold families do not have a matching part family.`);
    const now = new Date().toISOString(); const statements = [];
    for (const p of parts) {
      statements.push(database.prepare(`INSERT INTO parts (part_no, family, description, commodity, insert_part_no, rubber_compound, rejection_allowed, part_weight, inspection, final_inspection_target, source_row, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (part_no) DO UPDATE SET family=EXCLUDED.family, description=EXCLUDED.description, commodity=EXCLUDED.commodity, insert_part_no=EXCLUDED.insert_part_no, rubber_compound=EXCLUDED.rubber_compound, rejection_allowed=EXCLUDED.rejection_allowed, part_weight=EXCLUDED.part_weight, inspection=EXCLUDED.inspection, final_inspection_target=EXCLUDED.final_inspection_target, source_row=EXCLUDED.source_row`).bind(p.partNo,p.family,p.description||null,p.commodity||null,p.insertPartNo||null,p.rubberCompound||null,p.rejectionAllowed,p.partWeight,p.inspection,p.finalInspectionTarget,p.rowNumber,now));
    }
    for (const m of molds) {
      const existing = await database.prepare("SELECT id FROM molds WHERE LOWER(TRIM(mold_no)) = LOWER(TRIM(?)) AND LOWER(TRIM(family)) = LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(plant, ''))) = LOWER(TRIM(?)) ORDER BY id LIMIT 1").bind(m.moldNo,m.family,m.plant).first<{id:number}>();
      if (existing) statements.push(database.prepare(`UPDATE molds SET vibes_description=?, cavities=?, cycle_time=?, req_tonn=?, inspection_time=?, shot_wt=?, sheet_wt=?, flash_wt=?, shot_target=?, running_ok_cavities=?, inspection_target=?, old_mold_no=?, manufacturing_year=?, mold_material=?, source_row=?, created_at=? WHERE id=?`).bind(m.description||null,m.cavities,m.cycleTime,m.reqTonn||null,m.inspectionTime,m.shotWt,m.sheetWt,m.flashWt,m.shotTarget,m.runningCavities,m.inspectionTarget,m.oldMoldNo||null,m.manufacturingYear||null,m.moldMaterial||null,m.rowNumber,now,existing.id));
      else statements.push(database.prepare(`INSERT INTO molds (family,mold_no,vibes_description,cavities,cycle_time,req_tonn,inspection_time,shot_wt,sheet_wt,flash_wt,shot_target,running_ok_cavities,inspection_target,old_mold_no,manufacturing_year,plant,mold_material,source_row,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(m.family,m.moldNo,m.description||null,m.cavities,m.cycleTime,m.reqTonn||null,m.inspectionTime,m.shotWt,m.sheetWt,m.flashWt,m.shotTarget,m.runningCavities,m.inspectionTarget,m.oldMoldNo||null,m.manufacturingYear||null,m.plant||null,m.moldMaterial||null,m.rowNumber,now));
    }
    await database.batch(statements);
    return Response.json({ ok: true, molds: molds.length, parts: parts.length, warnings });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not import workbook" }, { status: 400 }); }
}
