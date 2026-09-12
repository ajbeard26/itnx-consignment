import { FileSignature, Percent, Wallet } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import LoginForm from "@/components/LoginForm";
import SetupForm from "@/components/SetupForm";

const features = [
  { icon: Percent, label: "Per-deal splits", detail: "50/50, 60/40, 70/30, or custom" },
  { icon: Wallet, label: "Payout tracking", detail: "Cash, ACH, and check in one place" },
  { icon: FileSignature, label: "Digital acceptance", detail: "Secure customer sign-off links" },
];

export default function HomeScreen({
  nextPath = "/dashboard",
  mode = "login",
}: {
  nextPath?: string;
  mode?: "setup" | "login" | "offline";
}) {
  return (
    <div className="home">
      <section className="home-brand">
        <div className="home-orb" aria-hidden="true" />
        <div className="home-orb home-orb-2" aria-hidden="true" />
        <header className="home-top">
          <BrandLogo size={96} className="home-mark" priority />
          <span className="home-domain">co.itnx.tech</span>
        </header>
        <div className="home-copy">
          <p className="home-kicker">A service of NXRENT LLC</p>
          <h1>
            Consignment
            <br />
            Portal
          </h1>
          <p className="home-lead">
            Staff access for consignment deals, customer payouts, and digital
            acceptance — built for ITNX.
          </p>
          <ul className="home-features">
            {features.map((item) => (
              <li key={item.label}>
                <item.icon size={18} />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="home-foot">Authorized personnel only. Customer payout links stay private.</p>
      </section>
      <section className="home-auth">
        <div className="auth-card">
          {mode === "offline" ? (
            <>
              <p className="auth-kicker">Database</p>
              <h2>Connect Postgres</h2>
              <p className="auth-sub">
                Set <code>DATABASE_URL</code> in <code>.env</code>, then run{" "}
                <code>npx prisma db push</code> so you can create your staff login.
              </p>
            </>
          ) : mode === "setup" ? (
            <>
              <p className="auth-kicker">First-time setup</p>
              <h2>Create your login</h2>
              <p className="auth-sub">
                Set the email and password you will use to open this portal. You can
                change them later in Settings.
              </p>
              <SetupForm nextPath={nextPath} />
            </>
          ) : (
            <>
              <p className="auth-kicker">Staff access</p>
              <h2>Sign in</h2>
              <p className="auth-sub">
                Use the email and password you saved on first setup.
              </p>
              <LoginForm nextPath={nextPath} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
