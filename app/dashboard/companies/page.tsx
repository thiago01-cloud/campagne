import { redirect } from "next/navigation";
import { getAccessibleCompanies, getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import CompanyRow from "./CompanyRow";
import CreateCompanyForm from "@/app/create-company/CreateCompanyForm";

export const metadata = { title: pageTitle("Mes entreprises") };

// Every company the account can open (owned, or where it is a member):
// rename/delete the owned ones, switch to any, create a new one — same page
// as TASKS.
export default async function CompaniesPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");

  const companies = await getAccessibleCompanies(agent.userId);
  const sorted = [...companies].sort((a, b) => {
    if (a.role === "OWNER" && b.role !== "OWNER") return -1;
    if (b.role === "OWNER" && a.role !== "OWNER") return 1;
    return a.company.name.localeCompare(b.company.name);
  });

  return (
    <div>
      <div className="page-header">
        <h1>Mes entreprises</h1>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Rôle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <CompanyRow key={item.company.id} company={item.company} role={item.role} isActive={item.company.id === agent.companyId} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Créer une nouvelle entreprise</h3>
        <CreateCompanyForm />
      </div>
    </div>
  );
}
