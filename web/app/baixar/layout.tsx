import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { isPortfolioAdmin } from "@/lib/admin";
import { userHasCatalogAccess } from "@/lib/subscription";
import { currentUser } from "@/lib/supabase/server";

export default async function BaixarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/baixar");

  const isAdmin = isPortfolioAdmin(user.email);
  const hasAccess = await userHasCatalogAccess(user);
  if (!hasAccess) redirect("/assinar?next=/baixar");

  return (
    <>
      <SiteHeader email={user.email} showPainelLink={isAdmin} hasAccess />
      <main className="content-narrow flex-1 px-6 py-8">
        <div className="page-stack">{children}</div>
      </main>
    </>
  );
}
