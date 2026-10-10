import OperationsDashboard from "../operations-dashboard";
import { requireCompanyUser } from "../../lib/company-auth";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
  const user = await requireCompanyUser(
    "Supervisor",
    "/supervisor/login",
  );

  return (
    <OperationsDashboard
      userName={user.name}
      userEmail={user.email}
      signOutPath="/api/auth/logout?returnTo=/supervisor/login"
    />
  );
}