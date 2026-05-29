import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowLeft, Search, Filter, MapPin, Zap, AlertTriangle, CheckCircle, BarChart2 } from 'lucide-react';

const TargetMap = lazy(() => import('../components/TargetMap'));

export interface Target {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  region: string;
  capacity?: string;
  status: 'active' | 'damaged' | 'destroyed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  owner?: string;
  unit?: string;
  coords_precise?: string;
  strike_history?: string;
}

const TYPE_LABELS: Record<string, string> = {
  npz: 'НПЗ / Нафтопереробка',
  airbase: 'Авіабаза',
  navy: 'ВМБ / Флот',
  ammo: 'Склад боєприпасів',
  radar: 'РЛС / СПРН',
  military: 'Військовий об\'єкт',
  logistics: 'Логістика / Транспорт',
  energy: 'Енергетика / АЕС',
  industry: 'ВПК / Промисловість',
};

const STATUS_META = {
  active:    { label: 'АКТИВНИЙ',   color: 'text-[#c2410c]', bg: 'bg-[#c2410c]/10', dot: 'bg-[#c2410c]', icon: AlertTriangle },
  damaged:   { label: 'ПОШКОДЖЕНО', color: 'text-[#b45309]', bg: 'bg-[#b45309]/10', dot: 'bg-[#d97706]', icon: Zap },
  destroyed: { label: 'ЗНИЩЕНО',    color: 'text-[#15803d]', bg: 'bg-[#15803d]/10', dot: 'bg-[#16a34a]', icon: CheckCircle },
};

const PRIORITY_META = {
  critical: { label: 'КРИТИЧНИЙ', badge: 'border-[#c2410c]/40 text-[#c2410c] bg-[#c2410c]/5' },
  high:     { label: 'ВИСОКИЙ',   badge: 'border-[#b45309]/40 text-[#b45309] bg-[#b45309]/5' },
  medium:   { label: 'СЕРЕДНІЙ',  badge: 'border-[#8a6a0e]/40 text-[#8a6a0e] bg-[#fbf4dd]' },
  low:      { label: 'НИЗЬКИЙ',   badge: 'border-[#0b0b0c]/15 text-[#0b0b0c]/40' },
};

