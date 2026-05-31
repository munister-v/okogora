/**
 * SupplyRoutesMap — Логістичні маршрути РФ у Південній Україні та РФ
 *
 * Показує ключові траси постачання:
 * M4 Дон (Москва→Ростов), Ростов→Маріуполь→Мелітополь (прибережна траса),
 * Кримський міст і Кримський коридор, Запорізький напрямок,
 * Бєлгородський коридор. Джерела: OpenStreetMap, ISW, DeepState.
 */
import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ── Route definitions ─────────────────────────────────────────────────── */
type Route = {
  id: string;
  label: string;
  desc: string;
  color: string;
  weight: number;
  dash?: string;
  coords: [number, number][];
};

const ROUTES: Route[] = [
  {
    id: 'm4',
    label: 'М4 Дон (Москва→Ростов)',
    desc: 'Головна стратегічна автотраса постачання РФ. Довжина ~1500 км. Критичний вузол: Воронеж–Міллерово–Ростов-на-Дону.',
    color: '#dc2626',
    weight: 4,
    coords: [
      [55.75, 37.62],  // Москва
      [54.19, 37.62],  // Тула
      [53.55, 37.68],  // Єфремов
      [51.67, 39.21],  // Воронеж
      [50.41, 40.17],  // Кантемирівка
      [49.73, 40.31],  // Міловє
      [48.93, 40.39],  // Міллерово
      [48.09, 40.48],  // Каменськ-Шахтинський
      [47.49, 40.20],  // Новочеркаськ
      [47.23, 39.72],  // Ростов-на-Дону
    ],
  },
  {
    id: 'm21-don-luhansk',
    label: 'Ростов→Луганськ (окуп.)',
    desc: 'Маршрут постачання через Луганщину. Через Гуково–Луганськ–Стаханов.',
    color: '#dc2626',
    weight: 3,
    dash: '8 4',
    coords: [
      [47.23, 39.72],  // Ростов
      [47.67, 39.98],  // Шахти
      [48.16, 40.24],  // Гуково
      [48.57, 39.34],  // Луганськ (окупований)
      [48.55, 38.61],  // Алчевськ (окупований)
    ],
  },
  {
    id: 'coastal-south',
    label: 'Ростов→Маріуполь→Мелітополь',
    desc: 'Прибережна траса постачання А280/М23. Ключовий логістичний хребет окупованого півдня. Маріуполь — морський порт та хаб перерозподілу.',
    color: '#ea580c',
    weight: 4,
    coords: [
      [47.23, 39.72],  // Ростов
      [47.21, 38.92],  // Таганрог (авіабаза А-50)
      [47.10, 38.32],  // Новоазовськ
      [47.09, 37.55],  // Маріуполь (порт, хаб)
      [46.97, 37.07],  // Бердянськ
      [46.76, 36.79],  // Приморськ
      [46.85, 35.36],  // Мелітополь (штаб ПрВО)
      [47.25, 35.71],  // Токмак (вузловий ЗД)
      [47.38, 35.14],  // Оріхів (лінія фронту)
    ],
  },
  {
    id: 'melitopol-kherson',
    label: 'Мелітополь→Херсонщина',
    desc: 'Тиловий маршрут через Нову Каховку вздовж окупованого лівобережжя Херсонщини.',
    color: '#d97706',
    weight: 3,
    dash: '6 3',
    coords: [
      [46.85, 35.36],  // Мелітополь
      [46.56, 34.98],  // Акімівка
      [46.42, 33.58],  // Армянськ → через перешийок
      [46.85, 33.39],  // Нова Каховка (ГЕС, переправа)
      [46.64, 32.59],  // Берислав
      [46.51, 32.24],  // Голопристань (лівобережжя)
    ],
  },
  {
    id: 'crimea-bridge',
    label: 'Кримський міст → Сімферополь',
    desc: 'Єдина суходільна траса з РФ до Криму. Керченський міст пошкоджений у жовт. 2022 та 2023. Сімферополь — розподільний хаб Криму.',
    color: '#7c3aed',
    weight: 4,
    coords: [
      [45.44, 36.64],  // Краснодарський берег (під\'їзд до моста)
      [45.33, 36.58],  // Керченський міст
      [45.32, 36.47],  // Керч (в\'їзд на Крим)
      [45.19, 35.78],  // Феодосія (порт)
      [44.95, 34.10],  // Сімферополь
      [44.69, 33.54],  // Севастополь (ГБ ЧФ)
    ],
  },
  {
    id: 'crimea-north-corridor',
    label: 'Крим→Херсон (Чонгар→Армянськ)',
    desc: 'Північний в\'їзд до Криму через Чонгарський і Джанкойський перешийки. З\'єднує окуповану Херсонщину з Кримом.',
    color: '#9333ea',
    weight: 3,
    dash: '6 3',
    coords: [
      [46.12, 34.59],  // Чонгар (підрив 2023)
      [45.71, 34.42],  // Джанкой (авіабаза, вузол)
      [45.42, 34.42],  // Совєтськ
      [44.95, 34.10],  // Сімферополь
    ],
  },
  {
    id: 'belgorod-corridor',
    label: 'Бєлгород→фронт (Харківський напр.)',
    desc: 'Бєлгородський коридор постачання на Харківський напрямок. Вузли: Валуйки, Шебекіно. Регулярні удари ЗСУ 2023–2025.',
    color: '#b45309',
    weight: 3,
    dash: '6 3',
    coords: [
      [50.60, 36.60],  // Бєлгород
      [50.22, 38.09],  // Валуйки (залізничний вузол)
      [49.97, 37.38],  // Вовчанськ
      [49.67, 37.04],  // Харківський напрямок (фронт)
    ],
  },
  {
    id: 'bryansk-sumy',
    label: 'Брянськ→Сумщина (тиловий)',
    desc: 'Тиловий коридор через Брянськ–Сєщу. Авіабаза Сєща (Ту-22М3) і склади БК в районі. Маршрут вздовж кордону Сумської обл.',
    color: '#6b7280',
    weight: 2,
    dash: '5 5',
    coords: [
      [53.25, 34.36],  // Брянськ
      [53.72, 33.34],  // Сєща (авіабаза)
      [52.93, 33.43],  // Почеп (склад ракет)
      [52.54, 33.53],  // Новгород-Сіверський район
      [51.88, 33.92],  // Кордон Сумщини
    ],
  },
  {
    id: 'rostov-donetsk',
    label: 'Ростов→Донецьк (окуп.)',
    desc: 'Основний маршрут постачання на Донецький напрямок через Шахти–Горлівку.',
    color: '#dc2626',
    weight: 3,
    coords: [
      [47.23, 39.72],  // Ростов
      [47.67, 39.98],  // Шахти
      [48.04, 38.98],  // Торецьк район
      [48.00, 37.80],  // Донецьк (окупований)
      [48.33, 38.10],  // Горлівка
    ],
  },
];

