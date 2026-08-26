export default function Stats(){
  const items = [
    { val: '1,248+', label: 'Developers' },
    { val: '8,942+', label: 'Matches Played' },
    { val: '120+', label: 'Challenges' },
    { val: '42', label: 'Online Now' },
  ];
  return (
    <section className="section">
      <div className="page-container max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 cc-card p-4">
          {items.map((it)=> (
            <div key={it.label} className="p-4">
              <div className="stat-val">{it.val}</div>
              <div className="stat-label">{it.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
