"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Download,
  Factory,
  FileClock,
  FileSpreadsheet,
  Gauge,
  HardDriveDownload,
  History,
  KeyRound,
  ListFilter,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  TabletSmartphone,
  Trash2,
  UploadCloud,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  PLANTS,
  SHIFTS,
  type Kiosk,
  type Machine,
  type MoldMaster,
  type Operator,
  type PartMaster,
  type ProductionEntry,
  type ProductionTask,
  type Snapshot,
  type Supervisor,
} from "./operations-dashboard";
import { FaceEnrollmentPanel } from "./face-enrollment";

export type ActionRunner = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

type SharedProps = {
  snapshot: Snapshot;
  plantFilter: string;
  onAction: ActionRunner;
  notify: (message: string) => void;
  readOnly?: boolean;
};

const PRODUCTS = ["Cable Seal", "Connector Grommet", "Rubber Bellows", "Terminal Seal", "Wire Grommet", "Sensor Boot"];
const MACHINE_STATUSES = ["Running", "Idle", "Maintenance", "Breakdown"];
const COLOUR_CODES: Record<string, string> = {
  "00": "Transparent", "10": "White", "20": "Red", "21": "Brown",
  "30": "Black", "40": "Yellow", "50": "Green", "60": "Blue",
  "70": "Grey", "80": "Orange",
};

function partColour(part: Pick<PartMaster, "part_no" | "description"> | null | undefined) {
  if (!part) return "";
  const codeMatch = String(part.part_no ?? "").match(/-(00|10|20|21|30|40|50|60|70|80)(?:-|$)/);
  if (codeMatch) return COLOUR_CODES[codeMatch[1]] ?? "";
  const description = String(part.description ?? "");
  const colourMatch = description.match(/\b(transparent|white|red|brown|black|yellow|green|blue|grey|gray|orange)\b/i);
  return colourMatch ? colourMatch[1].replace(/^./, (c) => c.toUpperCase()).replace(/^Gray$/, "Grey") : "";
}

function partCompound(part: Pick<PartMaster, "rubber_compound"> | null | undefined) {
  return part?.rubber_compound?.trim() ?? "";
}



function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function statusClass(status: string) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function sameId(left: unknown, right: unknown) {
  return normalized(left) !== "" && normalized(left) === normalized(right);
}

function taskBelongsToOperator(task: ProductionTask, operator: Operator) {
  return sameId(task.operator_id, operator.id)
    || normalized(task.employee_code) === normalized(operator.employee_code);
}

function ModuleHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="module-header">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><div><p className="eyebrow">Factory operations</p><h2>{title}</h2></div><button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={19} /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function MiniKpi({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: string }) {
  return (
    <article className="mini-kpi">
      <span className={`mini-kpi-icon ${tone}`}><Icon size={19} /></span>
      <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
    </article>
  );
}

function EmptyState({ icon: Icon = FileClock, title, detail }: { icon?: typeof Activity; title: string; detail: string }) {
  return <div className="module-empty"><Icon size={28} /><strong>{title}</strong><p>{detail}</p></div>;
}

