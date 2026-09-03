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
      <main className="hero-glow relative flex-1">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-10 sm:py-12">
          {children}
        </div>
      </main>
    </>
  );
}
