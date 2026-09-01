import Image from 'next/image';
import Link from 'next/link';

type CodeClashLogoProps = {
  href?: string;
  variant?: 'light' | 'dark';
  className?: string;
  size?: 'sm' | 'md';
};

export default function CodeClashLogo({
  href = '/',
  variant = 'dark',
  className = '',
  size = 'md',
}: CodeClashLogoProps) {
  const iconSize = size === 'sm' ? 28 : 32;
  const textClass = variant === 'light' ? 'logo-text--light' : 'logo-text';

  const content = (
    <>
      <Image
        src="/assets/logo.png"
        alt=""
        width={iconSize}
        height={iconSize}
        className="logo-img"
        aria-hidden="true"
      />
      <span className={textClass}>CodeClash</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`brand-logo ${className}`}>
        {content}
      </Link>
    );
  }

  return <div className={`brand-logo ${className}`}>{content}</div>;
}
