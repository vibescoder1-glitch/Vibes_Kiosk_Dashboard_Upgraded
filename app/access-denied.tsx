import { ShieldX } from "lucide-react";
import Link from "next/link";

export default function AccessDenied({ email, requiredRole, signOutPath }: { email: string; requiredRole: string; signOutPath: string }) {
  return (
    <main className="access-denied-page">
      <section>
        <span><ShieldX size={34} /></span>
        <p className="eyebrow">Authorization required</p>
        <h1>{requiredRole} access has not been granted</h1>
        <p><strong>{email}</strong> is signed in, but this account is not authorized for this workspace. Contact the authorized company supervisor.</p>
        <div><Link className="secondary-action" href="/">Back to portal</Link><a className="primary-action" href={signOutPath}>Sign out</a></div>
      </section>
    </main>
  );
}
