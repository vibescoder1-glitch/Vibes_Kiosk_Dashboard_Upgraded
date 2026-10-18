"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Database,
  Factory,
  HardDriveDownload,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  RefreshCw,
  TabletSmartphone,
  UserRoundCheck,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  CompanyDataView,
  DataExportsView,
  HistoryView,
  KioskDevicesView,
  LiveMonitoringView,
  OperatorsView,
  ReportsView,
  SchedulingView,
  TasksView,
  type ActionRunner,
} from "./operation-modules";

export type Operator = {
  id: string;
  employee_code: string;
  name: string;
  plant: string;
  shift: string;
  status: string;
  skill_level: string;
};

export type Supervisor = {
  id: string;
  name: string;
  plant: string;
  status: string;
};

export type Machine = {
  id: string;
  machine_no: string;
  plant: string;
  status: string;
  current_operator_id: string | null;
  product: string;
  output_today: number;
  target_today: number;
  last_updated: string;
};

export type Schedule = {
  id: number;
  schedule_date: string;
  plant: string;
  shift: string;
  machine_id: string;
  machine_no: string;
  operator_id: string;
  operator_name: string;
  product: string;
  target_qty: number;
  status: string;
};

export type ProductionEntry = {
  id: number;
  entry_code: string;
  task_id: string | null;
  plant: string;
  machine_id: string;
  machine_no: string;
  operator_id: string;
  operator_name: string;
  employee_code: string;
  schedule_id: number | null;
  shift: string;
  product: string;
  mold_no: string;
  colour: string;
  rubber_compound: string;
  compound_received_kg: number;
  compound_used_kg: number;
  compound_balance_kg: number;
  batch_no: string;
  shot_count: number;
  actual_weight_grams: number;
  weight_unit: "grams" | "count";
  running_cavities: number;
  operator_hours: number;
  ok_qty: number;
  rejection_qty: number;
  scrap_qty: number;
  downtime_minutes: number;
  downtime_reason: string;
  remarks: string;
  synced_from: string;
  created_at: string;
};

export type ProductionTask = {
  id: string;
  task_code: string;
  title: string;
  plant: string;
  machine_id: string;
  machine_no: string;
  supervisor_name: string;
  operator_id: string | null;
  operator_name: string | null;
  employee_code: string | null;
  shift: string;
  product: string;
  mold_no: string;
  target_shots: number;
  target_weight_grams: number;
  due_date: string;
  priority: string;
  status: string;
  instructions: string;
};

export type Kiosk = {
  id: string;
  name: string;
  plant: string;
  status: string;
  last_seen: string;
  pending_sync: number;
  app_version: string;
  authorization_status: string;
  registration_code: string | null;
  authorized_at: string | null;
  last_offline_test: string | null;
  offline_test_status: string;
};

export type ApplicationUser = {
  email: string;
  login_id: string | null;
  name: string;
  role: "Manager" | "Supervisor";
  plant: string | null;
  active: number;
};

export type MoldMaster = {
  id: number;
  family: string;
  mold_no: string;
  vibes_description: string | null;
  cavities: number | null;
  cycle_time: number | null;
  req_tonn: string | null;
  inspection_time: number | null;
  shot_wt: number | null;
  sheet_wt: number | null;
  flash_wt: number | null;
  shot_target: number | null;
  running_ok_cavities: number | null;
  inspection_target: number | null;
  old_mold_no: string | null;
  manufacturing_year: string | null;
  plant: string | null;
  mold_material: string | null;
};

export type PartMaster = {
  id: number;
  part_no: string;
  family: string;
  description: string | null;
  commodity: string | null;
  insert_part_no: string | null;
  rubber_compound: string | null;
  rejection_allowed: number | null;
  part_weight: number | null;
  inspection: number | null;
  final_inspection_target: number | null;
};

export type FaceEnrollment = {
  operator_id: string;
  employee_code: string;
  name: string;
  plant: string;
  enrolled: number;
  consent_granted: number;
  sample_count: number | null;
  enrolled_at: string | null;
  updated_at: string | null;
};

export type Snapshot = {
  date: string;
  operators: Operator[];
  machines: Machine[];
  supervisors: Supervisor[];
  schedules: Schedule[];
  tasks: ProductionTask[];
  entries: ProductionEntry[];
  kiosks: Kiosk[];
  users: ApplicationUser[];
  faceEnrollments: FaceEnrollment[];
  molds: MoldMaster[];
  parts: PartMaster[];
};

