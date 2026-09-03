import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireAppUser } from "@/lib/auth";
import { canAccessPainel } from "@/lib/rbac";
import { userHasCatalogAccess } from "@/lib/subscription";

export default async function BaixarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser({ loginNext: "/baixar" });

  const [isAdmin, hasAccess] = await Promise.all([
    Promise.resolve(canAccessPainel(user.role)),
    userHasCatalogAccess(user),
  ]);
  if (!hasAccess) redirect("/assinar?next=/baixar");

  return (
    <>
      <SiteHeader email={user.email} showPainelLink={isAdmin} hasAccess />
      <main className="content-narrow flex-1 px-6 py-8">
        {children}
      </main>
    </>
  );
}
