"use client";

export default function BattlePreview(){
  return (
    <div className="cc-card p-4 w-[340px] sm:w-[420px]">
      <div className="flex items-center justify-between mb-3">
        <div className="battle-badge">ROUND 2 / 3</div>
        <div className="flex items-center gap-2">
          <div className="live-dot" aria-hidden></div>
          <div className="text-sm muted">LIVE</div>
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">Reverse Unique Array</h3>
      <div className="grid grid-cols-2 gap-4 items-center mb-2">
        <div>
          <div className="text-sm muted">Tyler</div>
          <div className="text-xs muted">1420 Rating</div>
        </div>
        <div className="text-right">
          <div className="text-sm muted">Alex</div>
          <div className="text-xs muted">1387 Rating</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 items-end mb-4">
        <div className="text-3xl font-bold">720</div>
        <div className="text-3xl font-bold text-right">640</div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm muted mb-3">
        <div>8 / 10 tests</div>
        <div className="text-right">7 / 10 tests</div>
      </div>
      <div className="flex items-center justify-between text-xs muted">
        <div className="flex items-center gap-2"><span className="text-sm">⏱</span>01:47 remaining</div>
        <div className="text-xs text-[var(--cc-muted)]">Spectate</div>
      </div>
    </div>
  );
}