/* ── Key nodes ─────────────────────────────────────────────────────────── */
type Node = {
  id: string;
  label: string;
  desc: string;
  pos: [number, number];
  kind: 'hub' | 'port' | 'bridge' | 'airbase' | 'front' | 'depot';
};

const NODES: Node[] = [
  { id: 'rostov', label: 'Ростов-на-Дону', desc: 'Головний оперативний центр ПрВО. Вузол розподілу M4 і прибережної траси.', pos: [47.23, 39.72], kind: 'hub' },
  { id: 'mariupol', label: 'Маріуполь', desc: 'Азовський порт. Хаб морського постачання та перерозподілу. Аеропорт відновлено 2023.', pos: [47.09, 37.55], kind: 'port' },
  { id: 'melitopol', label: 'Мелітополь', desc: 'Адмінцентр окупованого Запоріжжя. Залізничний хаб. Штаб ПрВО.', pos: [46.85, 35.36], kind: 'hub' },
  { id: 'tokmak', label: 'Токмак', desc: 'Вузловий залізничний пункт. Критичний для постачання на Запорізький напрямок.', pos: [47.25, 35.71], kind: 'hub' },
  { id: 'kerch-bridge', label: 'Керченський міст', desc: 'Єдина суходільна траса РФ→Крим. Пошкоджений у жовтні 2022 і 2023. Функціонує частково.', pos: [45.33, 36.58], kind: 'bridge' },
  { id: 'dzhankoy', label: 'Джанкой', desc: 'Авіабаза та залізничний вузол у Криму. Атакований дронами 2024.', pos: [45.71, 34.42], kind: 'airbase' },
  { id: 'simferopol', label: 'Сімферополь', desc: 'Адміністративний центр Криму. Головний розподільний хаб півострова.', pos: [44.95, 34.10], kind: 'hub' },
  { id: 'novorossiysk', label: 'Новоросійськ', desc: 'Головний порт ЧФ РФ. Центр нафтоекспорту. Атакований морськими дронами 2023.', pos: [44.72, 37.77], kind: 'port' },
  { id: 'taganrog', label: 'Таганрог', desc: 'Авіабаза А-50 ДРЛО. Удар дронів 2024 — пошкоджено літак.', pos: [47.21, 38.92], kind: 'airbase' },
  { id: 'belgorod', label: 'Бєлгород', desc: 'Тиловий центр Харківського напрямку. Регулярно під ударами ЗСУ.', pos: [50.60, 36.60], kind: 'hub' },
  { id: 'feodosiya', label: 'Феодосія', desc: 'Порт і база ЧФ у Криму. НК «Новочеркаськ» знищено 26.12.2023.', pos: [45.03, 35.38], kind: 'port' },
  { id: 'nova-kakhovka', label: 'Нова Каховка', desc: 'Переправа через Дніпро. ГЕС підірвана 06.06.2023.', pos: [46.75, 33.39], kind: 'bridge' },
  { id: 'chonar', label: 'Чонгар', desc: 'Північний в\'їзд до Криму. Міст пошкоджено у 2023.', pos: [46.12, 34.59], kind: 'bridge' },
  { id: 'seshcha', label: 'Авіабаза Сєща', desc: 'Ту-22М3. Брянська обл. Склад ракетного озброєння поблизу.', pos: [53.72, 33.34], kind: 'airbase' },
  { id: 'valuyki', label: 'Валуйки', desc: 'Залізничний вузол постачання Харківського напрямку. Під ударами РСЗО ЗСУ.', pos: [50.22, 38.09], kind: 'depot' },
];

