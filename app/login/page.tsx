import HomeScreen from "@/components/HomeScreen";
import { staffAccountStatus } from "@/lib/admin";
import { safeNextPath } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const q = await searchParams;
  return (
    <HomeScreen
      nextPath={safeNextPath(q.next)}
      mode={await staffAccountStatus()}
      requireSetupToken={process.env.NODE_ENV === "production"}
    />
  );
}
