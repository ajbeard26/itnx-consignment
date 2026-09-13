import LegalShell from "@/components/LegalShell";
import { publicBrand } from "@/lib/brand";

export const metadata = { title: "Privacy Policy" };

export default async function Page() {
  const s = await publicBrand();
  const brand = s.brand;
  const legal = s.legal;

  return (
    <LegalShell brand={brand} legal={legal} title="Privacy Policy" updated="September 12, 2026">
      <p>
        {legal} (“we”) operates {brand} at co.itnx.tech. This policy describes personal information we handle when you
        use staff tools or a private customer link.
      </p>

      <h3>What we collect</h3>
      <ul>
        <li>Name, email, phone, company, and mailing address</li>
        <li>Payout details: payable-to name, optional bank name, and account last four digits only</li>
        <li>Consignment item details, photos, and sale amounts</li>
        <li>SMS and email message logs related to your consignment</li>
        <li>Staff login email and a hashed password</li>
      </ul>
      <p>We do not ask for full routing numbers, full account numbers, or Social Security numbers on this portal.</p>

      <h3>How we use it</h3>
      <p>
        We use this information to consign and sell property, calculate your share of the final sale price, mail
        checks, send transactional texts and email, and keep records required for the business. We do not sell your
        personal information.
      </p>

      <h3>Sharing</h3>
      <p>
        We share information with service providers who help us operate (for example, our email provider, Telnyx for
        SMS, and the database host). Listings may appear on GovDeals or other marketplaces we choose. We may disclose
        information if required by law.
      </p>

      <h3>Retention</h3>
      <p>
        We keep consignment and payout records for as long as needed to complete payouts, handle disputes, and meet
        tax or legal duties.
      </p>

      <h3>Your choices</h3>
      <p>
        You may ask us to correct mailing or payout details. Reply STOP to opt out of SMS. Private payout links should
        be treated like a statement: do not forward them to people who should not see your information.
      </p>

      <h3>Contact</h3>
      <p>
        {legal}
        {s.address ? `, ${s.address}` : ""}
        {s.contactEmail ? `. ${s.contactEmail}` : ""}
        {s.contactPhone ? `. ${s.contactPhone}` : ""}.
      </p>
    </LegalShell>
  );
}