const KIND_COLOR: Record<string, string> = {
  hub:     '#1d4ed8',
  port:    '#0f766e',
  bridge:  '#7c3aed',
  airbase: '#d97706',
  front:   '#dc2626',
  depot:   '#6b7280',
};
const KIND_LABEL: Record<string, string> = {
  hub: 'Хаб', port: 'Порт', bridge: 'Переправа', airbase: 'Авіабаза', front: 'Фронт', depot: 'Склад',
};

/* ── Map helpers ────────────────────────────────────────────────────────── */
function ScrollGuard() {
  const map = useMap();
  useEffect(() => {
    map.scrollWheelZoom.disable();
    const el = map.getContainer();
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
      } else {
        if (map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [map]);
  return null;
}

function CoordTracker({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ mousemove: (e) => onMove(e.latlng.lat, e.latlng.lng) });
  return null;
}

/* ── Route filter tabs ──────────────────────────────────────────────────── */
const FILTERS = [
  { id: 'all',    label: 'Усі маршрути' },
  { id: 'south',  label: 'Південь' },
  { id: 'm4',     label: 'М4 Дон' },
  { id: 'crimea', label: 'Крим' },
  { id: 'north',  label: 'Північ' },
];

const FILTER_ROUTE_IDS: Record<string, string[]> = {
  all:    ROUTES.map(r => r.id),
  south:  ['coastal-south', 'melitopol-kherson', 'rostov-donetsk', 'crimea-north-corridor'],
  m4:     ['m4', 'm21-don-luhansk', 'rostov-donetsk'],
  crimea: ['crimea-bridge', 'crimea-north-corridor', 'melitopol-kherson'],
  north:  ['belgorod-corridor', 'bryansk-sumy'],
};

/* ── Main component ─────────────────────────────────────────────────────── */
export default function SupplyRoutesMap() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [coords, setCoords] = useState({ lat: 47, lng: 37 });
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const handleMove = useCallback((lat: number, lng: number) => setCoords({ lat, lng }), []);

  const activeIds = new Set(FILTER_ROUTE_IDS[activeFilter] ?? ROUTES.map(r => r.id));
  const visibleRoutes = ROUTES.filter(r => activeIds.has(r.id));

  return (
    <div className="flex flex-col h-full min-h-[420px]">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-ink/8 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors border ${
              activeFilter === f.id
                ? 'bg-ink text-white border-ink'
                : 'bg-white border-ink/15 text-ink/65 hover:border-gold/50 hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="relative flex-1" style={{ minHeight: 340 }}>
        <MapContainer
          center={[47.5, 36.5]}
          zoom={6}
          scrollWheelZoom={false}
          zoomControl={false}
          className="w-full h-full z-0"
          style={{ minHeight: 340 }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <ZoomControl position="topright" />
          <ScrollGuard />
          <CoordTracker onMove={handleMove} />

          {/* Routes */}
          {visibleRoutes.map(route => (
            <Polyline
              key={route.id}
              positions={route.coords}
              pathOptions={{
                color: route.color,
                weight: hoveredRoute === route.id ? route.weight + 2 : route.weight,
                opacity: hoveredRoute && hoveredRoute !== route.id ? 0.35 : 0.9,
                dashArray: route.dash,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              eventHandlers={{
                mouseover: () => setHoveredRoute(route.id),
                mouseout: () => setHoveredRoute(null),
              }}
            >
              <Tooltip sticky opacity={0.97}>
                <div style={{ fontFamily: 'var(--font-sans, system-ui)', maxWidth: 240 }}>
                  <strong style={{ fontSize: 12 }}>{route.label}</strong>
                  <p style={{ fontSize: 11, color: 'rgba(11,11,12,0.65)', marginTop: 4, lineHeight: 1.5 }}>{route.desc}</p>
                </div>
              </Tooltip>
            </Polyline>
          ))}

          {/* Nodes */}
          {NODES.map(node => (
            <CircleMarker
              key={node.id}
              center={node.pos}
              radius={6}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: KIND_COLOR[node.kind],
                fillOpacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.97}>
                <div style={{ fontFamily: 'var(--font-sans, system-ui)', maxWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>{node.label}</strong>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: KIND_COLOR[node.kind] + '22', color: KIND_COLOR[node.kind], fontWeight: 700 }}>{KIND_LABEL[node.kind]}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(11,11,12,0.65)', lineHeight: 1.5 }}>{node.desc}</p>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Coord readout */}
        <div className="hidden md:block absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm border border-ink/10 rounded-lg px-2.5 py-1.5 pointer-events-none text-[10px] font-mono text-ink/55">
          {coords.lat.toFixed(4)}° N · {coords.lng.toFixed(4)}° E
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4 py-2.5 border-t border-ink/8 text-[10px] text-ink/65">
        {[
          { color: '#dc2626', label: 'М4 Дон / Донбас', dash: false },
          { color: '#ea580c', label: 'Прибережна траса', dash: false },
          { color: '#d97706', label: 'Херсонський напр.', dash: true },
          { color: '#7c3aed', label: 'Кримський міст', dash: false },
          { color: '#9333ea', label: 'Крим-Північ', dash: true },
          { color: '#b45309', label: 'Бєлгород', dash: true },
          { color: '#6b7280', label: 'Брянськ', dash: true },
        ].map(r => (
          <span key={r.label} className="flex items-center gap-1">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="18" y2="3" stroke={r.color} strokeWidth="2.5"
                strokeDasharray={r.dash ? '5 3' : undefined} strokeLinecap="round" />
            </svg>
            {r.label}
          </span>
        ))}
        <span className="ml-auto flex gap-2">
          {Object.entries(KIND_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full border border-white" style={{ background: c }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </span>
      </div>

      <style>{`
        .leaflet-tooltip { font-family: var(--font-sans, system-ui)!important; border-radius: 10px!important; padding: 6px 10px!important; }
        .leaflet-control-zoom { border:1px solid rgba(11,11,12,0.1)!important; border-radius:10px!important; overflow:hidden; box-shadow:0 4px 14px rgba(11,11,12,0.08)!important; }
        .leaflet-control-zoom a { background:rgba(255,255,255,0.96)!important; color:#0b0b0c!important; width:30px!important; height:30px!important; line-height:30px!important; font-size:16px!important; border:none!important; border-bottom:1px solid rgba(11,11,12,0.08)!important; }
        .leaflet-control-zoom a:last-child { border-bottom:none!important; }
        .leaflet-control-attribution { font-size:8px!important; }
      `}</style>
    </div>
  );
}
