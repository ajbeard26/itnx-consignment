import HomeScreen from "@/components/HomeScreen";
import { staffAccountStatus } from "@/lib/admin";

export default async function Page() {
  return <HomeScreen mode={await staffAccountStatus()} />;
}
