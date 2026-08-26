export default function HowItWorks(){
  const cards = [
    { num: '01', title: 'Join a Battle', desc: 'Create a room, join another developer, or enter matchmaking.' },
    { num: '02', title: 'Solve the Challenge', desc: 'Write JavaScript against the clock and run your solution against test cases.' },
    { num: '03', title: 'Win & Rank Up', desc: 'Earn points, increase your rating, and climb the leaderboard.' },
  ];
  return (
    <section className="section">
      <div className="page-container max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-semibold mb-6">How CodeClash Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map(c=> (
            <div key={c.num} className="cc-card p-5 hover:translate-y-[-4px] transition-transform">
              <div className="text-sm text-[var(--cc-cyan)] font-semibold">{c.num}</div>
              <h3 className="mt-2 font-bold text-lg">{c.title}</h3>
              <p className="mt-2 muted">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
