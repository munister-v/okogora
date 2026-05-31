import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, GeoJSON, LayersControl, Polyline, Popup, Tooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import { Anchor, Map as MapIcon, Menu, Plane, RadioTower, X as CloseIcon, Ruler, Activity } from 'lucide-react';

function territoryStyle(feature?: Feature): PathOptions {
  const props = feature?.properties ?? {};
  return {
    color: (props['stroke'] as string) ?? '#c9a227',
    fillColor: (props['fill'] as string) ?? 'transparent',
    opacity: (props['stroke-opacity'] as number) ?? 1,
    fillOpacity: (props['fill-opacity'] as number) ?? 0.35,
    weight: props['stroke-width'] != null ? (props['stroke-width'] as number) * 1.05 : 1.5,
  };
}

const canvasRenderer = L.canvas({ padding: 0.5 });

type RssItem = {
  id: string;
  title?: string;
  titleUk?: string;
  summary?: string;
  summaryUk?: string;
  publishedAt?: string;
  url?: string;
  author?: string;
};

type InfrastructurePoint = {
  id: string;
  label: string;
  kind: 'aviation' | 'naval' | 'airfield';
  position: [number, number];
  note: string;
};

type StrikeRegion = {
  id: string;
  label: string;
  position: [number, number];
  aliases: string[];
};

type RegionalStrike = StrikeRegion & {
  count: number;
  latestTitle: string;
  latestUrl: string;
  latestDate: string;
};

