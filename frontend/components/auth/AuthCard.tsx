import Image from "next/image";

export function AuthCardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-[58px] w-[58px] items-center justify-center">
        <Image src="/img/logo-mark.png" alt="" width={240} height={150} className="h-12 w-auto" />
      </span>
      <h1 className="mt-3 text-[22px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-[12.5px] text-dim">{subtitle}</p>
    </div>
  );
}
