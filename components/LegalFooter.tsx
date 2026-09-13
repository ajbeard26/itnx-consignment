import Link from "next/link";

export default function LegalFooter() {
  return (
    <nav className="legal-footer" aria-label="Legal">
      <Link href="/consignment-agreement">Consignment agreement</Link>
      <Link href="/terms">Terms of service</Link>
      <Link href="/privacy">Privacy</Link>
    </nav>
  );
}
