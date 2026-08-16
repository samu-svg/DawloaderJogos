import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/supabase/server";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <>
      <SiteHeader email={user.email} showPainelLink />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
