import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Refinery = {
  name: string;
  region: string;
  lat: number;
  lon: number;
  strikes: number; // приблизна кількість зафіксованих уражень
  short?: string; // короткий підпис для найбільш уражених
};

type Plant = {
  name: string;
  city: string;
  lat: number;
  lon: number;
  role: string;
};

// Уражені НПЗ (за відкритими зведеннями 2024–2026; кількість уражень — оцінка).
const REFINERIES: Refinery[] = [
  { name: 'Рязанський НПЗ', region: 'Рязанська обл.', lat: 54.62, lon: 39.74, strikes: 5, short: 'Рязань' },
  { name: 'Новокуйбишевський НПЗ', region: 'Самарська обл.', lat: 53.10, lon: 49.95, strikes: 4, short: 'Новокуйбишевськ' },
  { name: 'Волгоградський НПЗ', region: 'Волгоградська обл.', lat: 48.78, lon: 44.62, strikes: 4, short: 'Волгоград' },
  { name: 'НПЗ «Кіріші» (Кінеф)', region: 'Ленінградська обл.', lat: 59.45, lon: 32.02, strikes: 3, short: 'Кіріші' },
  { name: 'Туапсинський НПЗ', region: 'Краснодарський край', lat: 44.10, lon: 39.08, strikes: 4, short: 'Туапсе' },
  { name: 'Куйбишевський НПЗ', region: 'Самарська обл.', lat: 53.20, lon: 50.15, strikes: 3 },
  { name: 'Сизранський НПЗ', region: 'Самарська обл.', lat: 53.16, lon: 48.47, strikes: 3 },
  { name: 'Саратовський НПЗ', region: 'Саратовська обл.', lat: 51.53, lon: 46.00, strikes: 3 },
  { name: 'Уфимський кластер НПЗ', region: 'Башкортостан', lat: 54.74, lon: 56.00, strikes: 3 },
  { name: 'НПЗ «Лукойл-Нижегороднафтооргсинтез»', region: 'Кстово, Н. Новгород', lat: 56.13, lon: 44.18, strikes: 3 },
  { name: 'Ярославський НПЗ (Славнєфть)', region: 'Ярославська обл.', lat: 57.55, lon: 39.85, strikes: 2 },
  { name: 'Ухтинський НПЗ', region: 'Республіка Комі', lat: 63.55, lon: 53.70, strikes: 1 },
  { name: 'Краснодарський НПЗ', region: 'Краснодарський край', lat: 45.04, lon: 38.98, strikes: 2 },
  { name: 'Афіпський НПЗ', region: 'Краснодарський край', lat: 44.90, lon: 38.84, strikes: 3 },
  { name: 'Орський НПЗ', region: 'Оренбурзька обл.', lat: 51.23, lon: 58.57, strikes: 2 },
  { name: 'Московський НПЗ (Капотня)', region: 'Москва', lat: 55.63, lon: 37.80, strikes: 2 },
];

// Чотири підприємства важкого машинобудування, на які замикається ремонт.
const PLANTS: Plant[] = [
  { name: 'Волгограднєфтємаш', city: 'Волгоград', lat: 48.71, lon: 44.51, role: 'Ректифікаційні колони — до 600 т' },
  { name: 'Уралхіммаш', city: 'Єкатеринбург', lat: 56.78, lon: 60.70, role: 'Вакуумні колони, реакторне обладнання' },
  { name: 'Іжорські заводи', city: 'Колпіно, СПб', lat: 59.75, lon: 30.60, role: 'Реакторні посудини найвищого класу' },
  { name: 'Салаватнєфтємаш', city: 'Салават, Башкортостан', lat: 53.36, lon: 55.92, role: 'Теплообмінники, сепаратори, ємності' },
];

const radiusFor = (strikes: number) => 5 + strikes * 1.6;

export default function RefineryMap() {
  return (
    <div className="refinery-map">
      <div className="rm-head">
        <div className="figure-label">Карта / географія кампанії</div>
        <h3 className="rm-title">Де б'ють і де лагодять</h3>
        <p className="rm-sub">
          Уражені НПЗ (помаранчеві, розмір — за кількістю зафіксованих уражень) та чотири заводи важкого
          машинобудування (золоті), на яких замикається ремонт корпусного обладнання.
        </p>
      </div>
      <div className="rm-canvas">
        <div className="rm-stats">
          <span><b>40+</b> уражених НПЗ</span>
          <span><b>до 5×</b> повторних ударів</span>
          <span><b>4</b> заводи ремонту</span>
        </div>
        <MapContainer
          center={[55, 47]}
          zoom={4}
          minZoom={3}
          maxZoom={7}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#eef0ec' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {REFINERIES.map((r) => {
            const hot = r.strikes >= 4;
            return (
              <CircleMarker
                key={r.name}
                center={[r.lat, r.lon]}
                radius={radiusFor(r.strikes)}
                pathOptions={{
                  color: '#c2410c',
                  weight: 1.5,
                  fillColor: '#ea580c',
                  fillOpacity: 0.55,
                  className: hot ? 'rm-hot' : undefined,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                  <span className="rm-tip">
                    <strong>{r.name}</strong>
                    <br />
                    {r.region}
                    <br />
                    Зафіксовано уражень: ~{r.strikes}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}
          {/* Постійні підписи для найбільш уражених — окремий прозорий шар,
              щоб не конфліктувати з hover-тултіпом основного маркера. */}
          {REFINERIES.filter((r) => r.strikes >= 4 && r.short).map((r) => (
            <CircleMarker
              key={`lbl-${r.name}`}
              center={[r.lat, r.lon]}
              radius={0}
              pathOptions={{ opacity: 0, fillOpacity: 0, interactive: false }}
            >
              <Tooltip permanent direction="right" offset={[radiusFor(r.strikes), 0]} className="rm-label" opacity={1}>
                {r.short}
              </Tooltip>
            </CircleMarker>
          ))}
          {PLANTS.map((p) => (
            <CircleMarker
              key={p.name}
              center={[p.lat, p.lon]}
              radius={8}
              pathOptions={{ color: '#8a6a0e', weight: 2, fillColor: '#c9a227', fillOpacity: 0.85 }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                <span className="rm-tip">
                  <strong>{p.name}</strong>
                  <br />
                  {p.city}
                  <br />
                  {p.role}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="rm-legend">
        <span className="rm-leg"><i className="rm-sw rm-sw-hit" />Уражений НПЗ</span>
        <span className="rm-leg"><i className="rm-sw rm-sw-plant" />Завод важкого машинобудування (ремонт)</span>
      </div>
      <p className="rm-cap">
        Положення об'єктів — за відкритими даними. Кількість уражень — оцінка на основі публічних зведень
        ГУР, Генштабу ЗСУ та галузевих трекерів; не претендує на вичерпність.
      </p>
    </div>
  );
}
