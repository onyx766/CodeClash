import Image from "next/image";
import { GithubIcon, GoogleIcon } from "../ui/BrandIcons";

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

export function SocialAuth() {
  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] text-dim">or continue with</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-[12.5px] font-semibold text-fg transition-colors hover:border-blue/40"
        >
          <GoogleIcon size={15} /> Continue with Google
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-[12.5px] font-semibold text-fg transition-colors hover:border-blue/40"
        >
          <GithubIcon size={15} /> Continue with GitHub
        </button>
      </div>
    </>
  );
}
