import Link from "next/link";
export default function FinalCta(){
  return (
    <section className="section">
      <div className="page-container max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Ready to prove your JavaScript skills?</h2>
        <p className="muted mb-6">Enter the arena and challenge another developer.</p>
        <Link href="/lobby" className="cc-cta cc-btn-primary px-6 py-3">Start Your First Battle</Link>
      </div>
    </section>
  );
}
