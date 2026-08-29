import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireAppUser } from "@/lib/auth";
import { canAccessPainel } from "@/lib/rbac";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser();
  if (!canAccessPainel(user.role)) redirect("/baixar");

  return (
    <>
      <SiteHeader email={user.email} showPainelLink hasAccess />
      <main className="content-narrow flex-1 px-6 py-10">{children}</main>
    </>
  );
}
