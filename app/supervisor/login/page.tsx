import { redirect } from "next/navigation";
import LoginForm from "../../login-form";
import { getCurrentCompanyUser } from "../../../lib/company-auth";

export const dynamic = "force-dynamic";

export default async function SupervisorLoginPage() {
  const user = await getCurrentCompanyUser();
  if (user?.role === "Supervisor") redirect("/supervisor");
  return <LoginForm />;
}
