import BrandLogo from "@/components/BrandLogo";
import LoginForm from "@/components/LoginForm";
import SetupForm from "@/components/SetupForm";

export default function HomeScreen({
  nextPath = "/dashboard",
  mode = "login",
  requireSetupToken = false,
}: {
  nextPath?: string;
  mode?: "setup" | "login" | "offline";
  requireSetupToken?: boolean;
}) {
  return (
    <div className="home">
      <section className="home-brand">
        <header className="home-top">
          <BrandLogo size={88} className="home-mark" priority />
        </header>
        <div className="home-copy">
          <p className="home-kicker">A service of NXRENT LLC</p>
          <h1>
            Consignment
            <br />
            Portal
          </h1>
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
                {requireSetupToken ? " Production also needs the SETUP_TOKEN from the server." : ""}
              </p>
              <SetupForm nextPath={nextPath} requireSetupToken={requireSetupToken} />
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
