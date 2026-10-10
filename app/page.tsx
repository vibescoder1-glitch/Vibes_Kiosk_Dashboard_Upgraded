import { LayoutDashboard } from "lucide-react";

export default function Home() {
  return (
    <main className="workspace-portal">
      <section className="portal-hero">
        <span className="portal-logo">VC</span>
        <p className="eyebrow">Factory operations platform</p>
        <h1>Factory operations</h1>
        <p>Supervisors plan work, manage operators and kiosks, and monitor live production. Operators use the separate Android Production Entry app.</p>
      </section>
      <section className="portal-grid">
        <a href="/supervisor/login"><span><LayoutDashboard size={29} /></span><div><small>Company sign-in</small><h2>Supervisor dashboard</h2><p>Scheduling, tasks, monitoring, reports, company data, kiosk registration and backups.</p><b>Supervisor login →</b></div></a>
      </section>
    </main>
  );
}
