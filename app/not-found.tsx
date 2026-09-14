import Link from "next/link";
import { cookies } from "next/headers";
import CustomerHero from "@/components/CustomerHero";
import { publicBrand } from "@/lib/brand";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const metadata = { title: "Page not found" };

export default async function NotFound() {
  const s = await publicBrand();
  const staff = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <div className="miss-wrap">
      <CustomerHero brand={s.brand} legal={s.legal}>
        <article className="portal-card miss-card">
          <p className="kicker">404</p>
          <h1>Page not found</h1>
          <p className="muted">
            This address does not exist, or the link has expired.
          </p>
          {staff ? (
            <div className="miss-actions">
              <Link className="button" href="/dashboard">
                Dashboard
              </Link>
              <Link className="button ghost" href="/consignments">
                Consignments
              </Link>
            </div>
          ) : (
            <>
              <p className="miss-note">
                {s.contactEmail ? (
                  <>
                    If you were sent a payout or signature link, ask us for a new one at{" "}
                    <a className="text-link" href={`mailto:${s.contactEmail}`}>
                      {s.contactEmail}
                    </a>
                    .
                  </>
                ) : (
                  <>If you were sent a payout or signature link, ask us for a new one.</>
                )}
              </p>
              <p className="miss-staff">
                <Link className="text-link" href="/login">
                  Staff sign in
                </Link>
              </p>
            </>
          )}
        </article>
      </CustomerHero>
    </div>
  );
}