export function LiveMonitoringView({ snapshot, plantFilter, onAction, notify }: SharedProps) {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const machines = plantFilter === "All Plants" ? snapshot.machines : snapshot.machines.filter((machine) => machine.plant === plantFilter);
  const operatorsById = useMemo(() => new Map(snapshot.operators.map((operator) => [operator.id, operator])), [snapshot.operators]);
  const running = machines.filter((machine) => machine.status === "Running").length;
  const attention = machines.filter((machine) => ["Maintenance", "Breakdown"].includes(machine.status)).length;
  const output = machines.reduce((sum, machine) => sum + Number(machine.output_today), 0);
  const machineIds = new Set(machines.map((machine) => machine.id));
  const liveEntries = snapshot.entries.filter((entry) => machineIds.has(entry.machine_id));
  const shots = liveEntries.reduce((sum, entry) => sum + Number(entry.shot_count || 0), 0);
  const weightedEntries = liveEntries.filter((entry) => Number(entry.actual_weight_grams) > 0);
  const averageWeight = weightedEntries.length
    ? weightedEntries.reduce((sum, entry) => sum + Number(entry.actual_weight_grams), 0) / weightedEntries.length
    : 0;
  const downtime = liveEntries.reduce((sum, entry) => sum + Number(entry.downtime_minutes || 0), 0);

  async function changeStatus(status: string) {
    if (!selectedMachine) return;
    await onAction({ action: "updateMachineStatus", machineId: selectedMachine.id, status });
    notify(`${selectedMachine.plant} ${selectedMachine.machine_no} marked ${status.toLowerCase()}`);
    setSelectedMachine(null);
  }

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Live factory floor" title="Machine monitoring" description="See all 36 machines, current operators, products and production progress." action={<span className="live-badge"><span />Live data</span>} />
      <div className="mini-kpi-grid">
        <MiniKpi label="Running" value={`${running}/${machines.length}`} detail="Machines producing now" icon={Activity} tone="green" />
        <MiniKpi label="Shots recorded" value={formatNumber(shots)} detail={`${formatNumber(output)} accepted units`} icon={Gauge} tone="blue" />
        <MiniKpi label="Average weight" value={`${averageWeight.toFixed(1)} g`} detail="From operator readings" icon={PackageCheck} tone="violet" />
        <MiniKpi label="Downtime" value={`${downtime} min`} detail={`${attention} machines need attention`} icon={Clock3} tone="amber" />
      </div>

      {PLANTS.filter((plant) => plantFilter === "All Plants" || plant === plantFilter).map((plant) => (
        <section className="panel machine-section" key={plant}>
          <div className="panel-title-row"><div><p className="eyebrow">12-machine cell</p><h2>{plant}</h2></div><span className="machine-legend"><i className="running" />Running <i className="idle" />Idle <i className="maintenance" />Maintenance <i className="breakdown" />Breakdown</span></div>
          <div className="machine-grid">
            {machines.filter((machine) => machine.plant === plant).map((machine) => {
              const operator = machine.current_operator_id ? operatorsById.get(machine.current_operator_id) : undefined;
              const progress = Math.min(100, Math.round((Number(machine.output_today) / Math.max(1, Number(machine.target_today))) * 100));
              return (
                <button className={`machine-card ${statusClass(machine.status)}`} type="button" key={machine.id} onClick={() => setSelectedMachine(machine)}>
                  <span className="machine-card-top"><strong>{machine.machine_no}</strong><span><i />{machine.status}</span></span>
                  <small>{machine.product}</small>
                  <p>{operator?.name ?? "No operator assigned"}</p>
                  <span className="machine-output"><b>{formatNumber(machine.output_today)}</b><small>/ {formatNumber(machine.target_today)}</small><em>{progress}%</em></span>
                  <span className="machine-progress"><span style={{ width: `${progress}%` }} /></span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {selectedMachine ? (
        <Modal title={`${selectedMachine.plant} · ${selectedMachine.machine_no}`} onClose={() => setSelectedMachine(null)}>
          {(() => {
            const latestEntry = snapshot.entries.find((entry) => entry.machine_id === selectedMachine.id);
            return latestEntry ? <div className="live-reading-strip"><div><small>Latest shots</small><strong>{formatNumber(latestEntry.shot_count || 0)}</strong></div><div><small>Actual weight</small><strong>{Number(latestEntry.actual_weight_grams || 0).toFixed(1)} g</strong></div><div><small>Downtime</small><strong>{latestEntry.downtime_minutes} min</strong></div><div><small>Last update</small><strong>{formatDate(latestEntry.created_at, true)}</strong></div></div> : null;
          })()}
          <div className="detail-grid">
            <div><small>Status</small><strong className={`status-text ${statusClass(selectedMachine.status)}`}>{selectedMachine.status}</strong></div>
            <div><small>Product</small><strong>{selectedMachine.product}</strong></div>
            <div><small>Operator</small><strong>{selectedMachine.current_operator_id ? operatorsById.get(selectedMachine.current_operator_id)?.name : "Unassigned"}</strong></div>
            <div><small>Output</small><strong>{formatNumber(selectedMachine.output_today)} / {formatNumber(selectedMachine.target_today)}</strong></div>
          </div>
          <div className="form-field"><label>Change machine status</label><div className="status-actions">{MACHINE_STATUSES.map((status) => <button className={selectedMachine.status === status ? "selected" : ""} type="button" key={status} onClick={() => void changeStatus(status)}>{status}</button>)}</div></div>
        </Modal>
      ) : null}
    </div>
  );
}

type SchedulingProps = SharedProps & { onDateChange: (date: string) => Promise<void> };

export function SchedulingView({ snapshot, plantFilter, onAction, notify, onDateChange, readOnly = false }: SchedulingProps) {
  const [shift, setShift] = useState("Morning");
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [form, setForm] = useState({ operatorId: "", product: PRODUCTS[0], targetQty: "500" });
  const [saving, setSaving] = useState(false);
  const machines = snapshot.machines.filter((machine) => plantFilter === "All Plants" || machine.plant === plantFilter);
  const activeOperators = snapshot.operators.filter((operator) => operator.status === "Active");
  const shiftSchedules = snapshot.schedules.filter((schedule) => schedule.shift === shift && (plantFilter === "All Plants" || schedule.plant === plantFilter));

  function openAssignment(machine: Machine) {
    if (readOnly) return;
    const current = snapshot.schedules.find((schedule) => schedule.machine_id === machine.id && schedule.shift === shift);
    setSelectedMachine(machine);
    setForm({ operatorId: current?.operator_id ?? "", product: current?.product ?? machine.product ?? PRODUCTS[0], targetQty: String(current?.target_qty ?? machine.target_today ?? 500) });
  }

  async function submitAssignment(event: FormEvent) {
    event.preventDefault();
    if (!selectedMachine || !form.operatorId) return;
    setSaving(true);
    try {
      await onAction({
        action: "saveSchedule",
        scheduleDate: snapshot.date,
        plant: selectedMachine.plant,
        shift,
        machineId: selectedMachine.id,
        operatorId: form.operatorId,
        product: form.product,
        targetQty: Number(form.targetQty),
        status: shift === "Morning" ? "In Progress" : "Scheduled",
        createdBy: "Supervisor",
      });
      notify(`${selectedMachine.machine_no} assignment saved for ${shift.toLowerCase()} shift`);
      setSelectedMachine(null);
    } finally { setSaving(false); }
  }

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Production planning" title="Scheduling" description={readOnly ? "Read-only production schedule." : "Assign or reschedule operators and products by plant, date and shift."} action={<label className="date-control"><CalendarDays size={17} /><input type="date" value={snapshot.date} onChange={(event) => void onDateChange(event.target.value)} /></label>} />
      {readOnly ? <div className="warning-note"><ShieldCheck size={17} />This schedule is read-only.</div> : null}
      <div className="schedule-toolbar panel">
        <div className="segmented-control" aria-label="Select shift">{SHIFTS.map((item) => <button className={item === shift ? "active" : ""} type="button" key={item} onClick={() => setShift(item)}>{item}<span>{snapshot.schedules.filter((schedule) => schedule.shift === item).length}</span></button>)}</div>
        <span className="coverage-text"><UserCheck size={17} />{shiftSchedules.length} of {machines.length} machines assigned</span>
      </div>
      <section className="panel data-panel">
        <div className="data-table schedule-table" role="table" aria-label="Machine schedule">
          <div className="data-table-head" role="row"><span>Machine</span><span>Plant</span><span>Operator</span><span>Product</span><span>Target</span><span>Status</span><span>{readOnly ? "Access" : "Action"}</span></div>
          {machines.map((machine) => {
            const schedule = snapshot.schedules.find((item) => item.machine_id === machine.id && item.shift === shift);
            return (
              <div className="data-table-row" role="row" key={machine.id}>
                <span className="strong-cell"><Factory size={16} />{machine.machine_no}</span><span>{machine.plant}</span><span>{schedule?.operator_name ?? <em>Unassigned</em>}</span><span>{schedule?.product ?? "—"}</span><span>{schedule ? formatNumber(schedule.target_qty) : "—"}</span><span><i className={`table-status ${schedule ? statusClass(schedule.status) : "unassigned"}`}>{schedule?.status ?? "Unassigned"}</i></span><span>{readOnly ? <i className="source-badge">View only</i> : <button className="table-action" type="button" onClick={() => openAssignment(machine)}><Pencil size={14} />{schedule ? "Reschedule" : "Assign"}</button>}</span>
              </div>
            );
          })}
        </div>
      </section>

      {selectedMachine && !readOnly ? (
        <Modal title={`Assign ${selectedMachine.machine_no} · ${shift} shift`} onClose={() => setSelectedMachine(null)}>
          <form className="form-stack" onSubmit={submitAssignment}>
            <div className="assignment-summary"><Factory size={21} /><div><strong>{selectedMachine.plant} · {selectedMachine.machine_no}</strong><span>{snapshot.date} · {shift} shift</span></div></div>
            <label className="form-field"><span>Operator</span><select required value={form.operatorId} onChange={(event) => setForm((value) => ({ ...value, operatorId: event.target.value }))}><option value="">Select operator</option>{activeOperators.filter((operator) => operator.plant === selectedMachine.plant).map((operator) => <option value={operator.id} key={operator.id}>{operator.employee_code} · {operator.name} · {operator.skill_level}</option>)}</select></label>
            <label className="form-field"><span>Product</span><input list="products" required value={form.product} onChange={(event) => setForm((value) => ({ ...value, product: event.target.value }))} /><datalist id="products">{PRODUCTS.map((product) => <option key={product} value={product} />)}</datalist></label>
            <label className="form-field"><span>Target quantity</span><input min="1" type="number" required value={form.targetQty} onChange={(event) => setForm((value) => ({ ...value, targetQty: event.target.value }))} /></label>
            <div className="modal-actions"><button className="secondary-action" type="button" onClick={() => setSelectedMachine(null)}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}Save assignment</button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export function TasksView({ snapshot, plantFilter, onAction, notify, readOnly = false }: SharedProps) {
  const initialPlant = plantFilter === "All Plants" ? "Plant 1" : plantFilter;
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState({
    title: "",
    plant: initialPlant,
    machineId: "",
    operatorId: "",
    supervisorName: "",
    shift: "Morning",
    product: "",
    moldNo: "",
    targetShots: "",
    targetWeightGrams: "20",
    dueDate: snapshot.date,
    priority: "Normal",
    instructions: "",
  });

  const tasks = snapshot.tasks.filter((task) => {
    const plantMatch = plantFilter === "All Plants" || task.plant === plantFilter;
    return plantMatch && (statusFilter === "All" || task.status === statusFilter);
  });
  const plantMachines = snapshot.machines.filter((machine) => machine.plant === form.plant);
  const plantOperators = snapshot.operators.filter((operator) => operator.plant === form.plant && operator.status === "Active");
  const plantSupervisors = snapshot.supervisors.filter((supervisor) => supervisor.plant === form.plant && supervisor.status === "Active");
  const selectedMold = snapshot.molds.find((mold) => normalized(mold.mold_no) === normalized(form.moldNo));

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await onAction({
        action: "createTask",
        ...form,
      });
      notify(`Task ${String(result.taskCode ?? "")} sent to the operator kiosk`);
      setShowCreate(false);
      setForm((value) => ({ ...value, title: "", machineId: "", operatorId: "", supervisorName: "", product: "", moldNo: "", instructions: "" }));
    } finally { setSaving(false); }
  }

  async function assignOperator(task: ProductionTask, operatorId: string) {
    if (!operatorId) return;
    setSaving(true);
    try {
      await onAction({ action: "assignTask", taskId: task.id, operatorId });
      const operator = snapshot.operators.find((item) => item.id === operatorId);
      notify(`${task.task_code} assigned to ${operator?.name ?? "operator"}`);
      setSelectedTask(null);
    } finally { setSaving(false); }
  }

  return (
    <div className="view-stack">
      <ModuleHeader
        eyebrow="Supervisor to shop floor"
        title="Production tasks"
        description={readOnly ? "View supervisor-issued tasks and follow completion from the operator kiosk." : "Create work, assign operators and track completion from the kiosk."}
        action={readOnly ? <span className="source-badge">Read-only access</span> : <button className="primary-action" type="button" onClick={() => setShowCreate(true)}><Plus size={17} />Create task</button>}
      />
      <div className="mini-kpi-grid">
        <MiniKpi label="Tasks today" value={String(snapshot.tasks.length)} detail="Supervisor-issued work" icon={ClipboardList} />
        <MiniKpi label="Awaiting operator" value={String(snapshot.tasks.filter((task) => task.status === "Assigned").length)} detail="Supervisor action required" icon={UserPlus} tone="amber" />
        <MiniKpi label="Ready at kiosk" value={String(snapshot.tasks.filter((task) => task.status === "Ready").length)} detail="Visible to assigned operators" icon={TabletSmartphone} tone="blue" />
        <MiniKpi label="Completed" value={String(snapshot.tasks.filter((task) => task.status === "Completed").length)} detail="Readings received" icon={CheckCircle2} tone="green" />
      </div>
      <section className="panel data-panel">
        <div className="table-toolbar">
          <div><strong>Supervisor task list</strong><small>Create tasks, assign operators and follow production readings</small></div>
          <label className="small-select"><ListFilter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Assigned</option><option>Ready</option><option>Completed</option></select></label>
        </div>
        {tasks.length ? (
          <div className="data-table tasks-table" role="table" aria-label="Production tasks">
            <div className="data-table-head" role="row"><span>Task</span><span>Plant / Machine</span><span>Supervisor</span><span>Operator</span><span>Targets</span><span>Due</span><span>Status</span></div>
            {tasks.map((task) => (
              <button className="data-table-row clickable" role="row" type="button" key={task.id} onClick={() => setSelectedTask(task)}>
                <span className="strong-cell"><ClipboardList size={15} /><span>{task.task_code}<small>{task.title}</small></span></span>
                <span>{task.plant} · {task.machine_no}<small>{task.product}</small></span>
                <span>{task.supervisor_name}<small>{task.shift}</small></span>
                <span>{task.operator_name || "Not assigned"}<small>{task.employee_code || "Supervisor to assign"}</small></span>
                <span>{formatNumber(task.target_shots)} shots<small>{task.target_weight_grams} g target weight</small></span>
                <span>{formatDate(task.due_date)}<small className={task.priority === "High" ? "negative-number" : ""}>{task.priority} priority</small></span>
                <span><i className={`table-status ${statusClass(task.status)}`}>{task.status}</i></span>
              </button>
            ))}
          </div>
        ) : <EmptyState title="No tasks found" detail="Create a task or change the current filters." />}
      </section>

      {showCreate && !readOnly ? (
        <Modal title="Create production task" onClose={() => setShowCreate(false)} wide>
          <form className="form-stack" onSubmit={createTask}>
            <div className="form-grid two">
              <label className="form-field"><span>Task title</span><input required placeholder="e.g. Run Cable Seal batch" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
              <label className="form-field"><span>Plant</span><select value={form.plant} onChange={(event) => setForm((value) => ({ ...value, plant: event.target.value, machineId: "", operatorId: "", supervisorName: "" }))}>{PLANTS.map((plant) => <option key={plant}>{plant}</option>)}</select></label>
              <label className="form-field"><span>Machine</span><select required value={form.machineId} onChange={(event) => setForm((value) => ({ ...value, machineId: event.target.value }))}><option value="">Select machine</option>{plantMachines.map((machine) => <option value={machine.id} key={machine.id}>{machine.machine_no} · {machine.status}</option>)}</select></label>
              <label className="form-field"><span>Shift</span><select value={form.shift} onChange={(event) => setForm((value) => ({ ...value, shift: event.target.value }))}>{SHIFTS.map((shift) => <option key={shift}>{shift}</option>)}</select></label>
              <label className="form-field"><span>Supervisor</span><select required value={form.supervisorName} onChange={(event) => setForm((value) => ({ ...value, supervisorName: event.target.value }))}><option value="">Select supervisor</option>{plantSupervisors.map((supervisor) => <option value={supervisor.name} key={supervisor.id}>{supervisor.name}</option>)}</select></label>
              <label className="form-field"><span>Operator (optional)</span><select value={form.operatorId} onChange={(event) => setForm((value) => ({ ...value, operatorId: event.target.value }))}><option value="">Supervisor will assign later</option>{plantOperators.map((operator) => <option value={operator.id} key={operator.id}>{operator.employee_code} · {operator.name}</option>)}</select></label>
              <label className="form-field"><span>Product</span><input required value={form.product} onChange={(event) => setForm((value) => ({ ...value, product: event.target.value }))} /></label>
              <label className="form-field"><span>Mold number</span><input list="task-mold-suggestions" required value={form.moldNo} onChange={(event) => { const moldNo = event.target.value; const mold = snapshot.molds.find((item) => normalized(item.mold_no) === normalized(moldNo)); setForm((value) => ({ ...value, moldNo, targetShots: mold?.shot_target != null ? String(mold.shot_target) : value.targetShots })); }} /><datalist id="task-mold-suggestions">{snapshot.molds.map((mold) => <option key={mold.id} value={mold.mold_no}>{mold.family}{mold.shot_target != null ? ` · Target ${mold.shot_target}` : ""}</option>)}</datalist>{selectedMold ? <small className="field-hint">Target shot from mold master: {selectedMold.shot_target ?? "Not defined"}</small> : null}</label>
              <label className="form-field"><span>Target shots</span><input type="number" min="1" required value={form.targetShots} onChange={(event) => setForm((value) => ({ ...value, targetShots: event.target.value }))} placeholder={selectedMold?.shot_target != null ? String(selectedMold.shot_target) : "Select mold first"} /></label>
              <label className="form-field"><span>Target weight (grams)</span><input type="number" min="0" required value={form.targetWeightGrams} onChange={(event) => setForm((value) => ({ ...value, targetWeightGrams: event.target.value }))} /></label>
              <label className="form-field"><span>Due date</span><input type="date" required value={form.dueDate} onChange={(event) => setForm((value) => ({ ...value, dueDate: event.target.value }))} /></label>
              <label className="form-field"><span>Priority</span><select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}><option>Normal</option><option>High</option></select></label>
            </div>
            <label className="form-field"><span>Instructions</span><textarea rows={3} placeholder="Quality checks, downtime reporting requirement, or other instructions" value={form.instructions} onChange={(event) => setForm((value) => ({ ...value, instructions: event.target.value }))} /></label>
            <div className="modal-actions"><button className="secondary-action" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}Send task</button></div>
          </form>
        </Modal>
      ) : null}

      {selectedTask ? (
        <Modal title={selectedTask.task_code} onClose={() => setSelectedTask(null)} wide>
          <div className="task-detail-head"><div><p className="eyebrow">Supervisor-issued work item</p><h2>{selectedTask.title}</h2><p>{selectedTask.instructions || "Record shots, weight and downtime from the operator kiosk."}</p></div><i className={`table-status ${statusClass(selectedTask.status)}`}>{selectedTask.status}</i></div>
          <div className="detail-grid four"><div><small>Plant / Machine</small><strong>{selectedTask.plant} · {selectedTask.machine_no}</strong></div><div><small>Product / Mold</small><strong>{selectedTask.product} · {selectedTask.mold_no || "—"}</strong></div><div><small>Shot target</small><strong>{formatNumber(selectedTask.target_shots)}</strong></div><div><small>Weight target</small><strong>{selectedTask.target_weight_grams} g</strong></div></div>
          {selectedTask.status !== "Completed" ? (readOnly ? <div className="completed-task-note"><ShieldCheck size={20} />This task is read-only.</div> : <label className="form-field"><span>Assign operator</span><select defaultValue={selectedTask.operator_id ?? ""} onChange={(event) => void assignOperator(selectedTask, event.target.value)} disabled={saving}><option value="">Select operator</option>{snapshot.operators.filter((operator) => operator.plant === selectedTask.plant && operator.status === "Active").map((operator) => <option value={operator.id} key={operator.id}>{operator.employee_code} · {operator.name} · {operator.skill_level}</option>)}</select></label>) : <div className="completed-task-note"><CheckCircle2 size={20} />Operator readings received. View them in History or Live Monitoring.</div>}
        </Modal>
      ) : null}
    </div>
  );
}

export function OperatorsView({ snapshot, plantFilter, onAction, notify }: SharedProps) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", employeeCode: "", plant: plantFilter === "All Plants" ? "Plant 1" : plantFilter, shift: "Morning", skillLevel: "L1" });
  // Archived operators are removed from day-to-day management, while their production history remains intact.
  const activeOperators = snapshot.operators.filter((operator) => operator.status !== "Archived");
  const operators = activeOperators.filter((operator) => {
    const matchesPlant = plantFilter === "All Plants" || operator.plant === plantFilter;
    const query = search.trim().toLowerCase();
    return matchesPlant && (!query || `${operator.name} ${operator.employee_code}`.toLowerCase().includes(query));
  });

  async function addOperator(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onAction({ action: "addOperator", ...form });
      notify(`${form.name} added to ${form.plant}`);
      setShowAdd(false);
      setForm({ name: "", employeeCode: "", plant: "Plant 1", shift: "Morning", skillLevel: "L1" });
    } finally { setSaving(false); }
  }

  async function removeOperator(operator: Operator) {
    const confirmed = window.confirm(
      `Remove ${operator.name} from the active operator list? Existing production history will be preserved.`,
    );
    if (!confirmed) return;
    await onAction({ action: "updateOperatorStatus", operatorId: operator.id, status: "Archived" });
    notify(`${operator.name} removed from active operators. Production history is preserved.`);
  }

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Workforce management" title="Operators" description="Manage operator availability, plant allocation, shift and skill level." action={<button className="primary-action" type="button" onClick={() => setShowAdd(true)}><UserPlus size={17} />Add operator</button>} />
      <div className="mini-kpi-grid three">
        <MiniKpi label="Total operators" value={String(activeOperators.length)} detail="Active and off-shift operators" icon={Users} />
        <MiniKpi label="Active now" value={String(activeOperators.filter((item) => item.status === "Active").length)} detail="Available for scheduling" icon={UserCheck} tone="green" />
        <MiniKpi label="Level 3 skilled" value={String(snapshot.operators.filter((item) => item.skill_level === "L3").length)} detail="Advanced machine operators" icon={BadgeCheck} tone="violet" />
      </div>
      <section className="panel data-panel">
        <div className="table-toolbar"><label className="search-control"><Search size={16} /><input placeholder="Search name or employee code" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span>{operators.length} operators</span></div>
        <div className="data-table operators-table" role="table" aria-label="Operators">
          <div className="data-table-head" role="row"><span>Operator</span><span>Employee ID</span><span>Plant</span><span>Shift</span><span>Skill</span><span>Status</span><span>Management</span></div>
          {operators.map((operator) => (
            <div className="data-table-row" role="row" key={operator.id}><span className="person-cell"><i>{operator.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</i><strong>{operator.name}</strong></span><span>{operator.employee_code}</span><span>{operator.plant}</span><span>{operator.shift}</span><span><b className="skill-badge">{operator.skill_level}</b></span><span><i className={`table-status ${statusClass(operator.status)}`}>{operator.status}</i></span><span><button className="table-action" type="button" onClick={() => void removeOperator(operator)} aria-label={`Remove ${operator.name}`}><Trash2 size={14} /> Remove operator</button></span></div>
          ))}
        </div>
      </section>
      {showAdd ? (
        <Modal title="Add operator" onClose={() => setShowAdd(false)}>
          <form className="form-stack" onSubmit={addOperator}>
            <label className="form-field"><span>Full name</span><input required placeholder="e.g. Rohit Patil" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label>
            <label className="form-field"><span>Employee code</span><input required placeholder="e.g. VC037" value={form.employeeCode} onChange={(event) => setForm((value) => ({ ...value, employeeCode: event.target.value }))} /></label>
            <div className="form-grid two"><label className="form-field"><span>Plant</span><select value={form.plant} onChange={(event) => setForm((value) => ({ ...value, plant: event.target.value }))}>{PLANTS.map((plant) => <option key={plant}>{plant}</option>)}</select></label><label className="form-field"><span>Shift</span><select value={form.shift} onChange={(event) => setForm((value) => ({ ...value, shift: event.target.value }))}>{SHIFTS.map((shift) => <option key={shift}>{shift}</option>)}</select></label></div>
            <label className="form-field"><span>Skill level</span><select value={form.skillLevel} onChange={(event) => setForm((value) => ({ ...value, skillLevel: event.target.value }))}><option>L1</option><option>L2</option><option>L3</option></select></label>
            <div className="modal-actions"><button className="secondary-action" type="button" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <RefreshCw className="spin" size={16} /> : <Plus size={16} />}Add operator</button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export function HistoryView({ snapshot, plantFilter, onAction, notify }: Pick<SharedProps, "snapshot" | "plantFilter" | "onAction" | "notify">) {
  const [search, setSearch] = useState("");
  const [shift, setShift] = useState("All Shifts");
  const [selectedEntry, setSelectedEntry] = useState<ProductionEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [auditRows, setAuditRows] = useState<Array<{id: number; changed_by: string; changed_at: string; before: Record<string, unknown>; after: Record<string, unknown>}>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  useEffect(() => {
    if (!selectedEntry || editingEntry) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- expose loading state while the audit request is in flight.
    setAuditLoading(true);
    fetch(`/api/operations?auditEntryId=${selectedEntry.id}`)
      .then(async (response) => {
        const data = await response.json() as { audit?: typeof auditRows; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load audit history");
        if (!cancelled) setAuditRows(data.audit ?? []);
      })
      .catch(() => { if (!cancelled) setAuditRows([]); })
      .finally(() => { if (!cancelled) setAuditLoading(false); });
    return () => { cancelled = true; };
  }, [selectedEntry?.id, editingEntry]);
  const entries = snapshot.entries.filter((entry) => {
    const matchesPlant = plantFilter === "All Plants" || entry.plant === plantFilter;
    const matchesShift = shift === "All Shifts" || entry.shift === shift;
    const query = search.trim().toLowerCase();
    return matchesPlant && matchesShift && (!query || `${entry.entry_code} ${entry.operator_name} ${entry.machine_no} ${entry.product} ${entry.mold_no} ${entry.colour} ${entry.batch_no}`.toLowerCase().includes(query));
  });

  function beginEdit(entry: ProductionEntry) {
    setEditForm({
      colour: entry.colour ?? "",
      batchNo: entry.batch_no ?? "",
      shotCount: String(entry.shot_count ?? 0),
      actualWeightGrams: String(entry.actual_weight_grams ?? 0),
      runningCavities: String(entry.running_cavities ?? 0),
      operatorHours: String(entry.operator_hours ?? 8),
      okQty: String(entry.ok_qty ?? 0),
      rejectionQty: String(entry.rejection_qty ?? 0),
      scrapQty: String(entry.scrap_qty ?? 0),
      downtimeMinutes: String(entry.downtime_minutes ?? 0),
      downtimeReason: entry.downtime_reason ?? "",
      remarks: entry.remarks ?? "",
      compoundReceivedKg: String(entry.compound_received_kg ?? 0),
      compoundUsedKg: String(entry.compound_used_kg ?? 0),
      compoundBalanceKg: String(entry.compound_balance_kg ?? 0),
    });
    setEditingEntry(true);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!selectedEntry) return;
    setSavingEdit(true);
    try {
      await onAction({ action: "updateProductionEntry", entryId: selectedEntry.id, ...editForm });
      notify(`Production entry ${selectedEntry.entry_code} updated. Reports will use the corrected saved values.`);
      setEditingEntry(false);
      setSelectedEntry(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update production entry");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Traceability" title="Production history" description="Review kiosk submissions, quantities, rejection, batch details and sync source." />
      <section className="panel data-panel">
        <div className="table-toolbar"><label className="search-control"><Search size={16} /><input placeholder="Search entry, operator, product, mold, colour or batch" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="small-select"><ListFilter size={15} /><select value={shift} onChange={(event) => setShift(event.target.value)}><option>All Shifts</option>{SHIFTS.map((item) => <option key={item}>{item}</option>)}</select></label><span>{entries.length} entries</span></div>
        {entries.length ? <div className="data-table history-table" role="table" aria-label="Production history"><div className="data-table-head" role="row"><span>Entry</span><span>Date & time</span><span>Plant / Machine</span><span>Operator</span><span>Product / Batch</span><span>OK</span><span>Rejected</span><span>Hours</span><span>Source</span></div>{entries.map((entry) => <button className="data-table-row clickable" role="row" type="button" key={entry.id} onClick={() => setSelectedEntry(entry)}><span className="strong-cell"><History size={15} />{entry.entry_code}</span><span>{formatDate(entry.created_at, true)}</span><span>{entry.plant} · {entry.machine_no}</span><span>{entry.operator_name}</span><span>{entry.product}<small>{entry.colour ? `${entry.colour} · ` : ""}Batch {entry.batch_no}</small></span><span className="positive-number">{formatNumber(entry.ok_qty)}</span><span className={entry.rejection_qty > 0 ? "negative-number" : "positive-number"}>{entry.rejection_qty}</span><span>{Number(entry.operator_hours ?? 8).toFixed(2)} h</span><span><i className="source-badge">{entry.synced_from}</i></span></button>)}</div> : <EmptyState title="No matching entries" detail="Try a different operator, batch, shift or plant filter." />}
      </section>
      {selectedEntry ? <Modal title={selectedEntry.entry_code} onClose={() => setSelectedEntry(null)} wide><div className="entry-detail"><div className="entry-hero"><CheckCircle2 size={30} /><div><strong>Production entry synced</strong><span>{formatDate(selectedEntry.created_at, true)} · {selectedEntry.synced_from}</span></div></div><div className="detail-grid four"><div><small>Plant / Machine</small><strong>{selectedEntry.plant} · {selectedEntry.machine_no}</strong></div><div><small>Operator</small><strong>{selectedEntry.operator_name}</strong></div><div><small>Shift</small><strong>{selectedEntry.shift}</strong></div><div><small>Product</small><strong>{selectedEntry.product}</strong></div><div><small>Mold number</small><strong>{selectedEntry.mold_no}</strong></div><div><small>Colour</small><strong>{selectedEntry.colour || "Not specified"}</strong></div><div><small>Rubber Compound</small><strong>{selectedEntry.rubber_compound || "Not mapped"}</strong></div><div><small>Compound Received / Used / Balance</small><strong>{selectedEntry.compound_received_kg ?? 0} / {selectedEntry.compound_used_kg ?? 0} / {selectedEntry.compound_balance_kg ?? 0} kg</strong></div><div><small>Batch number</small><strong>{selectedEntry.batch_no}</strong></div><div><small>Number of shots</small><strong>{formatNumber(selectedEntry.shot_count || 0)}</strong></div><div><small>Actual weight</small><strong>{Number(selectedEntry.actual_weight_grams || 0).toFixed(1)} {selectedEntry.weight_unit === "count" ? "count" : "g"}</strong></div><div><small>Running cavities</small><strong>{formatNumber(selectedEntry.running_cavities || 0)}</strong></div><div><small>Operator hours</small><strong>{Number(selectedEntry.operator_hours ?? 8).toFixed(2)} hours</strong></div><div><small>OK quantity</small><strong className="positive-number">{formatNumber(selectedEntry.ok_qty)}</strong></div><div><small>Rejected / Scrap</small><strong>{selectedEntry.rejection_qty} / {selectedEntry.scrap_qty}</strong></div><div><small>Rejection rate</small><strong>{((Number(selectedEntry.rejection_qty) / Math.max(1, Number(selectedEntry.ok_qty) + Number(selectedEntry.rejection_qty) + Number(selectedEntry.scrap_qty))) * 100).toFixed(1)}%</strong></div><div><small>Downtime</small><strong>{selectedEntry.downtime_minutes} minutes</strong></div><div><small>Reason</small><strong>{selectedEntry.downtime_reason || "None"}</strong></div></div>{selectedEntry.remarks ? <div className="remark-box"><small>Remarks</small><p>{selectedEntry.remarks}</p></div> : null}<section className="remark-box"><small>Correction audit history</small>{auditLoading ? <p>Loading audit records…</p> : auditRows.length ? auditRows.map((audit) => <div key={audit.id} className="audit-record"><p><strong>{audit.changed_by}</strong> · {formatDate(audit.changed_at, true)}</p><ul>{Object.keys(audit.after).filter((key) => JSON.stringify(audit.before[key]) !== JSON.stringify(audit.after[key]) && !["id", "created_at"].includes(key)).map((key) => <li key={key}><strong>{key.replaceAll("_", " ")}:</strong> {String(audit.before[key] ?? "—")} → {String(audit.after[key] ?? "—")}</li>)}</ul></div>) : <p>No corrections have been recorded for this entry.</p>}</section><div className="modal-actions"><button className="secondary-action" type="button" onClick={() => beginEdit(selectedEntry)}><Pencil size={15} /> Edit entry</button></div></div></Modal> : null}
      {selectedEntry && editingEntry ? <Modal title={`Edit ${selectedEntry.entry_code}`} onClose={() => setEditingEntry(false)} wide><form className="form-stack" onSubmit={saveEdit}>
        <p>Corrections are saved to the database and recorded in the audit log with the signed-in supervisor.</p>
        <div className="form-grid two">
          <label className="form-field"><span>Batch number</span><input required value={editForm.batchNo ?? ""} onChange={(e) => setEditForm(v => ({...v,batchNo:e.target.value}))} /></label>
          <label className="form-field"><span>Colour</span><input value={editForm.colour ?? ""} onChange={(e) => setEditForm(v => ({...v,colour:e.target.value}))} /></label>
          <label className="form-field"><span>Shot count</span><input type="number" min="0" step="1" value={editForm.shotCount ?? "0"} onChange={(e) => setEditForm(v => ({...v,shotCount:e.target.value}))} /></label>
          <label className="form-field"><span>Actual weight (g)</span><input type="number" min="0" step="0.1" value={editForm.actualWeightGrams ?? "0"} onChange={(e) => setEditForm(v => ({...v,actualWeightGrams:e.target.value}))} /></label>
          <label className="form-field"><span>Running cavities</span><input type="number" min="0" step="1" value={editForm.runningCavities ?? "0"} onChange={(e) => setEditForm(v => ({...v,runningCavities:e.target.value}))} /></label>
          <label className="form-field"><span>Operator hours</span><input type="number" min="0" max="24" step="0.25" value={editForm.operatorHours ?? "8"} onChange={(e) => setEditForm(v => ({...v,operatorHours:e.target.value}))} /></label>
          <label className="form-field"><span>OK quantity</span><input type="number" min="0" step="1" value={editForm.okQty ?? "0"} onChange={(e) => setEditForm(v => ({...v,okQty:e.target.value}))} /></label>
          <label className="form-field"><span>Rejected quantity</span><input type="number" min="0" step="1" value={editForm.rejectionQty ?? "0"} onChange={(e) => setEditForm(v => ({...v,rejectionQty:e.target.value}))} /></label>
          <label className="form-field"><span>Scrap quantity</span><input type="number" min="0" step="1" value={editForm.scrapQty ?? "0"} onChange={(e) => setEditForm(v => ({...v,scrapQty:e.target.value}))} /></label>
          <label className="form-field"><span>Downtime (minutes)</span><input type="number" min="0" step="1" value={editForm.downtimeMinutes ?? "0"} onChange={(e) => setEditForm(v => ({...v,downtimeMinutes:e.target.value}))} /></label>
          <label className="form-field"><span>Compound received (kg)</span><input type="number" min="0" step="0.001" value={editForm.compoundReceivedKg ?? "0"} onChange={(e) => setEditForm(v => ({...v,compoundReceivedKg:e.target.value}))} /></label>
          <label className="form-field"><span>Compound used (kg)</span><input type="number" min="0" step="0.001" value={editForm.compoundUsedKg ?? "0"} onChange={(e) => setEditForm(v => ({...v,compoundUsedKg:e.target.value}))} /></label>
          <label className="form-field"><span>Compound balance (kg)</span><input type="number" min="0" step="0.001" value={editForm.compoundBalanceKg ?? "0"} onChange={(e) => setEditForm(v => ({...v,compoundBalanceKg:e.target.value}))} /></label>
          <label className="form-field"><span>Downtime reason</span><input value={editForm.downtimeReason ?? ""} onChange={(e) => setEditForm(v => ({...v,downtimeReason:e.target.value}))} /></label>
        </div>
        <label className="form-field"><span>Remarks</span><textarea rows={3} value={editForm.remarks ?? ""} onChange={(e) => setEditForm(v => ({...v,remarks:e.target.value}))} /></label>
        <div className="modal-actions"><button className="secondary-action" type="button" onClick={() => setEditingEntry(false)}>Cancel</button><button className="primary-action" type="submit" disabled={savingEdit}>{savingEdit ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}Save correction</button></div>
      </form></Modal> : null}
    </div>
  );
}

export function ReportsView({ snapshot, plantFilter }: Pick<SharedProps, "snapshot" | "plantFilter">) {
  const entries = snapshot.entries.filter((entry) => plantFilter === "All Plants" || entry.plant === plantFilter);
  const machines = snapshot.machines.filter((machine) => plantFilter === "All Plants" || machine.plant === plantFilter);
  const output = entries.reduce((sum, entry) => sum + Number(entry.ok_qty), 0);
  const rejected = entries.reduce((sum, entry) => sum + Number(entry.rejection_qty), 0);
  const scrap = entries.reduce((sum, entry) => sum + Number(entry.scrap_qty), 0);
  const downtime = entries.reduce((sum, entry) => sum + Number(entry.downtime_minutes), 0);
  const totalProduced = output + rejected + scrap;
  const qualityRate = totalProduced > 0 ? (output / totalProduced) * 100 : 0;
  const rejectionRate = totalProduced > 0 ? (rejected / totalProduced) * 100 : 0;
  const target = machines.reduce((sum, machine) => sum + Number(machine.target_today), 0) || 1;
  const currentOutput = machines.reduce((sum, machine) => sum + Number(machine.output_today), 0);
  const targetShots = entries.reduce((sum, entry) => {
    const task = snapshot.tasks.find((item) => item.id === entry.task_id);
    const mold = snapshot.molds.find((item) => normalized(item.mold_no) === normalized(entry.mold_no));
    return sum + Number(task?.target_shots ?? mold?.shot_target ?? 0);
  }, 0);
  const actualShots = entries.reduce((sum, entry) => sum + Number(entry.shot_count || 0), 0);
  const plannedMinutes = entries.reduce((sum, entry) => sum + Number(entry.operator_hours ?? 12) * 60, 0);
  const downtimeMinutes = entries.reduce((sum, entry) => sum + Number(entry.downtime_minutes || 0), 0);
  const availability = plannedMinutes > 0 ? Math.min(100, Math.max(0, ((plannedMinutes - downtimeMinutes) / plannedMinutes) * 100)) : 0;
  const performance = targetShots > 0 ? Math.min(100, (actualShots / targetShots) * 100) : 0;
  const quality = totalProduced > 0 ? (output / totalProduced) * 100 : 0;
  const oee = (availability * performance * quality) / 10000;

  const dailyOperatorEfficiency = (() => {
    const grouped = new Map<string, { date: string; operator: string; plant: string; actualShots: number; targetShots: number; entries: number }>();
    for (const entry of entries) {
      const date = String(entry.created_at ?? "").slice(0, 10);
      const operator = String(entry.operator_name ?? "Unknown operator");
      const mold = snapshot.molds.find((item) => normalized(item.mold_no) === normalized(entry.mold_no));
      const task = snapshot.tasks.find((item) => String(item.id) === String(entry.task_id));
      const targetForEntry = Number(task?.target_shots ?? mold?.shot_target ?? 0);
      const key = `${date}|${operator}|${entry.plant}`;
      const current = grouped.get(key) ?? { date, operator, plant: String(entry.plant ?? ""), actualShots: 0, targetShots: 0, entries: 0 };
      current.actualShots += Number(entry.shot_count ?? 0);
      current.targetShots += targetForEntry;
      current.entries += 1;
      grouped.set(key, current);
    }
    return [...grouped.values()].map((row) => ({ ...row, efficiency: row.targetShots > 0 ? row.actualShots / row.targetShots * 100 : null })).sort((a, b) => b.date.localeCompare(a.date) || a.operator.localeCompare(b.operator));
  })();

  const plantData = PLANTS.map((plant) => {
    const plantEntries = entries.filter((entry) => entry.plant === plant);
    return { plant, output: plantEntries.reduce((sum, entry) => sum + Number(entry.ok_qty), 0), rejected: plantEntries.reduce((sum, entry) => sum + Number(entry.rejection_qty), 0) };
  }).filter((row) => plantFilter === "All Plants" || row.plant === plantFilter);
  const maxPlantOutput = Math.max(1, ...plantData.map((row) => row.output));

  const productData = PRODUCTS.map((product) => {
    const productEntries = entries.filter((entry) => entry.product === product);
    const ok = productEntries.reduce((sum, entry) => sum + Number(entry.ok_qty), 0);
    const reject = productEntries.reduce((sum, entry) => sum + Number(entry.rejection_qty), 0);
    return { product, ok, reject, rate: ok + reject ? (ok / (ok + reject)) * 100 : 0 };
  }).filter((row) => row.ok > 0).sort((a, b) => b.ok - a.ok);

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Management intelligence" title="Production reports" description="Measure output, quality, downtime and plant performance from kiosk submissions." action={<a className="primary-action" href={`/api/export?type=entries&format=csv&range=all`}><Download size={17} />Export All CSV</a>} />
      <div className="mini-kpi-grid"><MiniKpi label="Recorded output" value={formatNumber(output)} detail={`${entries.length} production entries`} icon={PackageCheck} tone="green" /><MiniKpi label="Rejection rate" value={`${rejectionRate.toFixed(1)}%`} detail={`${formatNumber(rejected)} rejected / ${formatNumber(totalProduced)} produced`} icon={AlertTriangle} tone="amber" /><MiniKpi label="Target shot achievement" value={`${targetShots > 0 ? ((actualShots / targetShots) * 100).toFixed(1) : "0.0"}%`} detail={`${formatNumber(actualShots)} actual / ${formatNumber(targetShots)} target shots`} icon={Gauge} tone="violet" /><MiniKpi label="OEE" value={`${oee.toFixed(1)}%`} detail={`A ${availability.toFixed(1)}% · P ${performance.toFixed(1)}% · Q ${quality.toFixed(1)}%`} icon={Activity} tone="blue" /><MiniKpi label="First-pass quality" value={`${qualityRate.toFixed(1)}%`} detail={`${formatNumber(output)} good / ${formatNumber(totalProduced)} produced`} icon={ShieldCheck} tone="green" /><MiniKpi label="Average operator efficiency" value={`${dailyOperatorEfficiency.filter((row) => row.efficiency !== null).length ? (dailyOperatorEfficiency.reduce((sum, row) => sum + (row.efficiency ?? 0), 0) / dailyOperatorEfficiency.filter((row) => row.efficiency !== null).length).toFixed(1) : "0.0"}%`} detail="Actual shots ÷ target shots" icon={Gauge} tone="violet" /><MiniKpi label="Downtime" value={`${downtimeMinutes} min`} detail={`${scrap} scrap units recorded`} icon={Clock3} tone="amber" /></div>
      <section className="panel" style={{ overflowX: "auto" }}><div className="panel-title-row"><div><p className="eyebrow">Daily production KPI</p><h2>Operator efficiency by day</h2><p>Efficiency = actual shots ÷ target shots × 100. Target is taken from the assigned task or Mold Master.</p></div><a className="secondary-action" href="/api/export?type=daily_operator_efficiency&format=xlsx&range=all"><Download size={16} />Export daily efficiency</a></div><div className="data-table daily-efficiency-table" role="table" aria-label="Daily operator efficiency"><div className="data-table-head" role="row"><span>Date</span><span>Operator</span><span>Plant</span><span>Entries</span><span>Actual shots</span><span>Target shots</span><span>Efficiency</span></div>{dailyOperatorEfficiency.length ? dailyOperatorEfficiency.map((row) => <div className="data-table-row" role="row" key={`${row.date}-${row.operator}-${row.plant}`}><span>{row.date || "—"}</span><span>{row.operator}</span><span>{row.plant}</span><span>{row.entries}</span><span>{formatNumber(row.actualShots)}</span><span>{formatNumber(row.targetShots)}</span><strong>{row.efficiency === null ? "No target" : `${row.efficiency.toFixed(2)}%`}</strong></div>) : <p className="empty-state">No production entries available for this filter.</p>}</div></section>
      <div className="reports-grid">
        <section className="panel report-chart"><div className="panel-title-row"><div><p className="eyebrow">Plant comparison</p><h2>Accepted output by plant</h2></div><BarChart3 size={19} /></div><div className="horizontal-chart">{plantData.map((row) => <div className="chart-row" key={row.plant}><strong>{row.plant}</strong><span className="chart-track"><span style={{ width: `${Math.max(5, (row.output / maxPlantOutput) * 100)}%` }} /></span><b>{formatNumber(row.output)}</b><small>{row.rejected} rejected</small></div>)}</div></section>
        <section className="panel quality-panel"><div className="panel-title-row"><div><p className="eyebrow">Quality mix</p><h2>Production quality</h2></div><span className="quality-score">{qualityRate.toFixed(1)}%</span></div><div className="quality-ring" style={{ "--quality": `${qualityRate * 3.6}deg` } as CSSProperties}><div><strong>{formatNumber(output)}</strong><span>OK units</span></div></div><div className="quality-legend"><span><i className="good" />Accepted <b>{formatNumber(output)}</b></span><span><i className="reject" />Rejected <b>{formatNumber(rejected)}</b></span><span><i className="scrap" />Scrap <b>{formatNumber(scrap)}</b></span></div></section>
      </div>
    </div>
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV file needs a header and at least one data row");
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function readCsv(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return { name: "", rows: [] as Record<string, string>[] };
  return { name: file.name, rows: parseCsv(await file.text()) };
}


function SupervisorsPanel({
  snapshot,
  onAction,
  notify,
}: Pick<SharedProps, "snapshot" | "onAction" | "notify">) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingSupervisorId, setDeletingSupervisorId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", plant: "Plant 1" });

  async function addSupervisorHandler(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await onAction({ action: "addSupervisor", ...form });
      notify(`${form.name} added as ${form.plant} supervisor`);
      setShowAdd(false);
      setForm({ name: "", plant: "Plant 1" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to add supervisor");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(supervisor: Supervisor) {
    const status = supervisor.status === "Active" ? "Inactive" : "Active";

    try {
      await onAction({
        action: "updateSupervisorStatus",
        supervisorId: supervisor.id,
        status,
      });

      notify(`${supervisor.name} marked ${status.toLowerCase()}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to update supervisor");
    }
  }

  async function deleteSupervisorHandler(supervisor: Supervisor) {
    const confirmed = window.confirm(
      `Delete supervisor ${supervisor.name}? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingSupervisorId(supervisor.id);

    try {
      await onAction({
        action: "deleteSupervisor",
        supervisorId: supervisor.id,
      });

      notify(`${supervisor.name} deleted successfully`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to delete supervisor");
    } finally {
      setDeletingSupervisorId(null);
    }
  }

  return (
    <section className="panel data-panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">Team roster</p>
          <h2>Supervisors by plant</h2>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => setShowAdd(true)}
        >
          <UserPlus size={17} />
          Add supervisor
        </button>
      </div>

      <div className="table-toolbar">
        <span>{snapshot.supervisors.length} supervisors across 3 plants</span>
      </div>

      {PLANTS.map((plant) => {
        const plantSupervisors = snapshot.supervisors.filter(
          (supervisor) => supervisor.plant === plant,
        );

        return (
          <div
            key={plant}
            className="data-table supervisors-table"
            role="table"
            aria-label={`Supervisors for ${plant}`}
          >
            <div className="data-table-head" role="row">
              <span>{plant}</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {plantSupervisors.length ? (
              plantSupervisors.map((supervisor) => (
                <div className="data-table-row" role="row" key={supervisor.id}>
                  <span className="person-cell">
                    <i>
                      {supervisor.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </i>
                    <strong>{supervisor.name}</strong>
                  </span>

                  <span>
                    <i className={`table-status ${statusClass(supervisor.status)}`}>
                      {supervisor.status}
                    </i>
                  </span>

                  <span>
                    <button
                      className="table-action"
                      type="button"
                      disabled={deletingSupervisorId === supervisor.id}
                      onClick={() => void toggleStatus(supervisor)}
                    >
                      {supervisor.status === "Active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      className="table-action"
                      type="button"
                      disabled={deletingSupervisorId === supervisor.id}
                      onClick={() => void deleteSupervisorHandler(supervisor)}
                    >
                      {deletingSupervisorId === supervisor.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <div className="data-table-row" role="row">
                <span>No supervisors added yet</span>
                <span />
                <span />
              </div>
            )}
          </div>
        );
      })}

      {showAdd ? (
        <Modal title="Add supervisor" onClose={() => setShowAdd(false)}>
          <form className="form-stack" onSubmit={addSupervisorHandler}>
            <label className="form-field">
              <span>Full name</span>
              <input
                required
                placeholder="e.g. Rekha Deshpande"
                value={form.name}
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
              />
            </label>

            <label className="form-field">
              <span>Plant</span>
              <select
                value={form.plant}
                onChange={(event) =>
                  setForm((value) => ({ ...value, plant: event.target.value }))
                }
              >
                {PLANTS.map((plant) => (
                  <option key={plant}>{plant}</option>
                ))}
              </select>
            </label>

            <div className="modal-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>

              <button className="primary-action" type="submit" disabled={saving}>
                {saving ? (
                  <RefreshCw className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Add supervisor
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

export function CompanyDataView({ snapshot, onAction, notify }: SharedProps) {
  const [operatorFile, setOperatorFile] = useState({ name: "", rows: [] as Record<string, string>[] });
  const [machineFile, setMachineFile] = useState({ name: "", rows: [] as Record<string, string>[] });
  const [replacementText, setReplacementText] = useState("");
  const [moldFile, setMoldFile] = useState<File | null>(null);
  const [moldImporting, setMoldImporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function importMoldMaster() {
    if (!moldFile) { notify("Choose a Mold Master Excel workbook first"); return; }
    setMoldImporting(true);
    try {
      const form = new FormData(); form.append("file", moldFile);
      const response = await fetch("/api/mold-import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Mold Master upload failed");
      notify(`Mold Master imported: ${result.molds} molds and ${result.parts} parts${result.warnings?.length ? ` · ${result.warnings.join(" ")}` : ""}`);
      setMoldFile(null);
    } catch (error) { notify(error instanceof Error ? error.message : "Mold Master upload failed"); }
    finally { setMoldImporting(false); }
  }

  async function importData() {
    if (replacementText !== "REPLACE") {
      notify("Type REPLACE before replacing master data");
      return;
    }
    setImporting(true);
    try {
      const result = await onAction({
        action: "replaceCompanyData",
        operators: operatorFile.rows,
        machines: machineFile.rows,
      });
      notify(`Imported ${result.operators} operators and ${result.machines} machines`);
      setReplacementText("");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Production setup" title="Company data" description="Replace operator and machine master data used by scheduling, tasks and the Android kiosk." />
      <div className="company-data-grid">
        <section className="panel import-panel"><div className="panel-title-row"><div><p className="eyebrow">Mold and part master</p><h2>Upload Mold Master Excel</h2><p>Upload an .xlsx/.xls workbook containing Part and Mold sheets. Existing mold/part records are updated by key; new records are added.</p></div><FileSpreadsheet size={21} /></div><div className="import-body"><label className={moldFile ? "file-drop ready" : "file-drop"}><UploadCloud size={25} /><strong>Mold Master workbook</strong><span>Excel workbook with Part and Mold sheets</span><input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => setMoldFile(event.target.files?.[0] ?? null)} /><b>{moldFile?.name ?? "Choose Excel file"}</b></label><button className="primary-action" type="button" disabled={!moldFile || moldImporting} onClick={() => void importMoldMaster()}>{moldImporting ? <RefreshCw className="spin" size={17} /> : <UploadCloud size={17} />}Upload Mold Master</button></div></section>
        <section className="panel import-panel">
          <div className="panel-title-row"><div><p className="eyebrow">Master data</p><h2>Replace operators and machines</h2></div><UploadCloud size={21} /></div>
          <div className="import-body">
            <div className="warning-note"><AlertTriangle size={18} /><span>This controlled replacement clears current schedules, tasks and production entries. Download a database backup first.</span></div>
            <div className="file-drop-grid">
              <label className={operatorFile.rows.length ? "file-drop ready" : "file-drop"}>
                <Users size={25} /><strong>Operators CSV</strong><span>employee_code, name, plant, shift, status, skill_level</span>
                <input type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(event).then(setOperatorFile).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not read operators CSV"))} />
                <b>{operatorFile.name || "Choose file"}{operatorFile.rows.length ? ` · ${operatorFile.rows.length} rows` : ""}</b>
              </label>
              <label className={machineFile.rows.length ? "file-drop ready" : "file-drop"}>
                <Factory size={25} /><strong>Machines CSV</strong><span>machine_no, plant, status, product, target_today</span>
                <input type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(event).then(setMachineFile).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not read machines CSV"))} />
                <b>{machineFile.name || "Choose file"}{machineFile.rows.length ? ` · ${machineFile.rows.length} rows` : ""}</b>
              </label>
            </div>
            <label className="form-field"><span>Type REPLACE to confirm</span><input value={replacementText} onChange={(event) => setReplacementText(event.target.value)} placeholder="REPLACE" /></label>
            <button className="primary-action" type="button" disabled={!operatorFile.rows.length || !machineFile.rows.length || importing} onClick={() => void importData()}>{importing ? <RefreshCw className="spin" size={17} /> : <UploadCloud size={17} />}Replace master data</button>
          </div>
        </section>
      </div>
      <SupervisorsPanel snapshot={snapshot} onAction={onAction} notify={notify} />
      <FaceEnrollmentPanel snapshot={snapshot} onAction={onAction} notify={notify} />
    </div>
  );
}

const EXPORT_RANGES: { value: string; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "today", label: "Today's data" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

export function DataExportsView() {
  const exports = [
    { label: "Production entries", type: "entries", detail: "Clean production data with Part Number, Family Number and operator efficiency", ranged: true },
    { label: "Daily operator efficiency", type: "daily_operator_efficiency", detail: "Daily actual shots ÷ target shots × 100 by operator", ranged: true },
    { label: "Production tasks", type: "tasks", detail: "Assignments, targets, operators and completion status", ranged: true },
    { label: "Operators", type: "operators", detail: "Employee codes, shifts, plant and skill level", ranged: false },
    { label: "Machines", type: "machines", detail: "Machine status, products, output and targets", ranged: false },
    { label: "Supervisors", type: "supervisors", detail: "Supervisor names, plant assignment and status", ranged: false },
  ];
  const [ranges, setRanges] = useState<Record<string, string>>({ entries: "all", tasks: "all" });
  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Data protection" title="Backup & exports" description="Download a complete database snapshot or open operational datasets in Excel and CSV tools." />
      <section className="panel backup-callout">
        <span><HardDriveDownload size={28} /></span>
        <div><h2>Full database backup</h2><p>Creates an Excel workbook with separate sheets for users, devices, master data, schedules, tasks and production history.</p></div>
        <a className="primary-action" href="/api/export?type=backup&format=xlsx"><Download size={17} />Download Excel backup</a>
      </section>
      <div className="export-grid">
        {exports.map((item) => {
          const range = ranges[item.type] ?? "all";
          const query = item.ranged ? `&range=${range}` : "";
          return (
            <article className="panel export-card" key={item.type}>
              <span><FileSpreadsheet size={25} /></span>
              <div><h2>{item.label}</h2><p>{item.detail}</p></div>
              {item.ranged ? (
                <label className="small-select"><CalendarDays size={15} /><select value={range} onChange={(event) => setRanges((value) => ({ ...value, [item.type]: event.target.value }))}>{EXPORT_RANGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              ) : null}
              <div><a className="secondary-action" href={`/api/export?type=${item.type}&format=csv${query}`}><Download size={16} />CSV</a><a className="primary-action" href={`/api/export?type=${item.type}&format=xlsx${query}`}><Download size={16} />Excel</a></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function KioskDevicesView({ snapshot, plantFilter, onAction, notify }: SharedProps) {
  const [selectedKiosk, setSelectedKiosk] = useState<Kiosk | null>(null);
  const [syncing, setSyncing] = useState("");
  const [deleting, setDeleting] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regenerating, setRegenerating] = useState("");
  const [registration, setRegistration] = useState({ name: "", plant: "Plant 1" });
  const [registrationCode, setRegistrationCode] = useState("");
  const kiosks = snapshot.kiosks.filter((kiosk) => plantFilter === "All Plants" || kiosk.plant === plantFilter);

  async function sync(kiosk: Kiosk) {
    setSyncing(kiosk.id);
    try {
      await onAction({ action: "syncKiosk", kioskId: kiosk.id });
      notify(`${kiosk.name} is online and fully synced`);
      setSelectedKiosk(null);
    } finally { setSyncing(""); }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setRegistering(true);
    try {
      const result = await onAction({ action: "registerKiosk", ...registration });
      setRegistrationCode(String(result.registrationCode ?? ""));
      notify("Kiosk registration code created");
    } finally { setRegistering(false); }
  }

  async function regenerate(kiosk: Kiosk) {
    if (kiosk.authorization_status === "Authorized") {
      notify("This kiosk is already authorized. Delete it and register a new kiosk if you need a new activation code.");
      return;
    }
    setRegenerating(kiosk.id);
    try {
      const result = await onAction({ action: "regenerateKioskRegistrationCode", kioskId: kiosk.id });
      const code = String(result.registrationCode ?? "");
      if (code) {
        setRegistrationCode(code);
        setShowRegister(true);
      }
      notify("A new kiosk activation code was created");
    } finally {
      setRegenerating("");
    }
  }

  async function remove(kiosk: Kiosk) {
    if (!window.confirm(`Delete ${kiosk.name}? This immediately revokes this physical kiosk and cannot be undone.`)) return;
    setDeleting(kiosk.id);
    try {
      await onAction({ action: "deleteKiosk", kioskId: kiosk.id });
      notify(`${kiosk.name} was deleted and its access was revoked`);
      setSelectedKiosk(null);
    } finally {
      setDeleting("");
    }
  }

  return (
    <div className="view-stack">
      <ModuleHeader eyebrow="Device management" title="Kiosk devices" description="Register each physical machine, monitor authorization, offline queues and plant synchronization tests." action={<button className="primary-action" type="button" onClick={() => { setShowRegister(true); setRegistrationCode(""); }}><Plus size={17} />Register kiosk</button>} />
      <div className="kiosk-device-grid">
        {kiosks.map((kiosk) => <article className={`kiosk-device-card ${kiosk.status.toLowerCase()}`} key={kiosk.id}><div className="kiosk-device-visual"><TabletSmartphone size={42} /><span className="device-screen">VC</span><i /></div><div className="kiosk-device-title"><div><p>{kiosk.id}</p><h2>{kiosk.name}</h2></div><span className={kiosk.status.toLowerCase()}>{kiosk.status === "Online" ? <Wifi size={15} /> : <WifiOff size={15} />}{kiosk.status}</span></div><div className="device-stats"><div><small>Authorization</small><strong>{kiosk.authorization_status}</strong></div><div><small>Activation code</small><strong className={kiosk.registration_code ? "negative-number" : "positive-number"}>{kiosk.registration_code ?? "Used"}</strong></div><div><small>Offline queue</small><strong className={kiosk.pending_sync ? "negative-number" : "positive-number"}>{kiosk.pending_sync} entries</strong></div><div><small>Offline test</small><strong className={kiosk.offline_test_status === "Passed" ? "positive-number" : "negative-number"}>{kiosk.offline_test_status}</strong></div></div><div className="device-actions"><button className="secondary-action" type="button" onClick={() => setSelectedKiosk(kiosk)}>Diagnostics</button>{kiosk.authorization_status !== "Authorized" ? <button className="secondary-action" type="button" onClick={() => void regenerate(kiosk)} disabled={regenerating === kiosk.id}>{regenerating === kiosk.id ? <RefreshCw className="spin" size={16} /> : <KeyRound size={16} />}New code</button> : null}<button className="primary-action" type="button" onClick={() => void sync(kiosk)} disabled={syncing === kiosk.id || kiosk.authorization_status !== "Authorized"}>{syncing === kiosk.id ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />}Sync now</button></div></article>)}
      </div>
      <section className="panel offline-explainer"><span><ShieldCheck size={24} /></span><div><h2>Offline-first protection is active</h2><p>Every kiosk saves production entries on the device first. If the connection drops, entries remain in the local queue and sync automatically when the kiosk reconnects.</p></div><b>{snapshot.kiosks.reduce((sum, kiosk) => sum + Number(kiosk.pending_sync), 0)} pending</b></section>
      {selectedKiosk ? <Modal title={`${selectedKiosk.name} diagnostics`} onClose={() => setSelectedKiosk(null)}><div className="diagnostics-list"><div><span><CircleDot size={17} />Device ID</span><strong>{selectedKiosk.id}</strong></div><div><span><KeyRound size={17} />Authorization</span><strong>{selectedKiosk.authorization_status}</strong></div><div><span><KeyRound size={17} />Activation code</span><strong>{selectedKiosk.registration_code ?? "Used after authorization"}</strong></div><div><span><Wifi size={17} />Connection</span><strong className={selectedKiosk.status === "Online" ? "positive-number" : "negative-number"}>{selectedKiosk.status}</strong></div><div><span><Clock3 size={17} />Last contact</span><strong>{formatDate(selectedKiosk.last_seen, true)}</strong></div><div><span><FileClock size={17} />Pending records</span><strong>{selectedKiosk.pending_sync}</strong></div><div><span><ShieldCheck size={17} />Last offline test</span><strong>{selectedKiosk.last_offline_test ? `${selectedKiosk.offline_test_status} · ${formatDate(selectedKiosk.last_offline_test, true)}` : "Not tested in plant"}</strong></div></div><div className="device-modal-actions"><button className="danger-action" type="button" disabled={deleting === selectedKiosk.id} onClick={() => void remove(selectedKiosk)}>{deleting === selectedKiosk.id ? <RefreshCw className="spin" size={16} /> : <Trash2 size={16} />}Delete device</button><button className="primary-action" type="button" disabled={selectedKiosk.authorization_status !== "Authorized"} onClick={() => void sync(selectedKiosk)}><RefreshCw size={16} />Run synchronization</button></div></Modal> : null}
      {showRegister ? <Modal title="Register a physical kiosk" onClose={() => setShowRegister(false)}>{registrationCode ? <div className="registration-success"><BadgeCheck size={36} /><p className="eyebrow">One-time activation code</p><strong>{registrationCode}</strong><p>Open the <b>Vibes Operator Kiosk</b> page or Android app on the physical machine and enter this code. It expires after first use.</p><a className="secondary-action" href="/kiosk" target="_blank" rel="noreferrer">Open operator site</a><button className="primary-action full" type="button" onClick={() => setShowRegister(false)}>Done</button></div> : <form className="modal-form" onSubmit={register}><label className="form-field"><span>Device name</span><input required placeholder="e.g. Plant 1 Main Kiosk" value={registration.name} onChange={(event) => setRegistration((value) => ({ ...value, name: event.target.value }))} /></label><label className="form-field"><span>Authorized plant</span><select value={registration.plant} onChange={(event) => setRegistration((value) => ({ ...value, plant: event.target.value }))}>{PLANTS.map((plant) => <option key={plant}>{plant}</option>)}</select></label><button className="primary-action full" disabled={registering}>{registering ? <RefreshCw className="spin" size={17} /> : <KeyRound size={17} />}Create activation code</button></form>}</Modal> : null}
    </div>
  );
}

type KioskForm = {
  taskId: string;
  machineId: string;
  product: string;
  moldNo: string;
  colour: string;
  rubberCompound: string;
  compoundReceivedKg: string;
  compoundUsedKg: string;
  compoundBalanceKg: string;
  batchNo: string;
  shotCount: string;
  actualWeightGrams: string;
  okQty: string;
  rejectionQty: string;
  scrapQty: string;
  downtimeMinutes: string;
  downtimeReason: string;
  remarks: string;
};

type QueuedEntry = Record<string, unknown>;

function readOfflineQueue(): QueuedEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem("vibes-kiosk-offline-queue") ?? "[]") as QueuedEntry[]; }
  catch { return []; }
}

function createClientRef() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function OperatorKioskView({
  snapshot,
  onAction,
  notify,
  onExit,
  deviceName = "Authorized kiosk",
  onOfflineTest,
}: SharedProps & { onExit?: () => void; deviceName?: string; onOfflineTest?: () => void }) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [operator, setOperator] = useState<Operator | null>(null);
  const [identifyError, setIdentifyError] = useState("");
  const [form, setForm] = useState<KioskForm>({ taskId: "", machineId: "", product: "", moldNo: "", colour: "", rubberCompound: "", compoundReceivedKg: "", compoundUsedKg: "", compoundBalanceKg: "", batchNo: "", shotCount: "", actualWeightGrams: "", okQty: "", rejectionQty: "0", scrapQty: "0", downtimeMinutes: "0", downtimeReason: "", remarks: "" });
  const [submitting, setSubmitting] = useState(false);
  const [successCode, setSuccessCode] = useState("");
  const [offlineQueue, setOfflineQueue] = useState<QueuedEntry[]>(readOfflineQueue);
  const [syncing, setSyncing] = useState(false);

  const selectedMold: MoldMaster | undefined = snapshot.molds.find((mold) => normalized(mold.mold_no) === normalized(form.moldNo));
  useEffect(() => {
    const balance = Math.max(0, (Number(form.compoundReceivedKg) || 0) - (Number(form.compoundUsedKg) || 0));
    const next = (form.compoundReceivedKg || form.compoundUsedKg) ? String(balance) : "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the persisted form field synchronized with the derived balance.
    setForm((current) => current.compoundBalanceKg === next ? current : { ...current, compoundBalanceKg: next });
  }, [form.compoundReceivedKg, form.compoundUsedKg]);
  const moldProducts: PartMaster[] = selectedMold
    ? snapshot.parts.filter((part) => normalized(part.family) === normalized(selectedMold.family))
    : [];
  const moldCompoundOptions = Array.from(new Set(moldProducts.map((part) => partCompound(part)).filter(Boolean)));

  useEffect(() => {
    const product = snapshot.parts.find((part) => normalized(part.part_no) === normalized(form.product));
    const compound = partCompound(product) || (moldCompoundOptions.length === 1 ? moldCompoundOptions[0] : "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-fill compound when the selected part or mold master changes.
    setForm((current) => current.rubberCompound === compound ? current : { ...current, rubberCompound: compound });
  }, [form.product, snapshot.parts, moldCompoundOptions.join("|")]);
  const suggestedMolds = useMemo(() => {
    const query = normalized(form.moldNo);
    const unique = new Map<string, MoldMaster>();
    snapshot.molds.forEach((mold) => {
      const key = normalized(mold.mold_no);
      if (!key || unique.has(key)) return;
      if (!query || key.includes(query)) unique.set(key, mold);
    });
    return Array.from(unique.values());
  }, [form.moldNo, snapshot.molds]);

  function handleMoldChange(moldNo: string) {
    const exactMold = snapshot.molds.find((mold) => normalized(mold.mold_no) === normalized(moldNo));
    if (!exactMold) {
      setForm((value) => ({ ...value, moldNo }));
      return;
    }
    const products = snapshot.parts.filter((part) => normalized(part.family) === normalized(exactMold.family));
    const currentProductStillValid = products.some((part) => normalized(part.part_no) === normalized(form.product));
    setForm((value) => ({
      ...value,
      moldNo: exactMold.mold_no,
      product: currentProductStillValid ? value.product : products.length === 1 ? products[0].part_no : "",
      colour: currentProductStillValid ? partColour(products.find((part) => normalized(part.part_no) === normalized(value.product))) : products.length === 1 ? partColour(products[0]) : "",
      rubberCompound: currentProductStillValid ? partCompound(products.find((part) => normalized(part.part_no) === normalized(value.product))) : products.length === 1 ? partCompound(products[0]) : Array.from(new Set(products.map((part) => partCompound(part)).filter(Boolean))).length === 1 ? partCompound(products[0]) : "",
    }));
  }

  const operatorSchedules = operator ? snapshot.schedules.filter((schedule) => sameId(schedule.operator_id, operator.id)) : [];
  const operatorTasks = operator ? snapshot.tasks.filter((task) => taskBelongsToOperator(task, operator) && normalized(task.status) !== "completed") : [];
  const operatorMachines = operator ? snapshot.machines.filter((machine) => machine.plant === operator.plant) : snapshot.machines;

  function identifyOperator(event: FormEvent) {
    event.preventDefault();
    const match = snapshot.operators.find((item) => item.employee_code.toLowerCase() === employeeCode.trim().toLowerCase());
    if (!match) { setIdentifyError("Employee ID not found. Ask your supervisor to check the operator record."); return; }
    const schedule = snapshot.schedules.find((item) => sameId(item.operator_id, match.id));
    const task = snapshot.tasks.find((item) => taskBelongsToOperator(item, match) && normalized(item.status) !== "completed");
    const machine = snapshot.machines.find((item) => sameId(item.id, schedule?.machine_id));
    setOperator(match);
    setIdentifyError("");
    setForm((value) => ({
      ...value,
      taskId: task?.id ?? "",
      machineId: task?.machine_id ?? schedule?.machine_id ?? "",
      product: task?.product ?? schedule?.product ?? machine?.product ?? "",
      moldNo: task?.mold_no ?? "",
      colour: partColour(snapshot.parts.find((part) => normalized(part.part_no) === normalized(task?.product ?? schedule?.product ?? machine?.product))),
    }));
  }

  function persistQueue(queue: QueuedEntry[]) {
    setOfflineQueue(queue);
    window.localStorage.setItem("vibes-kiosk-offline-queue", JSON.stringify(queue));
  }

  function resetEntry() {
    setSuccessCode("");
    setOperator(null);
    setEmployeeCode("");
    setForm({ taskId: "", machineId: "", product: "", moldNo: "", colour: "", rubberCompound: "", compoundReceivedKg: "", compoundUsedKg: "", compoundBalanceKg: "", batchNo: "", shotCount: "", actualWeightGrams: "", okQty: "", rejectionQty: "0", scrapQty: "0", downtimeMinutes: "0", downtimeReason: "", remarks: "" });
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    if (!operator) return;
    const machine = snapshot.machines.find((item) => sameId(item.id, form.machineId));
    if (!machine) return;
    const schedule = snapshot.schedules.find((item) => sameId(item.operator_id, operator.id) && sameId(item.machine_id, machine.id));
    const payload: QueuedEntry = {
      action: "createEntry",
      clientRef: createClientRef(),
      taskId: form.taskId || null,
      plant: machine.plant,
      machineId: machine.id,
      operatorId: operator.id,
      scheduleId: schedule?.id ?? null,
      shift: schedule?.shift ?? operator.shift,
      product: form.product,
      moldNo: form.moldNo,
      colour: form.colour || partColour(snapshot.parts.find((part) => normalized(part.part_no) === normalized(form.product))),
      rubberCompound: form.rubberCompound || partCompound(snapshot.parts.find((part) => normalized(part.part_no) === normalized(form.product))),
      compoundReceivedKg: Number(form.compoundReceivedKg) || 0,
      compoundUsedKg: Number(form.compoundUsedKg) || 0,
      compoundBalanceKg: Math.max(0, (Number(form.compoundReceivedKg) || 0) - (Number(form.compoundUsedKg) || 0)),
      batchNo: form.batchNo,
      shotCount: Number(form.shotCount),
      actualWeightGrams: Number(form.actualWeightGrams),
      okQty: Number(form.okQty),
      rejectionQty: Number(form.rejectionQty),
      scrapQty: Number(form.scrapQty),
      downtimeMinutes: Number(form.downtimeMinutes),
      downtimeReason: form.downtimeReason,
      remarks: form.remarks,
      syncedFrom: "Kiosk",
    };
    setSubmitting(true);
    try {
      const result = await onAction(payload);
      setSuccessCode(String(result.entryCode ?? "Saved"));
      notify("Production entry saved to the central database");
    } catch {
      persistQueue([...offlineQueue, payload]);
      setSuccessCode("Saved offline");
      notify("Connection unavailable. Entry saved safely on this kiosk.");
    } finally { setSubmitting(false); }
  }

  async function syncQueue() {
    if (!offlineQueue.length) return;
    setSyncing(true);
    const remaining: QueuedEntry[] = [];
    for (const entry of offlineQueue) {
      try { await onAction(entry); } catch { remaining.push(entry); }
    }
    persistQueue(remaining);
    notify(remaining.length ? `${remaining.length} entries are still waiting for connection` : "Offline queue synchronized successfully");
    setSyncing(false);
  }

  if (successCode) {
    return <div className="kiosk-mode"><header className="kiosk-header"><div className="kiosk-brand"><span>VC</span><div><strong>Vibes Components</strong><small>{deviceName}</small></div></div><div className="kiosk-header-actions"><span className="kiosk-online"><Wifi size={18} />Connected</span>{onExit ? <button type="button" className="exit-kiosk" onClick={onExit}><ArrowLeft size={18} />Management</button> : null}</div></header><main className="kiosk-success"><span className="success-circle"><Check size={42} /></span><p className="eyebrow">Entry complete</p><h1>{successCode === "Saved offline" ? "Entry saved safely offline" : "Production entry submitted"}</h1><p>{successCode === "Saved offline" ? "The kiosk will automatically sync this entry when the connection returns." : <>Reference <strong>{successCode}</strong> is now visible in History and Reports.</>}</p><button className="kiosk-primary" type="button" onClick={resetEntry}>Start next entry <ChevronRight size={22} /></button></main></div>;
  }

  return (
    <div className="kiosk-mode">
      <header className="kiosk-header"><div className="kiosk-brand"><span>VC</span><div><strong>Vibes Components</strong><small>{deviceName}</small></div></div><div className="kiosk-header-actions"><button type="button" className="queue-button" onClick={() => void syncQueue()} disabled={!offlineQueue.length || syncing}>{syncing ? <RefreshCw className="spin" size={18} /> : <RefreshCw size={18} />}Sync queue <b>{offlineQueue.length}</b></button>{onOfflineTest ? <button type="button" className="queue-button" onClick={onOfflineTest}><ShieldCheck size={18} />Test offline sync</button> : null}<span className="kiosk-online"><Wifi size={18} />Connected</span>{onExit ? <button type="button" className="exit-kiosk" onClick={onExit}><ArrowLeft size={18} />Management</button> : null}</div></header>
      <main className="kiosk-content">
        {!operator ? <section className="identify-card"><span className="scan-visual"><ScanLine size={46} /></span><p className="eyebrow">Step 1 of 2</p><h1>Scan your operator ID</h1><p>Use the kiosk scanner, or enter the employee code printed below the QR code.</p><form onSubmit={identifyOperator}><label><ScanLine size={24} /><input autoFocus placeholder="Scan or enter employee ID" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} /></label><button className="kiosk-primary" type="submit">Continue <ChevronRight size={23} /></button></form>{identifyError ? <span className="kiosk-error"><AlertTriangle size={18} />{identifyError}</span> : null}</section> : <section className="kiosk-entry-layout"><aside className="operator-confirm"><span className="operator-avatar">{operator.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><p className="eyebrow">Operator confirmed</p><h2>{operator.name}</h2><span>{operator.employee_code}</span><div><small>Plant</small><strong>{operator.plant}</strong><small>Scheduled shift</small><strong>{operator.shift}</strong><small>Skill level</small><strong>{operator.skill_level}</strong></div>{operatorTasks.length ? <div className="assignment-card"><ClipboardList size={20} /><span><small>Production task</small><strong>{operatorTasks[0].task_code} · {operatorTasks[0].machine_no}</strong></span></div> : operatorSchedules.length ? <div className="assignment-card"><CalendarDays size={20} /><span><small>Assigned today</small><strong>{operatorSchedules[0].machine_no} · {operatorSchedules[0].product}</strong></span></div> : <div className="assignment-card warning"><AlertTriangle size={20} /><span><small>No assigned task</small><strong>Manual entry is available</strong></span></div>}<button type="button" onClick={() => setOperator(null)}>Not you? Scan again</button></aside><form className="kiosk-form" onSubmit={submitEntry}><div className="kiosk-form-title"><div><p className="eyebrow">Step 2 of 2</p><h1>Record production readings</h1></div><span>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())}</span></div>{operatorTasks.length ? <label className="form-field task-picker"><span>Assigned production task</span><select value={form.taskId} onChange={(event) => {
          const task = snapshot.tasks.find((item) => item.id === event.target.value); const taskProduct = snapshot.parts.find((part) => normalized(part.part_no) === normalized(task?.product));
          setForm((value) => ({ ...value, taskId: event.target.value, machineId: task?.machine_id ?? "", product: task?.product ?? "", moldNo: task?.mold_no ?? "", colour: partColour(taskProduct) }));
        }}><option value="">Manual entry without task</option>{operatorTasks.map((task) => <option value={task.id} key={task.id}>{task.task_code} · {task.machine_no} · {task.product}</option>)}</select></label> : null}<div className="kiosk-form-grid"><label className="form-field"><span>Supervisor</span><input readOnly value={operatorTasks.find((task) => task.id === form.taskId)?.supervisor_name ?? "Not assigned"} /></label><label className="form-field"><span>Machine</span><select required value={form.machineId} onChange={(event) => {
          const machine = snapshot.machines.find((item) => sameId(item.id, event.target.value)); const machineProduct = snapshot.parts.find((part) => normalized(part.part_no) === normalized(machine?.product));
          setForm((value) => ({ ...value, taskId: "", machineId: event.target.value, product: machine?.product ?? value.product, moldNo: "", colour: partColour(machineProduct) }));
        }}><option value="">Select machine</option>{operatorMachines.map((machine) => <option value={machine.id} key={machine.id}>{machine.machine_no} · {machine.status}</option>)}</select></label><label className="form-field"><span>Product</span>{moldProducts.length > 1 ? <select required value={form.product} onChange={(event) => { const product = moldProducts.find((part) => normalized(part.part_no) === normalized(event.target.value)); setForm((value) => ({ ...value, product: event.target.value, colour: partColour(product), rubberCompound: partCompound(product) })); }}><option value="">Select product</option>{moldProducts.map((part) => <option key={part.id} value={part.part_no}>{part.part_no}{part.description ? ` · ${part.description}` : ""}</option>)}</select> : <input required readOnly={moldProducts.length === 1} placeholder={selectedMold ? "Select a product for this mold family" : "Select mold first"} value={form.product} onChange={(event) => setForm((value) => ({ ...value, product: event.target.value, colour: partColour(snapshot.parts.find((part) => normalized(part.part_no) === normalized(event.target.value))) }))} />}{selectedMold && <small className="field-hint">Family: {selectedMold.family}{moldProducts.length ? ` · ${moldProducts.length} product${moldProducts.length === 1 ? "" : "s"} available` : " · No matching part records"}</small>}</label><label className="form-field"><span>Colour</span><input readOnly value={form.colour || "Auto from product"} placeholder="Auto from product" /></label><label className="form-field"><span>Rubber Compound</span><input readOnly value={form.rubberCompound || (selectedMold ? "Select product first" : "Auto from mold/product")} placeholder="Auto from mold/product" /></label><label className="form-field"><span>Compound Received (kg)</span><input type="number" min="0" step="0.001" value={form.compoundReceivedKg} onChange={(event) => setForm((value) => ({ ...value, compoundReceivedKg: event.target.value }))} /></label><label className="form-field"><span>Compound Used (kg)</span><input type="number" min="0" step="0.001" value={form.compoundUsedKg} onChange={(event) => setForm((value) => ({ ...value, compoundUsedKg: event.target.value }))} /></label><label className="form-field"><span>Compound Balance (kg)</span><input readOnly value={form.compoundBalanceKg || "0"} /></label><label className="form-field"><span>Mold number</span><input required list="kiosk-mold-suggestions" placeholder="Search or enter mold number" value={form.moldNo} onChange={(event) => handleMoldChange(event.target.value)} /><datalist id="kiosk-mold-suggestions">{suggestedMolds.map((mold) => <option key={mold.id} value={mold.mold_no}>{mold.family}{mold.plant ? ` · ${mold.plant}` : ""}</option>)}</datalist>{selectedMold && <small className="field-hint">{selectedMold.family}{selectedMold.vibes_description ? ` · ${selectedMold.vibes_description}` : ""}{selectedMold.cavities ? ` · ${selectedMold.cavities} cavities` : ""}</small>}</label><label className="form-field"><span>Batch number</span><input required placeholder="e.g. B-24019" value={form.batchNo} onChange={(event) => setForm((value) => ({ ...value, batchNo: event.target.value }))} /></label></div><div className="quantity-section"><h2>Production readings</h2><div className="kiosk-form-grid task-readings"><label className="quantity-field shots"><span>Number of shots</span><input type="number" required min="0" placeholder="0" value={form.shotCount} onChange={(event) => setForm((value) => ({ ...value, shotCount: event.target.value }))} /></label><label className="quantity-field weight"><span>Actual weight (grams)</span><input type="number" required min="0" step="0.01" placeholder="0" value={form.actualWeightGrams} onChange={(event) => setForm((value) => ({ ...value, actualWeightGrams: event.target.value }))} /></label></div><h2>Production quantities</h2><div className="kiosk-form-grid three"><label className="quantity-field good"><span>OK quantity</span><input type="number" required min="0" placeholder="0" value={form.okQty} onChange={(event) => setForm((value) => ({ ...value, okQty: event.target.value }))} /></label><label className="quantity-field reject"><span>Rejected</span><input type="number" required min="0" value={form.rejectionQty} onChange={(event) => setForm((value) => ({ ...value, rejectionQty: event.target.value }))} /></label><label className="quantity-field scrap"><span>Scrap</span><input type="number" required min="0" value={form.scrapQty} onChange={(event) => setForm((value) => ({ ...value, scrapQty: event.target.value }))} /></label></div></div><details className="downtime-details" open={Number(form.downtimeMinutes) > 0}><summary><Clock3 size={20} />Add downtime or remarks <ChevronRight size={18} /></summary><div className="kiosk-form-grid"><label className="form-field"><span>Downtime minutes</span><input type="number" min="0" value={form.downtimeMinutes} onChange={(event) => setForm((value) => ({ ...value, downtimeMinutes: event.target.value }))} /></label><label className="form-field"><span>Downtime reason</span><input placeholder="e.g. Material change" value={form.downtimeReason} onChange={(event) => setForm((value) => ({ ...value, downtimeReason: event.target.value }))} /></label><label className="form-field full"><span>Remarks</span><textarea rows={2} placeholder="Optional note for supervisor or QA" value={form.remarks} onChange={(event) => setForm((value) => ({ ...value, remarks: event.target.value }))} /></label></div></details><button className="kiosk-submit" type="submit" disabled={submitting}>{submitting ? <RefreshCw className="spin" size={23} /> : <CheckCircle2 size={23} />}Submit production entry</button><p className="kiosk-save-note"><ShieldCheck size={17} />Saved locally first and synchronized with the central database.</p></form></section>}
      </main>
    </div>
  );
}
