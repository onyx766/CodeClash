export default function Features(){
  const features = ['Real-Time 1v1 Battles','Timed Coding Rounds','Hidden Test Cases','Live Scoring','Rating System','Leaderboards'];
  return (
    <section className="section">
      <div className="page-container max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4">Features</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {features.map(f=> (
            <div key={f} className="cc-card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-gradient-to-br from-[var(--cc-blue)] to-[var(--cc-purple)] flex items-center justify-center text-white font-bold">✓</div>
              <div className="font-medium">{f}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
