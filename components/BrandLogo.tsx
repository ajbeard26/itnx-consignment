import Image from "next/image";

export default function BrandLogo({
  size = 72,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/itnx-logo.png"
      alt="ITNX.TECH"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
