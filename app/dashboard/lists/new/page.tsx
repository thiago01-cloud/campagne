import { redirect } from "next/navigation";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { pageTitle } from "@/lib/constants";
import { PageHeader } from "../../../components/ui";
import ImportWizard from "./ImportWizard";

export const metadata = { title: pageTitle("Importer un fichier") };

export default async function NewListPage() {
  const agent = await getCurrentAgent();
  if (!agent || !canWrite(agent)) redirect("/dashboard/lists");
  const s = await getSettings(agent.companyId);
  return (
    <div>
      <PageHeader title="Importer un fichier de contacts" subtitle="CSV ou Excel contenant un tableau avec une ligne d'en-têtes" />
      <ImportWizard settings={{ dialCode: s.dialCode, maxFileMb: s.maxFileMb, maxContacts: s.maxContacts }} />
    </div>
  );
}
