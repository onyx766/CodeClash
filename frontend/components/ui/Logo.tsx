import Image from "next/image";
import Link from "next/link";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <Image
        src="/img/logo-mark.png"
        alt="CodeClash"
        width={600}
        height={376}
        priority
        className="h-7 w-auto"
      />
      {!compact && (
        <span className="text-[19px] font-extrabold tracking-tight">
          <span className="text-white">Code</span>
          <span className="text-grad-bp">Clash</span>
        </span>
      )}
    </Link>
  );
}