const INFRASTRUCTURE_POINTS: InfrastructurePoint[] = [
  // ── Аеродроми РФ (відкриті дані Wikipedia / GlobalSecurity) ──
  // Стратегічна авіація
  { id: 'af-engels', label: 'Енгельс-2', kind: 'airfield', position: [51.43, 46.12], note: 'Авіабаза стратегічних бомбардувальників Ту-160 і Ту-95МС. 22-а гвардійська важка бомбардувальна авіадивізія.' },
  { id: 'af-dyagilevo', label: 'Дягілево', kind: 'airfield', position: [54.64, 39.57], note: 'Навчальний центр далекої авіації. Ту-22М3, Ту-95МС, Іл-78 (танкери).' },
  { id: 'af-ukrainka', label: 'Українка', kind: 'airfield', position: [51.15, 128.50], note: 'Авіабаза стратегічних бомбардувальників Ту-95МС на Далекому Сході.' },
  { id: 'af-belaya', label: 'Бєлая', kind: 'airfield', position: [52.75, 103.60], note: 'Авіабаза далекої авіації, Ту-22М3. Іркутська область.' },
  { id: 'af-shaykovka', label: 'Шайковка', kind: 'airfield', position: [54.23, 34.37], note: 'Авіабаза Ту-22М3. Калузька область. 52-й гвардійський ТБАП.' },
  { id: 'af-soltsy', label: 'Солци-2', kind: 'airfield', position: [58.15, 30.33], note: 'Авіабаза Ту-22М3. Новгородська область. 840-й ТБАП.' },
  { id: 'af-olenya', label: 'Оленья', kind: 'airfield', position: [68.15, 33.47], note: 'Авіабаза морської авіації Ту-22М3. Кольський півострів.' },
  { id: 'af-mozdok', label: 'Моздок', kind: 'airfield', position: [43.72, 44.68], note: 'Авіабаза далекої авіації на Кавказі. Ту-22М3, Су-24.' },

  // Тактична / фронтова авіація (ключові для конфлікту)
  { id: 'af-millerovo', label: 'Міллерово', kind: 'airfield', position: [48.95, 40.30], note: 'Прифронтова авіабаза біля кордону з Україною. Су-30СМ, 31-й ВП.' },
  { id: 'af-krymsk', label: 'Кримськ', kind: 'airfield', position: [44.97, 38.00], note: 'Авіабаза тактичної авіації. Краснодарський край. МіГ-29СМТ.' },
  { id: 'af-primorsko', label: 'Приморсько-Ахтарськ', kind: 'airfield', position: [46.06, 38.23], note: 'Авіабаза штурмової авіації Су-25. Краснодарський край.' },
  { id: 'af-kushchyovskaya', label: 'Кущовська', kind: 'airfield', position: [46.54, 39.55], note: 'Авіабаза тактичної авіації. Краснодарський край.' },
  { id: 'af-korenovsk', label: 'Кореновськ', kind: 'airfield', position: [45.45, 39.42], note: 'Авіабаза вертольотів армійської авіації. Мі-28, Ка-52.' },
  { id: 'af-yeysk', label: 'Єйськ', kind: 'airfield', position: [46.68, 38.21], note: 'Навчальна авіабаза морської авіації.' },
  { id: 'af-rostov-north', label: 'Ростов-Північний', kind: 'airfield', position: [47.27, 39.64], note: 'Військова авіабаза, Ростовська область.' },
  { id: 'af-taganrog', label: 'Таганрог-Центральний', kind: 'airfield', position: [47.25, 38.84], note: 'Авіабаза та авіазавод. Літаки ДРЛО А-50.' },
  { id: 'af-voronezh', label: 'Воронеж-Малишево', kind: 'airfield', position: [51.62, 39.13], note: 'Авіабаза тактичної авіації. Су-34. Воронезька область.' },
  { id: 'af-lipetsk', label: 'Ліпецьк', kind: 'airfield', position: [52.64, 39.45], note: 'Центр бойового застосування та перенавчання ВКС. Су-35, Су-57.' },
  { id: 'af-kursk', label: 'Курськ-Східний', kind: 'airfield', position: [51.75, 36.30], note: 'Військова авіабаза, Курська область. Прифронтова зона.' },
  { id: 'af-tikhoretsk', label: 'Тихорецьк', kind: 'airfield', position: [45.88, 40.11], note: 'Авіабаза на Кубані. Краснодарський край.' },
  { id: 'af-khanskaya', label: 'Ханська', kind: 'airfield', position: [44.68, 40.04], note: 'Навчальний авіаційний центр, Адигея.' },
  { id: 'af-marinovka', label: 'Маріновка', kind: 'airfield', position: [48.81, 43.26], note: 'Авіабаза тактичної авіації. Волгоградська область.' },
  { id: 'af-buturlinovka', label: 'Бутурлинівка', kind: 'airfield', position: [50.85, 40.58], note: 'Авіабаза. Воронезька область. Су-24, Су-34.' },
  { id: 'af-baltimore', label: 'Балтимор', kind: 'airfield', position: [47.25, 39.80], note: 'Авіабаза бомбардувальної авіації Су-34. Ростов.' },

  // Крим (окупований)
  { id: 'af-belbek', label: 'Бельбек', kind: 'airfield', position: [44.69, 33.57], note: 'Авіабаза біля Севастополя. Су-27, Су-30СМ. Окупований Крим.' },
  { id: 'af-saky', label: 'Саки (Новофедорівка)', kind: 'airfield', position: [45.09, 33.60], note: 'Авіабаза морської авіації. Су-24, Су-30СМ. Вибух 09.08.2022.' },
  { id: 'af-gvardeyskoye', label: 'Гвардійське', kind: 'airfield', position: [45.12, 33.98], note: 'Авіабаза в Криму. Бомбардувальна та штурмова авіація.' },
  { id: 'af-dzhankoi', label: 'Джанкой', kind: 'airfield', position: [45.70, 34.42], note: 'Авіабаза та військовий вузол у Криму. Вертольоти.' },
  { id: 'af-kirovske', label: 'Кіровське', kind: 'airfield', position: [45.17, 35.18], note: 'Авіабаза в Криму. Су-24.' },

  // Центральний ВО
  { id: 'af-kubinka', label: 'Кубинка', kind: 'airfield', position: [55.61, 36.65], note: 'Авіабаза «Стрижі» та «Руські Витязі». Демонстраційна ескадрилья.' },
  { id: 'af-chkalovsky', label: 'Чкаловський', kind: 'airfield', position: [55.88, 38.06], note: 'Авіабаза військово-транспортної авіації. Іл-76. Москва.' },
  { id: 'af-migalovo', label: 'Мігалово', kind: 'airfield', position: [56.83, 35.76], note: 'Авіабаза ВТА. Іл-76. Тверська область.' },
  { id: 'af-ivanovo', label: 'Іваново-Північний', kind: 'airfield', position: [57.01, 40.94], note: 'Авіабаза ВТА. Іл-76. Івановська область.' },
  { id: 'af-klin', label: 'Клін', kind: 'airfield', position: [56.37, 36.74], note: 'Авіабаза протиповітряної оборони. Московська область.' },
  { id: 'af-khotilovo', label: 'Хотілово', kind: 'airfield', position: [57.66, 34.10], note: 'Авіабаза перехоплювачів МіГ-31. ППО Москви.' },
  { id: 'af-klokovo', label: 'Клоково', kind: 'airfield', position: [54.24, 37.61], note: 'Авіабаза, Тульська область.' },
  { id: 'af-torzhok', label: 'Торжок', kind: 'airfield', position: [57.04, 35.00], note: 'Центр бойового застосування армійської авіації. Ка-52, Мі-28.' },

  // Західний ВО / Північно-Захід
  { id: 'af-pskov', label: 'Псков (Кресті)', kind: 'airfield', position: [57.79, 28.40], note: 'Авіабаза ВДВ / ВТА. Іл-76. Псковська область.' },
  { id: 'af-ostrov', label: 'Острів', kind: 'airfield', position: [57.30, 28.43], note: 'Авіабаза тактичної авіації. Псковська область.' },
  { id: 'af-khrabrovo', label: 'Храброво', kind: 'airfield', position: [54.89, 20.59], note: 'Військова авіабаза. Калінінград.' },
  { id: 'af-chernyakhovsk', label: 'Черняховськ', kind: 'airfield', position: [54.60, 21.80], note: 'Авіабаза морської авіації Балтфлоту. Су-24. Калінінград.' },
  { id: 'af-levashovo', label: 'Левашово', kind: 'airfield', position: [60.09, 30.19], note: 'Авіабаза, Ленінградська область.' },
  { id: 'af-pushkin', label: 'Пушкін', kind: 'airfield', position: [59.69, 30.34], note: 'Авіабаза. Ленінградська область.' },
  { id: 'af-seshcha', label: 'Сєща', kind: 'airfield', position: [53.72, 33.34], note: 'Авіабаза Ту-22М3. Брянська область. Поблизу кордону з Україною.' },
  { id: 'af-shatalovo', label: 'Шаталово', kind: 'airfield', position: [54.34, 32.47], note: 'Авіабаза. Смоленська область.' },

  // Північ
  { id: 'af-monchegorsk', label: 'Мончегорськ', kind: 'airfield', position: [67.99, 33.02], note: 'Авіабаза ППО/ПЛО. Кольський півострів.' },
  { id: 'af-severomorsk1', label: 'Сєвероморськ-1', kind: 'airfield', position: [69.03, 33.42], note: 'Авіабаза Північного флоту. Мурманська область.' },
  { id: 'af-severomorsk3', label: 'Сєвероморськ-3', kind: 'airfield', position: [68.87, 33.72], note: 'Авіабаза морської авіації. Протичовнова авіація.' },
  { id: 'af-rogachyovo', label: 'Рогачово', kind: 'airfield', position: [71.62, 52.47], note: 'Авіабаза перехоплювачів на Новій Землі. МіГ-31.' },

  // Урал / Сибір
  { id: 'af-chelyabinsk', label: 'Шагол (Челябінськ)', kind: 'airfield', position: [55.30, 61.32], note: 'Авіабаза перехоплювачів. МіГ-31. Челябінська область.' },
  { id: 'af-perm', label: 'Болшоє Савіно', kind: 'airfield', position: [57.91, 56.02], note: 'Авіабаза, Пермський край. МіГ-31.' },
  { id: 'af-yekaterinburg', label: 'Кольцово (військ.)', kind: 'airfield', position: [56.75, 60.80], note: 'Військова частина авіабази Єкатеринбург.' },
  { id: 'af-novosibirsk', label: 'Толмачово (військ.)', kind: 'airfield', position: [55.01, 82.65], note: 'Авіабаза, Новосибірська область.' },
  { id: 'af-kansk', label: 'Канськ', kind: 'airfield', position: [56.28, 95.70], note: 'Авіабаза Ту-22М3, Красноярський край.' },

  // Далекий Схід
  { id: 'af-khabarovsk', label: 'Хабаровськ (Великий)', kind: 'airfield', position: [48.52, 135.17], note: 'Авіабаза Далекосхідного ВО.' },
  { id: 'af-vladivostok', label: 'Кнєвичі (військ.)', kind: 'airfield', position: [43.40, 132.15], note: 'Авіабаза Тихоокеанського флоту.' },
  { id: 'af-kamenny', label: 'Камʼяний Ручей', kind: 'airfield', position: [43.31, 133.85], note: 'Авіабаза морської авіації ТОФ. Ту-22М3.' },
  { id: 'af-yelizovo', label: 'Єлізово', kind: 'airfield', position: [53.17, 158.45], note: 'Авіабаза перехоплювачів МіГ-31. Камчатка.' },
  { id: 'af-anadyr', label: 'Анадир-Угольний', kind: 'airfield', position: [64.73, 177.47], note: 'Авіабаза арктичної групи. Чукотка.' },

  // ── Морські контури ──
  { id: 'naval-black-sea', label: 'Чорноморський контур', kind: 'naval', position: [44.95, 36.2], note: 'Узагальнений маркер районів базування ЧФ РФ.' },
  { id: 'naval-baltic-kaliningrad', label: 'Калінінградський контур', kind: 'naval', position: [54.75, 20.45], note: 'Узагальнений регіон Балтійського флоту РФ.' },
  { id: 'naval-baltic-leningrad', label: 'Ленінградський контур', kind: 'naval', position: [59.9, 29.75], note: 'Узагальнений регіон морської інфраструктури РФ у Фінській затоці.' },
  { id: 'naval-northern', label: 'Північний флот', kind: 'naval', position: [69.05, 33.2], note: 'Узагальнений регіон базування Північного флоту РФ.' },
  { id: 'naval-caspian', label: 'Каспійський контур', kind: 'naval', position: [46.35, 48.05], note: 'Узагальнений регіон Каспійської флотилії РФ.' },
  { id: 'naval-pacific', label: 'Тихоокеанський контур', kind: 'naval', position: [43.12, 132.0], note: 'Узагальнений регіон Тихоокеанського флоту РФ.' },
];

