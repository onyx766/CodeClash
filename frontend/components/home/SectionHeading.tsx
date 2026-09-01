export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  accent,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  accent?: "blue" | "violet";
}) {
  return (
    <div className="text-center">
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
          accent === "violet" ? "text-violet-400" : "text-blue-400"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[clamp(1.65rem,3.4vw,2.25rem)] font-extrabold tracking-[-0.025em]">
        {title}
      </h2>
      {subtitle && <p className="mt-2.5 text-[14px] text-dim">{subtitle}</p>}
    </div>
  );
}
