import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

// Szybkie przejście (Ctrl/⌘+K): ekrany, podopieczni, ćwiczenia
export default function Palette({ items, close }) {
  const [q, setQ] = useState(''), [i, setI] = useState(0);
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current && ref.current.focus(), 30); }, []);
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const list = useMemo(() => { const n = norm(q.trim()); return (n ? items.filter(x => norm(x.label + ' ' + (x.sub || '')).includes(n)) : items.filter(x => x.group === 'Ekrany')).slice(0, 12); }, [q, items]);
  const go = x => { close(); if (x.href) location.hash = x.href; if (x.run) x.run(); };
  const key = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(v => Math.min(list.length - 1, v + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(v => Math.max(0, v - 1)); }
    else if (e.key === 'Enter' && list[i]) { e.preventDefault(); go(list[i]); }
  };
  let lastGroup = null;
  return (
    <div className="palette">
      <div className="pal-in"><Search size={18} /><input ref={ref} id="pal-q" type="search" value={q} onChange={e => { setQ(e.target.value); setI(0); }} onKeyDown={key} placeholder="Szukaj ekranu, podopiecznego, ćwiczenia…" aria-label="Szukaj" autoComplete="off" /></div>
      <div className="pal-list" role="listbox">
        {!list.length && <p className="small muted" style={{ padding: 12 }}>Nic nie znaleziono.</p>}
        {list.map((x, k) => { const head = x.group !== lastGroup; lastGroup = x.group; return <div key={x.group + x.label + k}>
          {head && <p className="eyebrow" style={{ padding: '8px 12px 2px' }}>{x.group}</p>}
          <button role="option" aria-selected={k === i} className={'pal-item' + (k === i ? ' on' : '')} onMouseEnter={() => setI(k)} onClick={() => go(x)}>
            {x.I && <x.I size={16} />}<span><b>{x.label}</b>{x.sub && <span className="xs muted"> · {x.sub}</span>}</span>{k === i && <CornerDownLeft size={14} style={{ marginLeft: 'auto', opacity: .5 }} />}
          </button></div>; })}
      </div>
      <p className="xs muted" style={{ padding: '6px 12px 0' }}>↑↓ wybierz · Enter otwórz · Esc zamknij</p>
    </div>
  );
}