const STRIKE_REGIONS: StrikeRegion[] = [
  { id: 'ru-belgorod', label: 'Бєлгородська область', position: [50.7, 37.1], aliases: ['бєлгород', 'белгород', 'belgorod'] },
  { id: 'ru-kursk', label: 'Курська область', position: [51.7, 36.2], aliases: ['курськ', 'kursk'] },
  { id: 'ru-bryansk', label: 'Брянська область', position: [53.2, 34.4], aliases: ['брянськ', 'bryansk'] },
  { id: 'ru-rostov', label: 'Ростовська область', position: [47.45, 40.1], aliases: ['ростов', 'rostov', 'таганрог', 'taganrog'] },
  { id: 'ru-krasnodar', label: 'Краснодарський край', position: [45.2, 39.1], aliases: ['краснодар', 'krasnodar', 'туапсе', 'tuapse', 'новоросійськ', 'новороссийск', 'novorossiysk', 'приморсько-ахтарськ', 'приморско-ахтарск'] },
  { id: 'ru-volgograd', label: 'Волгоградська область', position: [48.7, 44.5], aliases: ['волгоград', 'volgograd'] },
  { id: 'ru-saratov', label: 'Саратовська область', position: [51.55, 46.05], aliases: ['саратов', 'saratov', 'енгельс', 'engels'] },
  { id: 'ru-ryazan', label: 'Рязанська область', position: [54.62, 39.75], aliases: ['рязань', 'ryazan', 'дягілево', 'дягилево', 'dyagilevo'] },
  { id: 'ru-samara', label: 'Самарська область', position: [53.2, 50.15], aliases: ['самар', 'samara', 'куйбишев', 'куйбышев', 'novokuibyshevsk', 'новокуйбишев'] },
  { id: 'ru-tatarstan', label: 'Татарстан', position: [55.7, 51.0], aliases: ['татарстан', 'tatarstan', 'нижньокамськ', 'нижнекамск', 'nizhnekamsk', 'танеко', 'taneco', 'елабуга', 'yelabuga'] },
  { id: 'ru-bashkortostan', label: 'Башкортостан', position: [54.7, 56.0], aliases: ['башкортостан', 'bashkortostan', 'уфа', 'ufa', 'салават', 'salavat'] },
  { id: 'ru-nizhny', label: 'Нижегородська область', position: [56.25, 44.0], aliases: ['нижегород', 'nizhny', 'кстово', 'kstovo', 'норси', 'norsi'] },
  { id: 'ru-leningrad', label: 'Ленінградська область', position: [59.75, 30.2], aliases: ['ленінград', 'ленинград', 'санкт-петербург', 'st petersburg', 'петербург', 'усть-луга', 'ust-luga', 'приморськ', 'приморск', 'primorsk'] },
  { id: 'ru-moscow', label: 'Москва / Московська область', position: [55.75, 37.6], aliases: ['москва', 'moscow', 'московськ', 'московск'] },
  { id: 'ru-orel', label: 'Орловська область', position: [52.95, 36.05], aliases: ['орел', 'орёл', 'oryol', 'orel'] },
  { id: 'ru-tula', label: 'Тульська область', position: [54.2, 37.6], aliases: ['тула', 'tula'] },
  { id: 'ru-voronezh', label: 'Воронезька область', position: [51.65, 39.2], aliases: ['воронеж', 'voronezh'] },
  { id: 'ru-astrakhan', label: 'Астраханська область', position: [46.35, 48.05], aliases: ['астрахан', 'astrakhan'] },
  { id: 'ru-perm', label: 'Пермський край', position: [58.0, 56.25], aliases: ['перм', 'perm'] },
  { id: 'ru-chuvashia', label: 'Чувашія', position: [56.15, 47.25], aliases: ['чуваш', 'cheboksary', 'чебоксар'] },
  { id: 'ru-crimea', label: 'Крим', position: [45.25, 34.25], aliases: ['крим', 'crimea', 'севастопол', 'sevastopol', 'саки', 'saky', 'бельбек', 'belbek'] },
];

