import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function requireStaff() {
  const jar = await cookies();
  const ok = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!ok) redirect("/login");
}
