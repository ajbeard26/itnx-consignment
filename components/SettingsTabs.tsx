import Link from "next/link";

export const SETTINGS_TABS = [
  { id: "company", label: "Company" },
  { id: "deals", label: "Deals" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "address", label: "Address" },
  { id: "staff", label: "Staff" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function settingsTab(value?: string | null): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value) ? (value as SettingsTab) : "company";
}

export default function SettingsTabs({ current }: { current: SettingsTab }) {
  return (
    <nav className="settings-tabs" aria-label="Settings sections">
      {SETTINGS_TABS.map((tab) => (
        <Link key={tab.id} href={`/settings?tab=${tab.id}`} className={current === tab.id ? "on" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
