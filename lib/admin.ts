import { db } from "@/lib/db";

export async function staffAccountStatus(): Promise<"setup" | "login" | "offline"> {
  try {
    const count = await db.admin.count();
    return count === 0 ? "setup" : "login";
  } catch {
    return "offline";
  }
}
