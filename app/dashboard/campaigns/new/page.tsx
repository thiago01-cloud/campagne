import Link from "next/link";
import { redirect } from "next/navigation";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import { EmptyState, PageHeader } from "../../../components/ui";
import CampaignEditor from "../CampaignEditor";
import { editorData } from "../editor-data";

export const metadata = { title: pageTitle("Nouvelle campagne") };

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent || !canWrite(agent)) redirect("/dashboard/campaigns");
  const { list } = await searchParams;
  const { lists, settings } = await editorData(agent);
  return (
    <div>
      <PageHeader title="Nouvelle campagne" subtitle="Rédigez votre message, vérifiez l'aperçu, testez puis lancez." />
      {lists.length === 0 ? (
        <EmptyState title="Aucune liste de contacts" text="Importez d'abord un fichier de contacts." action={<Link className="button" href="/dashboard/lists/new">Importer un fichier</Link>} />
      ) : (
        <CampaignEditor lists={lists} settings={settings} initialListId={list} />
      )}
    </div>
  );
}
