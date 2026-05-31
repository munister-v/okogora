import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Target = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  region: string;
  status: 'active' | 'damaged' | 'destroyed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  capacity?: string;
  owner?: string;
  strike_history?: string;
  description?: string;
};

const TYPE_META: Record<string, { label: string; color: string; fillColor: string }> = {
  npz:       { label: 'НПЗ',         color: '#c2410c', fillColor: '#f97316' },
  airbase:   { label: 'Авіабаза',    color: '#1d4ed8', fillColor: '#3b82f6' },
  navy:      { label: 'Флот',        color: '#0f766e', fillColor: '#14b8a6' },
  ammo:      { label: 'Склад БК',    color: '#7c3aed', fillColor: '#a855f7' },
  radar:     { label: 'Радар/ЗРК',   color: '#a16207', fillColor: '#eab308' },
  logistics: { label: 'Логістика',   color: '#374151', fillColor: '#6b7280' },
  energy:    { label: 'Енергетика',  color: '#b45309', fillColor: '#f59e0b' },
  industry:  { label: 'Промисловість', color: '#6b21a8', fillColor: '#c084fc' },
  military:  { label: 'Військова',   color: '#991b1b', fillColor: '#ef4444' },
};

const STATUS_RING: Record<string, string> = {
  active:    'transparent',
  damaged:   '#f59e0b',
  destroyed: '#ef4444',
};

const PRIORITY_RADIUS: Record<string, number> = {
  critical: 9,
  high:     7,
  medium:   5,
  low:      4,
};

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

function MapClick({ onCoords }: { onCoords: (lat: number, lng: number) => void }) {
  useMapEvents({ mousemove(e) { onCoords(e.latlng.lat, e.latlng.lng); } });
  return null;
}

interface Props {
  targets: Target[];
  activeTypes: Set<string>;
}

export default function StrategicMap({ targets, activeTypes }: Props) {
  const [coords, setCoords] = useState({ lat: 55, lng: 40 });
  const handleCoords = useCallback((lat: number, lng: number) => setCoords({ lat, lng }), []);

  const visible = targets.filter((t) => activeTypes.has(t.type));

  return (
    <div className="relative w-full" style={{ height: 480 }}>
      <MapContainer
        center={[55, 47]}
        zoom={4}
        scrollWheelZoom={false}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
        />
        <ZoomControl position="topright" />
        <ScrollGuard />
        <MapClick onCoords={handleCoords} />

        {visible.map((t) => {
          const meta = TYPE_META[t.type] || TYPE_META.military;
          const radius = PRIORITY_RADIUS[t.priority] ?? 6;
          const ringColor = STATUS_RING[t.status];
          const isHit = t.status !== 'active';

          return (
            <CircleMarker
              key={t.id}
              center={[t.lat, t.lng]}
              radius={radius}
              pathOptions={{
                color: isHit ? ringColor : meta.color,
                weight: isHit ? 2.5 : 1.5,
                fillColor: isHit ? ringColor : meta.fillColor,
                fillOpacity: isHit ? 0.85 : 0.72,
              }}
            >
              <Tooltip direction="top" offset={[0, -radius - 2]} opacity={0.97}>
                <span style={{ fontFamily: 'var(--font-sans, system-ui)', fontSize: 12 }}>
                  <strong>{t.name}</strong><br />
                  {meta.label} · {t.region}
                  {isHit && <><br /><span style={{ color: ringColor, fontWeight: 700 }}>▲ {t.status === 'destroyed' ? 'Знищено' : 'Пошкоджено'}</span></>}
                </span>
              </Tooltip>
              <Popup className="sm-popup">
                <div style={{ fontFamily: 'var(--font-sans, system-ui)', minWidth: 240, padding: '12px 14px', background: '#111', color: '#fff', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <strong style={{ fontSize: 13, lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{t.name}</strong>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: `${meta.fillColor}25`, color: meta.fillColor, fontWeight: 700, whiteSpace: 'nowrap' }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                    <div><span style={{ opacity: 0.45 }}>Регіон</span> {t.region}</div>
                    {t.capacity && <div><span style={{ opacity: 0.45 }}>Потужність</span> {t.capacity}</div>}
                    {t.owner && <div><span style={{ opacity: 0.45 }}>Власник</span> {t.owner}</div>}
                    <div>
                      <span style={{ opacity: 0.45 }}>Пріоритет</span>{' '}
                      <span style={{ color: t.priority === 'critical' ? '#f97316' : t.priority === 'high' ? '#eab308' : '#6b7280', fontWeight: 600 }}>{t.priority}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.45 }}>Статус</span>{' '}
                      <span style={{ color: isHit ? ringColor : '#4ade80', fontWeight: 600 }}>
                        {t.status === 'destroyed' ? '✕ Знищено' : t.status === 'damaged' ? '△ Пошкоджено' : '✓ Активний'}
                      </span>
                    </div>
                    {t.strike_history && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
                        <span style={{ opacity: 0.45, display: 'block', marginBottom: 2 }}>Історія ударів</span>
                        {t.strike_history}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Coordinates */}
      <div className="hidden md:block absolute bottom-3 left-3 z-[400] bg-white/92 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 pointer-events-none text-[10px] font-mono text-ink/60 shadow-sm">
        {coords.lat.toFixed(4)}° N · {coords.lng.toFixed(4)}° E
      </div>

      <style>{`
        .sm-popup .leaflet-popup-content-wrapper { background: transparent!important; padding:0!important; border-radius:12px!important; box-shadow:0 12px 40px rgba(0,0,0,0.45)!important; overflow:hidden!important; }
        .sm-popup .leaflet-popup-content { margin:0!important; }
        .sm-popup .leaflet-popup-tip { background:#111!important; }
        .leaflet-control-zoom { border:1px solid rgba(11,11,12,0.1)!important; border-radius:10px!important; overflow:hidden; box-shadow:0 4px 14px rgba(11,11,12,0.08)!important; }
        .leaflet-control-zoom a { background:rgba(255,255,255,0.96)!important; color:#0b0b0c!important; width:32px!important; height:32px!important; line-height:32px!important; font-size:17px!important; border:none!important; border-bottom:1px solid rgba(11,11,12,0.08)!important; }
        .leaflet-control-zoom a:last-child { border-bottom:none!important; }
        .leaflet-control-zoom a:hover { background:#f4f5f3!important; }
        .leaflet-control-attribution { font-size:9px!important; background:rgba(255,255,255,0.7)!important; }
      `}</style>
    </div>
  );
}
