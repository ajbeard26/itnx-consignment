import Link from "next/link";
import { Building2, Gavel, Mail, MapPinCheck, MessageSquareText, ShieldCheck } from "lucide-react";

export const SETTINGS_TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "deals", label: "Deals", icon: Gavel },
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquareText },
  { id: "address", label: "Address", icon: MapPinCheck },
  { id: "staff", label: "Staff", icon: ShieldCheck },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function settingsTab(value?: string | null): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value) ? (value as SettingsTab) : "company";
}

export default function SettingsTabs({ current }: { current: SettingsTab }) {
  return (
    <nav className="settings-tabs" aria-label="Settings sections">
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link key={tab.id} href={`/settings?tab=${tab.id}`} className={current === tab.id ? "on" : undefined}>
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