const STRIKE_RE = /(удар|влуч|уражен|знищен|атака|атакован|пожеж|вибух|дрон|бпла|strike|struck|hit|attack|explosion|blast|fire|drone|uav)/i;
const RUSSIA_CONTEXT_RE = /(росі|росс|russia|russian|рф|окупован|crimea|крим|севастопол)/i;

function TerritoryLayer({ geojson }: { geojson: GeoJsonObject }) {
  return (
    <GeoJSON
      key="territory-layer"
      data={geojson}
      style={territoryStyle}
      renderer={canvasRenderer}
      onEachFeature={(feature, layer) => {
        const name = feature.properties?.name;
        const desc = feature.properties?.description;
        if (name || desc) {
          layer.bindPopup(
            `<div style="font-family:monospace;font-size:11px"><b>${name ?? ''}</b>${desc ? `<br>${desc}` : ''}</div>`
          );
        }
      }}
    />
  );
}

function MapEvents({
  onMouseMove,
  onClick,
}: {
  onMouseMove: (lat: number, lng: number) => void;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Prevents the map from hijacking page scroll on mobile & desktop.
 * Scroll-wheel zoom only engages while Ctrl/Cmd is held; otherwise the
 * wheel event passes through to the page and a hint banner appears briefly.
 */
function ScrollGuard({ onBlocked }: { onBlocked: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.scrollWheelZoom.disable();
    const container = map.getContainer();
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
      } else {
        if (map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
        onBlocked();
      }
    };
    const releaseKey = (e: KeyboardEvent) => {
      if ((e.key === 'Control' || e.key === 'Meta') && map.scrollWheelZoom.enabled()) {
        map.scrollWheelZoom.disable();
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keyup', releaseKey);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keyup', releaseKey);
    };
  }, [map, onBlocked]);
  return null;
}