export const EMPTY_SNAPSHOT: Snapshot = {
  date: new Date().toISOString().slice(0, 10),
  operators: [],
  machines: [],
  supervisors: [],
  schedules: [],
  tasks: [],
  entries: [],
  kiosks: [],
  users: [],
  faceEnrollments: [],
  molds: [],
  parts: [],
};

export const PLANTS = ["Plant 1", "Plant 2", "Plant 3"];
export const SHIFTS = ["Morning", "Night"];

async function requestSnapshot(date: string) {
  const response = await fetch(`/api/operations?date=${date}`, { cache: "no-store" });
  const body = (await response.json()) as Snapshot & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not load operations data");
  return body;
}

export type ViewName =
  | "Overview"
  | "Live Monitoring"
  | "Scheduling"
  | "Production Tasks"
  | "Operators"
  | "History"
  | "Reports"
  | "Kiosk Devices"
  | "Company Data"
  | "Backup & Exports";

type NavItem = { label: ViewName; icon: LucideIcon };

const SUPERVISOR_NAV_ITEMS: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Live Monitoring", icon: Activity },
  { label: "Scheduling", icon: CalendarDays },
  { label: "Production Tasks", icon: ClipboardList },
  { label: "Operators", icon: Users },
  { label: "History", icon: History },
  { label: "Reports", icon: BarChart3 },
  { label: "Kiosk Devices", icon: TabletSmartphone },
  { label: "Company Data", icon: Database },
  { label: "Backup & Exports", icon: HardDriveDownload },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value: string | Date, withTime = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  const year = date.getFullYear();
  if (!withTime) return `${day} ${month} ${year}`;
  const hours24 = date.getHours();
  const hours = String(hours24 % 12 || 12).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours24 < 12 ? "am" : "pm";
  return `${day} ${month} ${year}, ${hours}:${minutes} ${period}`;
}

function statusClass(status: string) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function IconTile({ children, tone = "green" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`icon-tile ${tone}`}>{children}</span>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  supporting,
  tone = "green",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  supporting: string;
  tone?: string;
}) {
  return (
    <article className="kpi-card">
      <IconTile tone={tone}><Icon size={23} strokeWidth={1.9} /></IconTile>
      <div>
        <p>{label}</p>
        <strong className={tone === "red" ? "danger-text" : "success-text"}>{value}</strong>
        <span>{supporting}</span>
      </div>
    </article>
  );
}

