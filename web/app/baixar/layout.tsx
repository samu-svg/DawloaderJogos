import { SiteHeader } from "@/components/site-header";
import { isPortfolioAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/server";

export default async function BaixarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isPortfolioAdmin(user?.email)}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