function territoryStatusLabel(status: 'loading' | 'ready' | 'error') {
  if (status === 'ready') return 'ГОТОВО';
  if (status === 'error') return 'ПОМИЛКА';
  return 'ЗАВАНТАЖЕННЯ';
}

function cleanText(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
  } catch {
    return value.slice(0, 10);
  }
}

function buildRegionalStrikes(items: RssItem[]) {
  const now = Date.now();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const byRegion = new Map<string, RegionalStrike>();
  const seen = new Set<string>();

  for (const item of items) {
    const ts = new Date(item.publishedAt || '').getTime();
    if (Number.isNaN(ts) || now - ts > windowMs) continue;

    const title = cleanText(item.titleUk || item.title || '');
    const text = `${title} ${cleanText(item.summaryUk || item.summary || '')}`;
    if (!STRIKE_RE.test(text) || !RUSSIA_CONTEXT_RE.test(text)) continue;

    const low = text.toLowerCase();
    const matchedRegions = STRIKE_REGIONS.filter((region) =>
      region.aliases.some((alias) => low.includes(alias.toLowerCase())),
    );

    for (const region of matchedRegions) {
      const key = `${region.id}:${title.toLowerCase().slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const current = byRegion.get(region.id);
      if (!current) {
        byRegion.set(region.id, {
          ...region,
          count: 1,
          latestTitle: title || 'Повідомлення без заголовка',
          latestUrl: item.url || '',
          latestDate: item.publishedAt || '',
        });
        continue;
      }

      current.count += 1;
      if (ts > new Date(current.latestDate || '').getTime()) {
        current.latestTitle = title || current.latestTitle;
        current.latestUrl = item.url || current.latestUrl;
        current.latestDate = item.publishedAt || current.latestDate;
      }
    }
  }

  return Array.from(byRegion.values()).sort((a, b) => b.count - a.count);
}

export default function MapService() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768,
  );
  const [scrollHint, setScrollHint] = useState(false);
  const [telemetry, setTelemetry] = useState({ lat: 45.0, lng: 35.0 });
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [regionalStrikes, setRegionalStrikes] = useState<RegionalStrike[]>([]);
  const [strikeUpdatedAt, setStrikeUpdatedAt] = useState('');
  const [territoryGeojson, setTerritoryGeojson] = useState<GeoJsonObject | null>(null);
  const [territoryStatus, setTerritoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/territory_geojson.json?_t=${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GeoJsonObject>;
      })
      .then((data) => {
        if (!cancelled) {
          setTerritoryGeojson(data);
          setTerritoryStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setTerritoryStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function loadRegionalStrikes() {
      const t = Date.now();
      Promise.all([
        fetch(`/data/rss_twitter.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch(`/data/rss_facebook.json?_t=${t}`).then((r) => (r.ok ? r.json() : { items: [] })),
      ])
        .then(([xData, fbData]) => {
          if (cancelled) return;
          const items = [
            ...(Array.isArray(xData?.items) ? xData.items : []),
            ...(Array.isArray(fbData?.items) ? fbData.items : []),
          ] as RssItem[];
          setRegionalStrikes(buildRegionalStrikes(items));
          setStrikeUpdatedAt(new Date().toISOString());
        })
        .catch(() => {
          if (!cancelled) setRegionalStrikes([]);
        });
    }

    loadRegionalStrikes();
    const interval = setInterval(loadRegionalStrikes, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const showScrollHint = useCallback(() => {
    setScrollHint(true);
  }, []);

  useEffect(() => {
    if (!scrollHint) return;
    const t = setTimeout(() => setScrollHint(false), 1800);
    return () => clearTimeout(t);
  }, [scrollHint]);

  const calculateDistance = (p1: [number, number], p2: [number, number]) => {
    const lat1 = p1[0];
    const lon1 = p1[1];
    const lat2 = p2[0];
    const lon2 = p2[1];
    const earthRadiusKm = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (measurePoints.length === 2) {
      setMeasurePoints([[lat, lng]]);
      setDistance(null);
      return;
    }

    if (measurePoints.length === 1) {
      const nextPoints: [number, number][] = [...measurePoints, [lat, lng]];
      setMeasurePoints(nextPoints);
      setDistance(calculateDistance(nextPoints[0], nextPoints[1]));
      return;
    }

    setMeasurePoints([[lat, lng]]);
  };

  return (
    <div className="w-full flex flex-col font-sans">
      <div className="flex justify-between items-center gap-3 mb-4 md:mb-6 border-b border-ink/10 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <MapIcon className="w-4 h-4 text-gold-ink shrink-0" />
          <span className="font-head font-semibold text-ink text-sm md:text-base truncate">Карта · регіональний OSINT-монітор</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 border border-ink/15 bg-white text-ink px-3.5 py-1.5 rounded-full text-[11px] hover:bg-surface-2 transition-colors font-semibold shrink-0"
        >
          {isSidebarOpen ? <CloseIcon className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
          <span className="hidden sm:inline">{isSidebarOpen ? 'Приховати панель' : 'Показати панель'}</span>
        </button>
      </div>

      <div className="relative w-full h-[520px] md:h-[800px] bg-[#0a0a0a] border border-ink/10 rounded-2xl overflow-hidden group shadow-sm">
        <div className={`absolute top-4 md:top-6 left-4 md:left-6 right-4 sm:right-auto z-[400] sm:w-64 md:w-72 max-h-[calc(100%-2rem)] md:max-h-[calc(100%-3rem)] overflow-y-auto space-y-3 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
          <div className="bg-white/95 backdrop-blur-xl border border-ink/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3 border-b border-ink/10 pb-2.5">
              <Activity className="w-3.5 h-3.5 text-gold-ink" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-ink">Статус карти</span>
            </div>
            <p className="text-[11px] text-ink-2 leading-relaxed">
              Точні військові координати не відображаються. Показані регіональні OSINT-індикатори та згадки за 7 днів.
            </p>
            <div className="mt-3 border border-ink/10 bg-surface-2 rounded-lg p-2.5 text-[11px] text-ink-2 leading-relaxed">
              Автооновлення кожні 5 хвилин із RSS/X та Facebook-стрічок. Останнє оновлення: {strikeUpdatedAt ? formatDate(strikeUpdatedAt) : 'н/д'}.
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-ink/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <RadioTower className="w-3.5 h-3.5 text-red-600" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-ink">Удари по РФ · 7 днів</span>
            </div>
            <div className="space-y-1.5 text-[12px] text-ink-2">
              {regionalStrikes.slice(0, 5).map((region) => (
                <div key={region.id} className="flex items-center justify-between gap-3 border-b border-ink/5 pb-1">
                  <span className="truncate">{region.label}</span>
                  <span className="text-red-600 font-bold tabular-nums">{region.count}</span>
                </div>
              ))}
              {regionalStrikes.length === 0 && (
                <div className="text-ink-2/70 leading-relaxed">За останні 7 днів немає регіональних згадок, що пройшли фільтр.</div>
              )}
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-ink/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Plane className="w-3.5 h-3.5 text-gold-ink" />
              <Anchor className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-ink">Військова інфраструктура</span>
            </div>
            <div className="space-y-1.5 text-[12px] text-ink-2">
              <div className="flex items-center justify-between border-b border-ink/5 pb-1">
                <span>Аеродроми РФ</span>
                <span className="text-gold-ink font-bold tabular-nums">{INFRASTRUCTURE_POINTS.filter((p) => p.kind === 'airfield').length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-ink/5 pb-1">
                <span>Морські контури</span>
                <span className="text-sky-600 font-bold tabular-nums">{INFRASTRUCTURE_POINTS.filter((p) => p.kind === 'naval').length}</span>
              </div>
              <p className="text-[10px] text-ink-2/70 leading-relaxed pt-0.5">
                Координати аеродромів з відкритих джерел (Wikipedia, GlobalSecurity). Морські контури — узагальнені.
              </p>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-ink/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <MapIcon className="w-3.5 h-3.5 text-gold-ink" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-ink">Шар території</span>
            </div>
            <div className="space-y-1.5 text-[12px] text-ink-2">
              <div className="flex items-center justify-between border-b border-ink/5 pb-1">
                <span>OWL MAPS</span>
                <span className={`font-semibold ${territoryStatus === 'ready' ? 'text-green-600' : territoryStatus === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {territoryStatusLabel(territoryStatus)}
                </span>
              </div>
              <div className="text-[10px] text-ink-2/70 leading-relaxed pt-0.5">
                Шар лишився як загальний контекст лінії контролю без додаткових зовнішніх точкових накладок.
              </div>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-xl border border-ink/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-ink">Дистанційна лінійка</span>
            </div>
            <p className="text-[11px] text-ink-2 leading-relaxed mb-3">
              Клікніть на мапу двічі, щоб виміряти відстань між двома точками.
            </p>
            {distance && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-orange-700 text-[12px] text-center font-bold">
                Відстань: {distance.toFixed(1)} км
              </div>
            )}
            <button
              onClick={() => {
                setMeasurePoints([]);
                setDistance(null);
              }}
              className="w-full mt-3 text-[11px] font-semibold text-ink-2/60 hover:text-ink transition-colors"
            >
              Очистити виміри
            </button>
          </div>
        </div>

        <div className="hidden md:block absolute bottom-6 left-6 z-[400] bg-white/95 text-ink p-4 border border-ink/10 rounded-2xl backdrop-blur-md pointer-events-none shadow-lg">
          <div className="flex items-center gap-2.5 mb-3 border-b border-ink/10 pb-2.5">
            <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
            <span className="tracking-wide uppercase text-[11px] font-semibold">Координати курсора</span>
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between gap-12 border-b border-ink/5 pb-1">
              <span className="text-ink-2">Широта</span>
              <span className="font-bold tabular-nums">{telemetry.lat.toFixed(6)}° N</span>
            </div>
            <div className="flex justify-between gap-12 border-b border-ink/5 pb-1">
              <span className="text-ink-2">Довгота</span>
              <span className="font-bold tabular-nums">{telemetry.lng.toFixed(6)}° E</span>
            </div>
            <div className="flex justify-between gap-12 pt-0.5">
              <span className="text-gold-ink font-semibold">Територія</span>
              <span className="text-ink-2">{territoryStatusLabel(territoryStatus)}</span>
            </div>
            <div className="flex justify-between gap-12 pt-0.5">
              <span className="text-red-600 font-semibold">Удари РФ</span>
              <span className="text-ink-2">{regionalStrikes.length} регіонів</span>
            </div>
            <div className="flex justify-between gap-12 pt-0.5">
              <span className="text-sky-600 font-semibold">Інфра</span>
              <span className="text-ink-2">{INFRASTRUCTURE_POINTS.length} маркерів</span>
            </div>
            <div className="flex justify-between gap-12 pt-0.5">
              <span className="text-orange-600 font-semibold">Вимір</span>
              <span className="text-ink-2">{measurePoints.length}/2 точки</span>
            </div>
          </div>
        </div>

        {/* Scroll-wheel hint overlay */}
        {scrollHint && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 text-white text-sm md:text-base font-medium px-6 py-3 rounded-full backdrop-blur-sm animate-fade-hint">
              Ctrl + скрол для масштабування
            </div>
          </div>
        )}

        <MapContainer
          center={[53.4, 43.2]}
          zoom={4}
          scrollWheelZoom={false}
          className="w-full h-full z-0"
          zoomControl={false}
        >
          <LayersControl position="bottomright">
            <LayersControl.BaseLayer name="Тактична темна">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CARTO"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Супутникова мапа">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; ESRI"
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name={`Контроль території (owlmaps)${territoryStatus === 'loading' ? ' ⟳' : territoryStatus === 'error' ? ' ✕' : ''}`}>
              {territoryGeojson ? (
                <TerritoryLayer geojson={territoryGeojson} />
              ) : (
                <GeoJSON data={{ type: 'FeatureCollection', features: [] } as GeoJsonObject} />
              )}
            </LayersControl.Overlay>
          </LayersControl>

          <ZoomControl position="topright" />
          <ScrollGuard onBlocked={showScrollHint} />
          <MapEvents
            onMouseMove={(lat, lng) => setTelemetry({ lat, lng })}
            onClick={(lat, lng) => handleMapClick(lat, lng)}
          />

          {INFRASTRUCTURE_POINTS.map((point) => {
            const isAirfield = point.kind === 'airfield';
            const isNaval = point.kind === 'naval';
            const color = isNaval ? '#38bdf8' : '#facc15';
            const radius = isAirfield ? 5 : 7;
            const kindLabel = isAirfield ? 'Аеродром' : isNaval ? 'Морський контур' : 'Авіаційний регіон';
            const badge = isAirfield ? '✈ Аеродром' : isNaval ? '⚓ Флот' : 'Авіа';
            return (
              <CircleMarker
                key={point.id}
                center={point.position}
                radius={radius}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1.8,
                  fillColor: color,
                  fillOpacity: 0.82,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <span className="text-[11px]">
                    {kindLabel} · <strong>{point.label}</strong>
                  </span>
                </Tooltip>
                <Popup className="tactical-popup">
                  <div className="p-4 bg-[#111111] text-white min-w-[260px] rounded-xl">
                    <div className="flex justify-between items-start mb-2.5 pb-2.5 border-b border-white/10 gap-3">
                      <h5 className="font-semibold text-white text-[13px] leading-snug">{point.label}</h5>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ color, background: `${color}20` }}>
                        {badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/65 leading-relaxed">{point.note}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {regionalStrikes.map((region) => {
            const radius = Math.min(16, 7 + region.count * 2);
            return (
              <CircleMarker
                key={`strike-${region.id}`}
                center={region.position}
                radius={radius}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: '#ef4444',
                  fillOpacity: 0.72,
                }}
              >
                <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                  <span className="text-[11px]">
                    <strong>{region.label}</strong> · {region.count} згадок
                  </span>
                </Tooltip>
                <Popup className="tactical-popup">
                  <div className="p-4 bg-[#111111] text-white min-w-[270px] rounded-xl">
                    <div className="flex justify-between items-start mb-2.5 pb-2.5 border-b border-white/10 gap-3">
                      <h5 className="font-semibold text-white text-[13px] leading-snug">{region.label}</h5>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold whitespace-nowrap">{region.count} / 7 днів</span>
                    </div>
                    <div className="space-y-2.5 text-[11px]">
                      <p className="text-white/55 leading-relaxed">OSINT-агрегація повідомлень про удари по території РФ. Маркер — не точна геолокація.</p>
                      {region.latestTitle && (
                        <p className="text-white/85 leading-relaxed border-t border-white/10 pt-2">{region.latestTitle}</p>
                      )}
                      <div className="flex justify-between border-t border-white/10 pt-2 text-[10px]">
                        <span className="text-white/40">Останнє</span>
                        <span className="text-white/70">{region.latestDate ? formatDate(region.latestDate) : 'н/д'}</span>
                      </div>
                      {region.latestUrl && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-white/40">Джерело</span>
                          <a href={region.latestUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">відкрити ↗</a>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {measurePoints.length === 2 && (
            <Polyline
              positions={measurePoints}
              pathOptions={{ color: '#f97316', weight: 2, dashArray: '10, 10' }}
            >
              <Tooltip permanent direction="center" className="measurement-tooltip">
                <span className="font-mono text-[10px] font-bold text-orange-500">{distance?.toFixed(1)} км</span>
              </Tooltip>
            </Polyline>
          )}

          {measurePoints.map((point, index) => (
            <Circle
              key={`measure-${index}`}
              center={point}
              radius={100}
              pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.5 }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 px-1 text-[11px] md:text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#facc15] border border-[#a68b0d]" />
          Аеродроми РФ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#38bdf8] border border-white/60" />
          Морські об'єкти
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white/60" />
          Удари по РФ (7 днів)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[3px] rounded bg-orange-500" />
          Вимірювальна лінійка
        </span>
        <span className="ml-auto text-ink-2/50 text-[10px] hidden md:inline">Ctrl + скрол для масштабування</span>
      </div>

      <style>{`
        .leaflet-container {
          background: #0a0a0a !important;
        }
        /* ── Popups ── */
        .tactical-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          color: white !important;
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45) !important;
          overflow: hidden !important;
        }
        .tactical-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .tactical-popup .leaflet-popup-tip {
          background: #111 !important;
        }
        /* ── Tooltips ── */
        .leaflet-tooltip {
          font-family: var(--font-sans, system-ui) !important;
          border-radius: 8px !important;
          padding: 4px 10px !important;
          font-size: 11px !important;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25) !important;
        }
        .measurement-tooltip {
          background: rgba(17, 17, 17, 0.92) !important;
          border: 1px solid rgba(249, 115, 22, 0.35) !important;
          box-shadow: none !important;
        }
        .measurement-tooltip .leaflet-tooltip-content {
          margin: 4px 8px !important;
        }
        /* ── Layer control ── */
        .leaflet-control-layers {
          background: rgba(255, 255, 255, 0.95) !important;
          color: #0b0b0c !important;
          border: 1px solid rgba(11, 11, 12, 0.1) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(11, 11, 12, 0.12) !important;
          font-family: var(--font-sans, system-ui) !important;
          padding: 6px 4px !important;
        }
        .leaflet-control-layers label {
          font-size: 12px !important;
        }
        /* ── Zoom control ── */
        .leaflet-control-zoom {
          border: 1px solid rgba(11,11,12,0.1) !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 16px rgba(11,11,12,0.1) !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.95) !important;
          color: #0b0b0c !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
          border: none !important;
          border-bottom: 1px solid rgba(11,11,12,0.08) !important;
        }
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f4f5f3 !important;
        }
        /* ── Scroll hint animation ── */
        @keyframes fadeHint {
          0% { opacity: 0; transform: scale(0.92); }
          15% { opacity: 1; transform: scale(1); }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-fade-hint {
          animation: fadeHint 1.8s ease-out forwards;
        }
        /* ── Attribution ── */
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(255,255,255,0.7) !important;
          border-radius: 6px 0 0 0 !important;
          padding: 2px 6px !important;
        }
      `}</style>
    </div>
  );
}
