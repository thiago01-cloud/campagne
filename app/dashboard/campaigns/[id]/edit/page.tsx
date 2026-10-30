import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { canManageItem } from "@/lib/team";
import { pageTitle } from "@/lib/constants";
import { PageHeader } from "../../../../components/ui";
import CampaignEditor, { type InitialCampaign } from "../../CampaignEditor";
import { editorData } from "../../editor-data";

export const metadata = { title: pageTitle("Modifier la campagne") };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c || c.companyId !== agent.companyId) notFound();
  if (c.status !== "DRAFT" || !(await canManageItem(agent, c))) redirect(`/dashboard/campaigns/${id}`);
  const { lists, settings } = await editorData(agent);
  return (
    <div>
      <PageHeader title={`Modifier « ${c.name} »`} subtitle="Brouillon" />
      <CampaignEditor
        lists={lists}
        settings={settings}
        initial={{
          id: c.id,
          name: c.name,
          channel: c.channel as InitialCampaign["channel"],
          listId: c.listId,
          smsMessage: c.smsMessage,
          stopMention: c.stopMention,
          emailSubject: c.emailSubject,
          emailSender: c.emailSender,
          emailBody: c.emailBody,
        }}
      />
    </div>
  );
}