function PlantMonitoring({ machines, onPlantChange }: { machines: Machine[]; onPlantChange: (plant: string) => void }) {
  return (
    <section className="panel monitoring-panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">Real-time status</p>
          <h2>Live plant monitoring</h2>
        </div>
        <button className="text-button" type="button" onClick={() => onPlantChange("All Plants")}>View all machines</button>
      </div>

      <div className="plant-list">
        {PLANTS.map((plant) => {
          const plantMachines = machines.filter((machine) => machine.plant === plant);
          const running = plantMachines.filter((machine) => machine.status === "Running").length;
          const idle = plantMachines.filter((machine) => machine.status === "Idle").length;
          const attention = plantMachines.length - running - idle;
          const totalOutput = plantMachines.reduce((sum, machine) => sum + Number(machine.output_today), 0);
          const totalTarget = plantMachines.reduce((sum, machine) => sum + Number(machine.target_today), 0) || 1;
          const completion = Math.min(100, Math.round((totalOutput / totalTarget) * 100));
          return (
            <button className="plant-row" key={plant} type="button" onClick={() => onPlantChange(plant)}>
              <span className={`plant-icon ${attention > 2 ? "amber" : ""}`}><Factory size={22} /></span>
              <span className="plant-identity">
                <strong>{plant}</strong>
                <small className={`status-pill ${attention > 2 ? "attention" : "healthy"}`}>
                  <span />{attention > 2 ? "Attention" : "Healthy"}
                </small>
              </span>
              <span className="plant-stat"><i className="dot running" /><strong>{running}</strong><small>Running</small></span>
              <span className="plant-stat"><i className="dot idle" /><strong>{idle}</strong><small>Idle</small></span>
              <span className="plant-stat"><i className="dot maintenance" /><strong>{attention}</strong><small>Attention</small></span>
              <span className="production-meter">
                <small>Output {formatNumber(totalOutput)}</small>
                <span className="meter-track"><span style={{ width: `${completion}%` }} /></span>
                <b>{completion}%</b>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ScheduleSummary({ schedules }: { schedules: Schedule[] }) {
  const times: Record<string, string> = {
    Morning: "08:00 - 08:00",
    Night: "11:00 - 06:00",
  };
  return (
    <section className="panel schedule-panel">
      <div className="panel-title-row">
        <div><p className="eyebrow">18 July plan</p><h2>Today&apos;s schedule</h2></div>
        <CalendarDays size={20} />
      </div>
      <div className="shift-list">
        {SHIFTS.map((shift, index) => {
          const rows = schedules.filter((item) => item.shift === shift);
          const plantsCovered = new Set(rows.map((item) => item.plant)).size;
          const status = shift === "Morning" ? "In Progress" : "Scheduled";
          return (
            <article className={`shift-card shift-${index + 1}`} key={shift}>
              <span className="shift-symbol">{index === 0 ? "☀" : index === 1 ? "◐" : "☾"}</span>
              <div className="shift-info"><strong>{shift} shift</strong><span>{times[shift]}</span></div>
              <div className="shift-data"><small>Assignments</small><b>{rows.length} machines</b></div>
              <div className="shift-data"><small>Coverage</small><b>{plantsCovered}/3 plants</b></div>
              <span className={`status-chip ${statusClass(status)}`}>{status}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function KioskStatus({ kiosks }: { kiosks: Kiosk[] }) {
  return (
    <section className="panel kiosk-panel">
      <div className="panel-title-row">
        <div><p className="eyebrow">Device connectivity</p><h2>Kiosk status</h2></div>
        <span className="live-label"><span /> Live</span>
      </div>
      <div className="kiosk-table" role="table" aria-label="Kiosk device status">
        <div className="kiosk-table-head" role="row"><span>Device</span><span>Connection</span><span>Last sync</span><span>Offline queue</span></div>
        {kiosks.map((kiosk) => (
          <div className="kiosk-table-row" role="row" key={kiosk.id}>
            <span><TabletSmartphone size={18} />{kiosk.name}</span>
            <span className={kiosk.status === "Online" ? "online" : "offline"}>
              {kiosk.status === "Online" ? <Wifi size={16} /> : <WifiOff size={16} />}{kiosk.status}
            </span>
            <span>{formatDate(kiosk.last_seen, true)}</span>
            <b className={kiosk.pending_sync > 0 ? "queue-badge warning" : "queue-badge"}>{kiosk.pending_sync}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({ machines, kiosks }: { machines: Machine[]; kiosks: Kiosk[] }) {
  const alerts = [
    ...machines.filter((machine) => ["Maintenance", "Breakdown"].includes(machine.status)).slice(0, 2).map((machine) => ({
      title: `${machine.plant} · ${machine.machine_no}`,
      detail: machine.status === "Breakdown" ? "Machine breakdown reported" : "Maintenance attention required",
      severity: machine.status === "Breakdown" ? "danger" : "warning",
    })),
    ...kiosks.filter((kiosk) => kiosk.status !== "Online").slice(0, 1).map((kiosk) => ({
      title: kiosk.name,
      detail: `${kiosk.pending_sync} entries waiting to sync`,
      severity: "info",
    })),
  ];

  return (
    <section className="panel alerts-panel">
      <div className="panel-title-row">
        <div><p className="eyebrow">Requires action</p><h2>Alerts</h2></div>
        <button className="text-button" type="button">View history</button>
      </div>
      <div className="alert-list">
        {alerts.length ? alerts.map((alert, index) => (
          <button className="alert-row" type="button" key={`${alert.title}-${index}`}>
            <span className={`alert-icon ${alert.severity}`}><AlertTriangle size={19} /></span>
            <span><strong>{alert.title}</strong><small>{alert.detail}</small></span>
            <span className="alert-time">{index === 0 ? "Now" : `${8 + index * 4}m`}</span>
          </button>
        )) : <div className="empty-state compact"><PackageCheck size={24} /><p>No active alerts</p></div>}
      </div>
    </section>
  );
}

function Overview({
  snapshot,
  plantFilter,
  setPlantFilter,
  setActiveView,
}: {
  snapshot: Snapshot;
  plantFilter: string;
  setPlantFilter: (value: string) => void;
  setActiveView: (value: ViewName) => void;
}) {
  const machines = plantFilter === "All Plants" ? snapshot.machines : snapshot.machines.filter((item) => item.plant === plantFilter);
  const operators = plantFilter === "All Plants" ? snapshot.operators : snapshot.operators.filter((item) => item.plant === plantFilter);
  const kiosks = plantFilter === "All Plants" ? snapshot.kiosks : snapshot.kiosks.filter((item) => item.plant === plantFilter);
  const schedules = plantFilter === "All Plants" ? snapshot.schedules : snapshot.schedules.filter((item) => item.plant === plantFilter);
  const activeOperators = operators.filter((operator) => operator.status === "Active").length;
  const runningMachines = machines.filter((machine) => machine.status === "Running").length;
  const output = machines.reduce((sum, machine) => sum + Number(machine.output_today), 0);
  const alerts = machines.filter((machine) => ["Maintenance", "Breakdown"].includes(machine.status)).length + kiosks.filter((kiosk) => kiosk.status !== "Online").length;

  return (
    <div className="view-stack">
      <div className="page-intro">
        <div><p className="eyebrow">Factory command centre</p><h1>Operations overview</h1><p>Plan work and monitor production, people and kiosk health across all plants.</p></div>
        <a className="primary-action" href="/kiosk"><TabletSmartphone size={18} />Open operator kiosk</a>
      </div>

      <section className="kpi-grid">
        <KpiCard icon={UserRoundCheck} label="Active operators" value={`${activeOperators} / ${operators.length}`} supporting="Available for assigned shifts" />
        <KpiCard icon={Factory} label="Machines running" value={`${runningMachines} / ${machines.length}`} supporting="Live machine availability" />
        <KpiCard icon={PackageCheck} label="Today output" value={formatNumber(output)} supporting="Accepted units recorded" />
        <KpiCard icon={BellRing} label="Alerts" value={String(alerts)} supporting="Requires supervisor attention" tone="red" />
      </section>

      <div className="overview-grid">
        <PlantMonitoring machines={snapshot.machines} onPlantChange={(plant) => { setPlantFilter(plant); setActiveView("Live Monitoring"); }} />
        <ScheduleSummary schedules={schedules} />
        <KioskStatus kiosks={kiosks} />
        <AlertsPanel machines={machines} kiosks={kiosks} />
      </div>
    </div>
  );
}

type OperationsDashboardProps = {
  userName: string;
  userEmail: string;
  signOutPath: string;
};

export default function OperationsDashboard({ userName, userEmail, signOutPath }: OperationsDashboardProps) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [activeView, setActiveView] = useState<ViewName>("Overview");
  const [plantFilter, setPlantFilter] = useState("All Plants");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSnapshot(await requestSnapshot(snapshot.date));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load operations data");
    } finally {
      setLoading(false);
    }
  }, [snapshot.date]);

  useEffect(() => {
    let cancelled = false;
    requestSnapshot(EMPTY_SNAPSHOT.date)
      .then((body) => { if (!cancelled) setSnapshot(body); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load operations data");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Kiosk submissions can happen on another device. Keep the dashboard
  // synchronized with MySQL without requiring a browser refresh.
  const refreshSnapshot = useCallback(async () => {
    try {
      const body = await requestSnapshot(snapshot.date);
      setSnapshot(body);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh operations data");
    }
  }, [snapshot.date]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshSnapshot();
    };
    const intervalId = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshSnapshot]);

  const navItems = SUPERVISOR_NAV_ITEMS;
  const pageTitle = activeView;

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  const runAction = useCallback<ActionRunner>(async (payload) => {
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The operation could not be completed");
    setSnapshot(await requestSnapshot(snapshot.date));
    return result;
  }, [snapshot.date]);

  const changeScheduleDate = useCallback(async (date: string) => {
    setLoading(true);
    setError("");
    try { setSnapshot(await requestSnapshot(date)); }
    catch (dateError) { setError(dateError instanceof Error ? dateError.message : "Could not load the selected date"); }
    finally { setLoading(false); }
  }, []);

  async function submitPasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }
    if (passwordForm.newPassword.length < 10) {
      setPasswordError("New password must contain at least 10 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not change password");
      setToast(result.message ?? "Password changed successfully");
      window.setTimeout(() => window.location.assign("/supervisor/login"), 900);
    } catch (passwordChangeError) {
      setPasswordError(passwordChangeError instanceof Error ? passwordChangeError.message : "Could not change password");
    } finally {
      setChangingPassword(false);
    }
  }

  function activeModule() {
    const shared = { snapshot, plantFilter, onAction: runAction, notify };
    switch (activeView) {
      case "Live Monitoring": return <LiveMonitoringView {...shared} />;
      case "Scheduling": return <SchedulingView {...shared} onDateChange={changeScheduleDate} />;
      case "Production Tasks": return <TasksView {...shared} />;
      case "Operators": return <OperatorsView {...shared} />;
      case "History": return <HistoryView {...shared} />;
      case "Reports": return <ReportsView snapshot={snapshot} plantFilter={plantFilter} />;
      case "Kiosk Devices": return <KioskDevicesView {...shared} />;
      case "Company Data": return <CompanyDataView {...shared} />;
      case "Backup & Exports": return <DataExportsView />;
      default: return <Overview snapshot={snapshot} plantFilter={plantFilter} setPlantFilter={setPlantFilter} setActiveView={setActiveView} />;
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand"><span>VC</span><div><strong>Vibes Components</strong><small>Factory operations</small></div></div>
        <nav aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              className={activeView === label ? "active" : ""}
              type="button"
              key={label}
              onClick={() => { setActiveView(label); setMobileNavOpen(false); }}
            >
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a className="kiosk-link" href="/kiosk" target="_blank" rel="noreferrer"><TabletSmartphone size={19} />Open operator test site</a>
          <div className="user-card"><span>{userName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{userName}</strong><small>Supervisor · {userEmail}</small></div></div>
          <button className="password-link" type="button" onClick={() => { setPasswordError(""); setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setChangePasswordOpen(true); }}><KeyRound size={16} />Change password</button>
          <a className="signout-link" href={signOutPath}><LogOut size={16} />Sign out</a>
        </div>
      </aside>

      {mobileNavOpen ? <button className="nav-scrim" type="button" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} /> : null}

      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Toggle navigation" onClick={() => setMobileNavOpen((value) => !value)}>{mobileNavOpen ? <X /> : <Menu />}</button>
          <div className="topbar-title"><span>{pageTitle}</span><small>Supervisor workspace</small></div>
          <div className="topbar-actions">
            <label className="plant-select">
              <Factory size={16} />
              <select value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} aria-label="Filter by plant">
                <option>All Plants</option>{PLANTS.map((plant) => <option key={plant}>{plant}</option>)}
              </select><ChevronDown size={15} />
            </label>
            <span className="today"><CalendarDays size={17} />{formatDate(new Date())}</span>
            <button className="icon-button" type="button" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={() => { setRefreshing(true); void refreshSnapshot().finally(() => setRefreshing(false)); }}><RefreshCw size={19} className={refreshing ? "spin" : ""} /></button>
            <button className="icon-button" type="button" aria-label="Notifications" onClick={() => setActiveView("Overview")}><BellRing size={19} /><span>{snapshot.kiosks.filter((item) => item.status !== "Online").length || 1}</span></button>
          </div>
        </header>

        <div className="content-canvas">
          {error ? <div className="system-banner"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => void loadData()}>Retry</button></div> : null}
          {loading ? (
            <div className="loading-state"><RefreshCw className="spin" /><strong>Loading plant operations…</strong></div>
          ) : activeModule()}
        </div>
      </main>
      {changePasswordOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setChangePasswordOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Change supervisor password">
            <header><div><p className="eyebrow">Account security</p><h2>Change supervisor password</h2></div><button type="button" aria-label="Close change password" onClick={() => setChangePasswordOpen(false)}><X size={19} /></button></header>
            <div className="modal-body">
              <form className="modal-form" onSubmit={submitPasswordChange}>
                <label className="form-field"><span>Current password</span><input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, currentPassword: event.target.value }))} /></label>
                <label className="form-field"><span>New password</span><input required type="password" minLength={10} autoComplete="new-password" placeholder="At least 10 characters" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, newPassword: event.target.value }))} /></label>
                <label className="form-field"><span>Confirm new password</span><input required type="password" minLength={10} autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, confirmPassword: event.target.value }))} /></label>
                {passwordError ? <div className="login-error">{passwordError}</div> : null}
                <p className="password-security-note">After changing the password, all supervisor sessions will be signed out.</p>
                <button className="primary-action full" disabled={changingPassword}>{changingPassword ? <RefreshCw className="spin" size={17} /> : <KeyRound size={17} />}{changingPassword ? "Changing password…" : "Change password"}</button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
      {toast ? <div className="toast-message"><CheckCircle2 size={18} />{toast}</div> : null}
    </div>
  );
}