type FilterType = 'all' | string;
type FilterStatus = 'all' | 'active' | 'damaged' | 'destroyed';
type FilterPriority = 'all' | 'critical' | 'high' | 'medium';

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [selected, setSelected] = useState<Target | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  useEffect(() => {
    fetch(`/data/targets.json?_t=${Date.now()}`)
      .then(r => r.json())
      .then((d: Target[]) => { setTargets(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = targets.filter(t => {
    const q = search.toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !t.region.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total: targets.length,
    active: targets.filter(t => t.status === 'active').length,
    damaged: targets.filter(t => t.status === 'damaged').length,
    destroyed: targets.filter(t => t.status === 'destroyed').length,
    critical: targets.filter(t => t.priority === 'critical').length,
  };

  const selectClass = 'bg-[#f4f5f3] border border-[#0b0b0c]/10 rounded-xl px-4 py-2.5 font-mono text-xs text-[#54564f] focus:outline-none focus:border-[#c9a227]/60 tracking-wider';

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#0b0b0c] font-sans selection:bg-[#c9a227]/30 selection:text-[#0b0b0c]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-[#c9a227]/10 bg-[#ffffff]/90 backdrop-blur-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 px-4 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-mono uppercase tracking-widest items-center">
          <div className="col-span-1 flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
            <div className="w-4 h-4 bg-[#c9a227] rounded-lg flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#ffffff] rounded-md animate-pulse" />
            </div>
            <Link to="/" className="font-bold tracking-tighter text-[#0b0b0c] hover:text-[#8a6a0e] transition-colors">ОКО ГОРА</Link>
          </div>
          <div className="hidden md:block col-span-2 text-center text-[#0b0b0c]/30">
            БАЗА_ЦІЛЕЙ // РОСІЯ // OSINT
          </div>
          <div className="col-span-1 flex justify-end">
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="text-[#0b0b0c] hover:text-[#8a6a0e] transition-colors flex items-center gap-1 font-bold">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-[1400px] mx-auto mb-16"
        >
          <div className="border-b border-[#0b0b0c]/10 pb-12 mb-12">
            <span className="oko-eyebrow text-[#8a6a0e] mb-6 block">
              / Стратегічна база даних
            </span>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter uppercase leading-[0.85] mb-8 text-[#0b0b0c]">
              База<br />Цілей
            </h1>
            <p className="text-[#54564f] text-sm md:text-base max-w-2xl leading-relaxed">
              Каталог критичної інфраструктури Росії — НПЗ, авіабази, склади боєприпасів, об'єкти ВПК та логістичні вузли.
              Координати, описи, статус ураження.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            {[
              { label: 'ВСЬОГО ОБ\'ЄКТІВ', val: stats.total, color: 'text-[#0b0b0c]' },
              { label: 'АКТИВНИХ', val: stats.active, color: 'text-[#c2410c]' },
              { label: 'ПОШКОДЖЕНО', val: stats.damaged, color: 'text-[#b45309]' },
              { label: 'ЗНИЩЕНО', val: stats.destroyed, color: 'text-[#15803d]' },
              { label: 'КРИТИЧНИХ', val: stats.critical, color: 'text-[#c2410c]' },
            ].map(s => (
              <div key={s.label} className="oko-card p-6">
                <div className={`text-3xl md:text-4xl font-bold tracking-tighter mb-2 ${s.color}`}>{s.val}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#54564f]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0b0b0c]/30" />
              <input
                type="text"
                placeholder="Пошук за назвою, регіоном..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#f4f5f3] border border-[#0b0b0c]/10 rounded-xl pl-9 pr-4 py-2.5 font-mono text-xs text-[#0b0b0c] placeholder-[#0b0b0c]/30 focus:outline-none focus:border-[#c9a227]/60 tracking-wider"
              />
            </div>

            {/* Type filter */}
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
              <option value="all">ВСІ ТИПИ</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.toUpperCase()}</option>
              ))}
            </select>

            {/* Status filter */}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)} className={selectClass}>
              <option value="all">БУДЬ-ЯКИЙ СТАТУС</option>
              <option value="active">АКТИВНІ</option>
              <option value="damaged">ПОШКОДЖЕНІ</option>
              <option value="destroyed">ЗНИЩЕНІ</option>
            </select>

            {/* Priority filter */}
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as FilterPriority)} className={selectClass}>
              <option value="all">БУДЬ-ЯКИЙ ПРІОРИТЕТ</option>
              <option value="critical">КРИТИЧНИЙ</option>
              <option value="high">ВИСОКИЙ</option>
              <option value="medium">СЕРЕДНІЙ</option>
            </select>

            {/* View toggle */}
            <div className="flex border border-[#0b0b0c]/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${view === 'list' ? 'bg-[#0b0b0c] text-white' : 'text-[#54564f] hover:text-[#0b0b0c] hover:bg-[#f4f5f3]'}`}
              >
                СПИСОК
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${view === 'map' ? 'bg-[#0b0b0c] text-white' : 'text-[#54564f] hover:text-[#0b0b0c] hover:bg-[#f4f5f3]'}`}
              >
                КАРТА
              </button>
            </div>
          </div>

          <div className="font-mono text-[10px] text-[#0b0b0c]/30 uppercase tracking-widest mb-8">
            <Filter className="w-3 h-3 inline mr-2" />
            {filtered.length} об'єктів з {targets.length}
          </div>
        </motion.div>

        {/* Map view */}
        {view === 'map' && (
          <div className="max-w-[1400px] mx-auto mb-16">
            <Suspense fallback={
              <div className="w-full h-[600px] oko-card flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#0b0b0c]/30 animate-pulse">ЗАВАНТАЖЕННЯ МАПИ...</span>
              </div>
            }>
              <TargetMap targets={filtered} onSelect={setSelected} selected={selected} />
            </Suspense>
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="max-w-[1400px] mx-auto">
            {loading && (
              <div className="text-center py-24 font-mono text-[10px] uppercase tracking-widest text-[#0b0b0c]/30 animate-pulse">
                ЗАВАНТАЖЕННЯ...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-24 font-mono text-[10px] uppercase tracking-widest text-[#0b0b0c]/30">
                НІЧОГО НЕ ЗНАЙДЕНО
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((t, i) => {
                const sm = STATUS_META[t.status];
                const pm = PRIORITY_META[t.priority];
                const StatusIcon = sm.icon;
                const isSel = selected?.id === t.id;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4) }}
                    onClick={() => setSelected(isSel ? null : t)}
                    className={`rounded-2xl cursor-pointer transition-all duration-300 border ${isSel ? 'border-[#c9a227]/60 bg-[#fbf4dd]/40 shadow-sm' : 'border-[#0b0b0c]/10 bg-[#ffffff] hover:border-[#c9a227]/40 hover:bg-[#f4f5f3]/60'}`}
                  >
                    {/* Header */}
                    <div className="p-5 pb-4 flex flex-wrap justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${sm.dot} ${t.status === 'active' ? 'animate-pulse' : ''}`} />
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#54564f] mb-1">
                            {TYPE_LABELS[t.type] || t.type} · {t.region}
                          </div>
                          <h3 className="text-sm md:text-base font-bold uppercase tracking-tight text-[#0b0b0c] leading-tight">
                            {t.name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border rounded-full ${pm.badge}`}>
                          {pm.label}
                        </span>
                        <span className={`font-mono text-[9px] uppercase tracking-widest flex items-center gap-1 ${sm.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" /> {sm.label}
                        </span>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isSel && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="px-5 pb-5 border-t border-[#0b0b0c]/10 pt-4 space-y-4"
                      >
                        <p className="text-[#54564f] text-sm leading-relaxed">{t.description}</p>

                        <div className="grid grid-cols-2 gap-3">
                          {t.coords_precise && (
                            <div>
                              <div className="font-mono text-[9px] text-[#0b0b0c]/40 uppercase tracking-widest mb-1">Координати</div>
                              <div className="font-mono text-xs text-[#15803d] flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {t.coords_precise}
                              </div>
                            </div>
                          )}
                          {t.capacity && (
                            <div>
                              <div className="font-mono text-[9px] text-[#0b0b0c]/40 uppercase tracking-widest mb-1">Потужність</div>
                              <div className="font-mono text-xs text-[#0b0b0c]/70 flex items-center gap-1">
                                <BarChart2 className="w-3 h-3" /> {t.capacity}
                              </div>
                            </div>
                          )}
                          {t.owner && (
                            <div>
                              <div className="font-mono text-[9px] text-[#0b0b0c]/40 uppercase tracking-widest mb-1">Власник</div>
                              <div className="font-mono text-xs text-[#54564f]">{t.owner}</div>
                            </div>
                          )}
                          {t.unit && (
                            <div>
                              <div className="font-mono text-[9px] text-[#0b0b0c]/40 uppercase tracking-widest mb-1">Підрозділ</div>
                              <div className="font-mono text-xs text-[#54564f]">{t.unit}</div>
                            </div>
                          )}
                        </div>

                        {t.strike_history && (
                          <div className="border border-[#15803d]/25 bg-[#15803d]/5 rounded-xl p-3">
                            <div className="font-mono text-[9px] text-[#15803d] uppercase tracking-widest mb-1 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> ІСТОРІЯ УДАРІВ
                            </div>
                            <div className="font-mono text-xs text-[#15803d]/80 leading-relaxed">{t.strike_history}</div>
                          </div>
                        )}

                        <div className="flex gap-3 pt-1">
                          <a
                            href={`https://www.google.com/maps?q=${t.lat},${t.lng}&z=14`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-mono text-[9px] uppercase tracking-widest text-[#54564f] hover:text-[#0b0b0c] transition-colors flex items-center gap-1"
                          >
                            Google Maps <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=14/${t.lat}/${t.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-mono text-[9px] uppercase tracking-widest text-[#54564f] hover:text-[#0b0b0c] transition-colors flex items-center gap-1"
                          >
                            OSM <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#0b0b0c]/10 px-4 md:px-8 py-12 bg-[#ffffff]">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Link to="/" className="text-2xl font-bold tracking-tighter uppercase text-[#0b0b0c] hover:text-[#8a6a0e] transition-colors">
            Око Гора
          </Link>
          <div className="font-mono text-[9px] text-[#0b0b0c]/30 uppercase tracking-widest">
            ДАНІ ОНОВЛЮЮТЬСЯ АВТОМАТИЧНО · © {new Date().getFullYear()} OKO GORA GROUP
          </div>
        </div>
      </footer>
    </div>
  );
}
