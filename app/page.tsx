import { redirect } from "next/navigation";
import { getSessionUser, resolvePostLoginPath } from "@/lib/auth";

export default async function RootPage() {
  const user = await getSessionUser();
  if (user) redirect(await resolvePostLoginPath(user.id));
  redirect("/index.html");
}
