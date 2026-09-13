import LegalFooter from "@/components/LegalFooter";

export default function CustomerHero({ brand, legal }: { brand: string; legal: string }) {
  return (
    <div className="customer-hero">
      <img src="/itnx-logo.png" alt="ITNX" className="customer-logo" />
      <h1>{brand}</h1>
      <div className="muted">A service of {legal}</div>
      <LegalFooter />
    </div>
  );
}
