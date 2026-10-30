import { redirect } from "next/navigation";
import { getCurrentAgent, needsPasswordSetup } from "@/lib/auth";
import Sidebar from "./Sidebar";
import ConfirmProvider from "./ConfirmProvider";
import AutoRefresh from "./AutoRefresh";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const agent = await getCurrentAgent();
  // Valid token but account/company deleted or agent blocked in the
  // meantime: clear the cookie (otherwise /login would bounce back here)
  if (!agent) redirect("/api/auth/logout");
  // An invited account must choose its password before anything else
  if (needsPasswordSetup(agent)) redirect("/set-password");

  return (
    <ConfirmProvider>
      <AutoRefresh />
      <ServiceWorkerRegister />
      <div className="dashboard-layout">
        <Sidebar agent={{ fullName: agent.fullName, role: agent.role, displayRole: agent.displayRole, companyName: agent.companyName }} />
        <main className="main-content">{children}</main>
      </div>
    </ConfirmProvider>
  );
}
