import { motion } from 'motion/react';
import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import SupportCard from './components/SupportCard';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Activity, Database, Shield, Terminal, Rss, Target, BarChart3, MapPinned, Table2, RadioTower, Home, Map as MapIcon, Radio, MoreHorizontal, ChevronDown, X, Info } from 'lucide-react';
import { Post, InvestigationArticle } from './types';
import { formatPreview, normalizePosts, postTelegramUrl, resolveImageUrl } from './lib/posts';
import { setSeo } from './lib/seo';

const MapService = lazy(() => import('./components/MapService'));

// ── Color tokens ──────────────────────────────────────────────────────────────
// bg:    #ffffff  (dark military olive)
// card:  #ffffff
// dark:  #f4f5f3
// gold:  #c9a227
// text:  #ffffff

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

type RssItem = {
  id: string;
  title: string;
  titleUk?: string;
  url: string;
  summary: string;
  summaryUk?: string;
  publishedAt: string;
  author: string;
  handle: string;
  tags?: string[];
};

type PechalStats = {
  generatedAt: string;
  sourceUrl: string;
  counters: {
    today: number;
    last7Days: number;
    last30Days: number;
    totalBySerial?: number;
    totalApproxByMaxPostId: number;
  };
  latestProofs?: Array<{
    id: number;
    datetime: string;
    url: string;
    dayKyiv: string;
    serial?: number | null;
  }>;
};

type SbsStatsPayload = {
  generatedAt: string;
  sourceUrl: string;
  latestDate: string;
  latestHour: number;
  collectedAt?: string;
  summary: {
    personnelKilled: number;
    personnelWounded: number;
    personnelCasualties: number;
    targetsHit: number;
    targetsDestroyed: number;
  };
  categories: Array<{
    id: number;
    label: string;
    hit: number;
    destroyed: number;
  }>;
  daily: Array<{
    date: string;
    hour: number;
    targetsHit: number;
    targetsDestroyed: number;
    personnelCasualties: number;
  }>;
  monthly: Array<{
    date: string;
    targetsHit: number;
    targetsDestroyed: number;
    personnelCasualties: number;
  }>;
  methodology?: string[];
};

type DeepstateTablePayload = {
  generatedAt: string;
  sourceUrl: string;
  latest: {
    day: string;
    occupiedKm2: number;
    occupiedPercent: number;
    diffKm2: number;
    text: string;
  } | null;
  rows: Array<{
    day: string;
    occupiedKm2: number;
    occupiedPercent: number;
    diffKm2: number;
    text: string;
  }>;
  areas: Array<{
    name: string;
    occupiedKm2: number;
    occupiedPercent: number;
    dailyAverageKm2: number;
  }>;
  recentWindowDays: number;
  netChangeKm2: number;
  maxAbsDiffKm2: number;
  methodology?: string[];
};

const SECTION_IDS = ['map', 'brigades', 'analytics', 'sbs', 'deepstate', 'investigations', 'rss', 'feed', 'contacts'] as const;
type SectionId = typeof SECTION_IDS[number];

type BrigadeDashboardItem = {
  id: string;
  title: string;
  titleUk?: string;
  summary?: string;
  summaryUk?: string;
  url: string;
  publishedAt: string;
  source: 'x' | 'facebook' | string;
  sourceLabel: string;
  origin: 'official' | 'mention';
  score?: number;
  strikeScore?: number;
  reorgScore?: number;
  isStrike?: boolean;
  isReorg?: boolean;
};

type BrigadeDashboardRow = {
  id: string;
  name: string;
  autoDiscovered?: boolean;
  officialItems: number;
  mentionItems: number;
  significantItems: number;
  strikeItems: number;
  reorgItems: number;
  hasOfficialFeed: boolean;
  items: BrigadeDashboardItem[];
};

type BrigadeDashboardPayload = {
  generatedAt: string;
  windowDays: number;
  totals: {
    units?: number;
    unitsWithOfficialFeeds?: number;
    autoDiscoveredUnits?: number;
    brigades: number;
    brigadesWithOfficialFeeds: number;
    officialItems: number;
    mentionItems: number;
    significantItems: number;
    strikeItems: number;
    reorgItems: number;
  };
  brigades: BrigadeDashboardRow[];
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [fbItems, setFbItems] = useState<RssItem[]>([]);
  const [brigadeDashboard, setBrigadeDashboard] = useState<BrigadeDashboardPayload | null>(null);
  const [pechalStats, setPechalStats] = useState<PechalStats | null>(null);
  const [sbsStats, setSbsStats] = useState<SbsStatsPayload | null>(null);
  const [deepstateTable, setDeepstateTable] = useState<DeepstateTablePayload | null>(null);
  const [investigations, setInvestigations] = useState<InvestigationArticle[]>([]);
  const [sharedItemId, setSharedItemId] = useState<string>('');
  const [rssSourceFilter, setRssSourceFilter] = useState<'all' | 'x' | 'facebook'>('all');
  const [rssTopicFilter, setRssTopicFilter] = useState('all');
  const [rssSearch, setRssSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function scrollToSection(id: SectionId, smooth = true) {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function openSection(id: SectionId) {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/', { replace: false });
      window.setTimeout(() => scrollToSection(id), 120);
      return;
    }
    scrollToSection(id);
  }

  useEffect(() => {
    setSeo({
      title: 'Стратегічний OSINT Монітор',
      description: 'Око Гора: OSINT-аналітика, аеророзвідка, інтерактивна мапа та розслідування відкритих джерел.',
      path: '/',
      type: 'website',
    });
  }, []);

  useEffect(() => {
    function loadData() {
      const t = Date.now();
      fetch(`/data/posts.json?_t=${t}`)
        .then(r => r.json())
        .then((data: Post[]) => setPosts(normalizePosts(data)))
        .catch(() => {});

      fetch(`/data/rss_twitter.json?_t=${t}`)
        .then(r => r.json())
        .then(data => setRssItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => {});

      fetch(`/data/rss_facebook.json?_t=${t}`)
        .then(r => r.json())
        .then(data => setFbItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => {});

      fetch(`/data/investigations.json?_t=${t}`)
        .then(r => r.json())
        .then((data: InvestigationArticle[]) => setInvestigations(Array.isArray(data) ? data : []))
        .catch(() => {});

      fetch(`/data/brigades_dashboard.json?_t=${t}`)
        .then(r => r.json())
        .then((data: BrigadeDashboardPayload) => setBrigadeDashboard(data && Array.isArray(data.brigades) ? data : null))
        .catch(() => {});

      fetch(`/data/pechalbeda_stats.json?_t=${t}`)
        .then(r => r.json())
        .then((data: PechalStats) => setPechalStats(data && data.counters ? data : null))
        .catch(() => {});

      fetch(`/data/sbs_stats_snapshot.json?_t=${t}`)
        .then(r => r.json())
        .then((data: SbsStatsPayload) => setSbsStats(data && data.summary ? data : null))
        .catch(() => {});

      fetch(`/data/deepstate_table.json?_t=${t}`)
        .then(r => r.json())
        .then((data: DeepstateTablePayload) => setDeepstateTable(data && Array.isArray(data.rows) ? data : null))
        .catch(() => {});
    }

    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const rawPath = (location.pathname || '').replace(/^\/+/, '').toLowerCase();
    if (!rawPath) return;
    if (!SECTION_IDS.includes(rawPath as SectionId)) return;
    navigate('/', { replace: true });
    window.setTimeout(() => scrollToSection(rawPath as SectionId, false), 80);
  }, [location.pathname, navigate]);

  function formatRssDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatNumber(value: number | undefined | null) {
    return Number(value || 0).toLocaleString('uk-UA');
  }

  function formatKm2(value: number | undefined | null) {
    const num = Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 1 }).replace(/\s/g, ' ');
    return `${num} км²`;
  }

  function formatSignedKm2(value: number | undefined | null) {
    const n = Number(value || 0);
    const sign = n > 0 ? '+' : '';
    const num = n.toLocaleString('uk-UA', { maximumFractionDigits: 2 }).replace(/\s/g, ' ');
    return `${sign}${num} км²`;
  }

  function formatSnapshotDate(iso: string | undefined) {
    if (!iso) return 'очікується';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function cleanRssText(text: string) {
    return (text || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\bhttps?:\/\/(?:pbs\.twimg\.com|pic\.twitter\.com)\S+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function shareLink(id: string, title: string, url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      setSharedItemId(id);
      setTimeout(() => setSharedItemId(''), 1800);
    } catch {
      // ignore user-cancelled share
    }
  }

  const dashboard = useMemo(() => {
    const now = Date.now();
    const days: string[] = [];
    const daySet = new Set<string>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      daySet.add(key);
    }

    const UKR_MONTHS: Record<string, number> = {
      січ: 0, лют: 1, бер: 2, кві: 3, тра: 4, чер: 5, лип: 6, сер: 7, вер: 8, жов: 9, лис: 10, гру: 11,
    };

    const parseLoosePostDate = (value: string): number => {
      const raw = (value || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
      const m = raw.match(/(\d{1,2})\s+([а-яіїєґ]{3,})\s+(\d{4})(?:\s*\/\s*(\d{1,2}):(\d{2}))?/u);
      if (!m) return Number.NaN;
      const day = Number(m[1]);
      const month = UKR_MONTHS[m[2].slice(0, 3)] ?? new Date().getMonth();
      const year = Number(m[3]);
      const hour = Number(m[4] || 0);
      const min = Number(m[5] || 0);
      return Date.UTC(year, month, day, hour, min);
    };

    type StrikeEvent = {
      day: string;
      source: 'X' | 'Facebook' | 'Telegram';
      oblast: string;
      headline: string;
      ts: number;
      url: string;
      sourceLabel: string;
    };

    const oblastAliases: Array<{ oblast: string; aliases: string[] }> = [
      { oblast: 'Харківська', aliases: ['харків', 'kharkiv'] },
      { oblast: 'Донецька', aliases: ['донецьк', 'donetsk'] },
      { oblast: 'Луганська', aliases: ['луган', 'luhansk', 'lugansk'] },
      { oblast: 'Сумська', aliases: ['суми', 'sumy'] },
      { oblast: 'Запорізька', aliases: ['запоріж', 'zaporizh'] },
      { oblast: 'Херсонська', aliases: ['херсон', 'kherson'] },
      { oblast: 'Дніпропетровська', aliases: ['дніпро', 'dnipro', 'дніпропетров', 'dnipropetrov'] },
      { oblast: 'Миколаївська', aliases: ['миколаїв', 'mykolaiv', 'nikolaev'] },
      { oblast: 'Одеська', aliases: ['одеса', 'odesa', 'odessa'] },
      { oblast: 'Київська', aliases: ['київ', 'kyiv'] },
      { oblast: 'Полтавська', aliases: ['полтав', 'poltava'] },
      { oblast: 'Чернігівська', aliases: ['черніг', 'chernihiv'] },
      { oblast: 'Крим', aliases: ['крим', 'crimea', 'севастопол', 'sevastopol'] },
      { oblast: 'РФ: Бєлгород', aliases: ['бєлгород', 'белгород', 'belgorod'] },
      { oblast: 'РФ: Курськ', aliases: ['курськ', 'kursk'] },
      { oblast: 'РФ: Брянськ', aliases: ['брянськ', 'bryansk'] },
      { oblast: 'РФ: Ростов', aliases: ['ростов', 'rostov'] },
      { oblast: 'РФ: Краснодар', aliases: ['краснодар', 'krasnodar', 'туапсе', 'tuapse'] },
    ];

    const STRIKE_RE = /(удар|влуч|уражен|знищен|strike|struck|hit|explosion|blast|attack|drone|missile|бпла)/i;

    const extractOblasts = (text: string): string[] => {
      const low = text.toLowerCase();
      const hit = oblastAliases
        .filter((x) => x.aliases.some((a) => low.includes(a)))
        .map((x) => x.oblast);
      return Array.from(new Set(hit));
    };

    const events: StrikeEvent[] = [];
    for (const item of rssItems) {
      const ts = new Date(item.publishedAt).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!daySet.has(day)) continue;
      const headline = cleanRssText(item.titleUk || item.title || '');
      const text = `${headline} ${cleanRssText(item.summaryUk || item.summary || '')}`;
      if (!STRIKE_RE.test(text)) continue;
      const hitOblasts = extractOblasts(text);
      for (const oblast of hitOblasts) {
        events.push({ day, source: 'X', oblast, headline, ts, url: item.url, sourceLabel: `@${item.handle || item.author || 'x-source'}` });
      }
    }
    for (const item of fbItems) {
      const ts = new Date(item.publishedAt).getTime();
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!daySet.has(day)) continue;
      const headline = cleanRssText(item.titleUk || item.title || '');
      const text = `${headline} ${cleanRssText(item.summaryUk || item.summary || '')}`;
      if (!STRIKE_RE.test(text)) continue;
      const hitOblasts = extractOblasts(text);
      for (const oblast of hitOblasts) {
        events.push({ day, source: 'Facebook', oblast, headline, ts, url: item.url, sourceLabel: item.author || 'Facebook source' });
      }
    }
    for (const post of posts) {
      const ts = parseLoosePostDate(post.date);
      if (Number.isNaN(ts) || now - ts > 7 * 24 * 60 * 60 * 1000) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      if (!daySet.has(day)) continue;
      const headline = (post.title || '').trim();
      const text = `${headline} ${post.text || ''}`;
      if (!STRIKE_RE.test(text)) continue;
      const hitOblasts = extractOblasts(text);
      for (const oblast of hitOblasts) {
        events.push({ day, source: 'Telegram', oblast, headline, ts, url: postTelegramUrl(post), sourceLabel: '@oko_gora' });
      }
    }

    const uniqueEvents: StrikeEvent[] = [];
    const seenEventKey = new Set<string>();
    for (const e of events.sort((a, b) => b.ts - a.ts)) {
      const key = `${e.day}|${e.oblast}|${e.source}|${e.headline.toLowerCase().trim()}`;
      if (seenEventKey.has(key)) continue;
      seenEventKey.add(key);
      uniqueEvents.push(e);
    }

    const oblastTotals = new Map<string, number>();
    for (const e of uniqueEvents) {
      oblastTotals.set(e.oblast, (oblastTotals.get(e.oblast) || 0) + 1);
    }
    const oblasts = Array.from(oblastTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([oblast]) => oblast);

    const byDayOblast: Record<string, Record<string, number>> = {};
    for (const d of days) {
      byDayOblast[d] = {};
      for (const o of oblasts) byDayOblast[d][o] = 0;
    }
    for (const e of uniqueEvents) {
      if (!oblasts.includes(e.oblast)) continue;
      byDayOblast[e.day][e.oblast] += 1;
    }

    const maxCell = Math.max(
      1,
      ...days.flatMap((d) => oblasts.map((o) => byDayOblast[d][o] || 0)),
    );
    const trend = days.map((d) => ({
      day: d,
      total: oblasts.reduce((acc, o) => acc + (byDayOblast[d][o] || 0), 0),
    }));
    const maxTrend = Math.max(1, ...trend.map(t => t.total));

    const concreteByOblast = oblasts.map((oblast) => {
      const samples = uniqueEvents
        .filter((e) => e.oblast === oblast)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 3)
        .map((e) => ({
          headline: e.headline,
          url: e.url,
          source: e.source,
          sourceLabel: e.sourceLabel,
          day: e.day,
        }));
      return { oblast, total: oblastTotals.get(oblast) || 0, samples };
    });

    const bySource = {
      x: uniqueEvents.filter(e => e.source === 'X').length,
      facebook: uniqueEvents.filter(e => e.source === 'Facebook').length,
      telegram: uniqueEvents.filter(e => e.source === 'Telegram').length,
    };

    return { days, oblasts, byDayOblast, maxCell, trend, maxTrend, total: uniqueEvents.length, concreteByOblast, bySource };
  }, [rssItems, fbItems, posts]);

  const sbsTrend = [...(sbsStats?.daily || [])].reverse().slice(-14);
  const sbsMaxDaily = Math.max(1, ...sbsTrend.map((row) => row.targetsHit));
  const sbsTopCategories = (sbsStats?.categories || []).slice(0, 8);
  const sbsMaxCategory = Math.max(1, ...sbsTopCategories.map((row) => row.hit + row.destroyed));
  const deepstateRows = deepstateTable?.rows.slice(0, 8) || [];
  const deepstateMaxAbs = Math.max(1, deepstateTable?.maxAbsDiffKm2 || 1);
  const heroSignals = [
    { label: 'Telegram-пости', value: posts.length, note: 'стрічка Око Гора' },
    { label: 'OSINT RSS', value: rssItems.length + fbItems.length, note: 'новинні джерела' },
    { label: 'Активні підрозділи', value: brigadeDashboard?.totals.unitsWithOfficialFeeds ?? brigadeDashboard?.totals.brigadesWithOfficialFeeds ?? 0, note: 'останні 3 доби' },
    { label: 'Події ударів', value: dashboard.total, note: '7 днів / з посиланнями' },
  ];
  const rssFeed = useMemo(() => {
    const normalized = [
      ...rssItems.map((item) => ({ ...item, feedSource: 'x' as const, sourceLabel: item.author || 'OSINT RSS' })),
      ...fbItems.map((item) => ({ ...item, feedSource: 'facebook' as const, sourceLabel: item.author || 'Facebook' })),
    ].map((item) => {
      const title = cleanRssText(item.titleUk || item.title || '');
      const summary = cleanRssText(item.summaryUk || item.summary || '');
      const tags = (item.tags?.length ? item.tags : ['OSINT', 'HUMINT', 'UKRAINE']).map((tag) => tag.toUpperCase());
      return {
        ...item,
        titleClean: title,
        summaryClean: summary,
        tagsClean: Array.from(new Set(tags)),
        ts: new Date(item.publishedAt).getTime() || 0,
      };
    }).sort((a, b) => b.ts - a.ts);

    const q = rssSearch.trim().toLowerCase();
    return normalized.filter((item) => {
      if (rssSourceFilter !== 'all' && item.feedSource !== rssSourceFilter) return false;
      if (rssTopicFilter !== 'all' && !item.tagsClean.includes(rssTopicFilter)) return false;
      if (!q) return true;
      return `${item.titleClean} ${item.summaryClean} ${item.author} ${item.handle} ${item.tagsClean.join(' ')}`.toLowerCase().includes(q);
    });
  }, [rssItems, fbItems, rssSourceFilter, rssTopicFilter, rssSearch]);
  const rssTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of [...rssItems, ...fbItems]) {
      const tags = (item.tags?.length ? item.tags : ['OSINT', 'HUMINT', 'UKRAINE']).map((tag) => tag.toUpperCase());
      for (const tag of tags.slice(0, 5)) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  }, [rssItems, fbItems]);
  const publishedInvestigations = useMemo(
    () => investigations.filter((item) => (item.status || 'published') === 'published'),
    [investigations],
  );
  const featuredInvestigation = publishedInvestigations.find((item) => item.id === 'INV-004') || publishedInvestigations[0];
  const investigationCards = publishedInvestigations.filter((item) => item.id !== featuredInvestigation?.id).slice(0, 5);

  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-gold/30 selection:text-ink font-sans overflow-x-hidden">

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-gold/10 bg-surface/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 text-xs md:text-sm font-medium tracking-wide">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gold rounded-lg flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-surface rounded-md animate-pulse" />
            </div>
            <Link to="/" className="font-bold text-ink hover:text-gold-ink transition-colors">Око Гора</Link>
          </div>
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6 text-ink/50">
            <Link to="/" className="hover:text-ink transition-colors">Головна</Link>
            <Link to="/targets" className="hover:text-ink transition-colors flex items-center gap-1 text-gold-ink font-bold">
              <Target className="w-3 h-3" /> БАЗА ЦІЛЕЙ
            </Link>
            <button type="button" onClick={() => openSection('map')} className="hover:text-ink transition-colors">Карта</button>
            <button type="button" onClick={() => openSection('brigades')} className="hover:text-ink transition-colors">Підрозділи</button>
            <button type="button" onClick={() => openSection('analytics')} className="hover:text-ink transition-colors">Аналітика</button>
            <button type="button" onClick={() => openSection('sbs')} className="hover:text-ink transition-colors">SBS</button>
            <button type="button" onClick={() => openSection('deepstate')} className="hover:text-ink transition-colors">DeepState</button>
            <button type="button" onClick={() => openSection('investigations')} className="hover:text-ink transition-colors">Розслідування</button>
            <button type="button" onClick={() => openSection('rss')} className="hover:text-ink transition-colors">RSS</button>
            <button type="button" onClick={() => openSection('feed')} className="hover:text-ink transition-colors">Стрічка</button>
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="hover:text-gold-ink transition-colors flex items-center gap-1 font-bold text-ink">
              ТЕЛЕГРАМ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          {/* Mobile: Telegram link (compact) */}
          <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
            className="md:hidden flex items-center gap-1 text-xs font-semibold text-gold-ink">
            Telegram <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="pt-14 md:pt-28 px-4 md:px-8 pb-6 md:pb-16 main-content-pad">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-[1800px] mx-auto"
        >

          {/* Hero Typography */}
          <motion.div variants={fadeIn} className="mb-10 md:mb-20 relative overflow-hidden">
            <div className="absolute inset-0 -z-20 pointer-events-none select-none hidden md:block">
              <img
                src="assets-zsu-patch.png"
                alt=""
                className="w-full h-full object-cover opacity-[0.1] grayscale contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-surface/30 via-surface/75 to-surface" />
            </div>
            <div className="absolute inset-0 -z-10 hidden md:flex items-center justify-center overflow-hidden pointer-events-none select-none">
              <motion.img
                src="oko_logo.png"
                alt=""
                initial={{ opacity: 0, scale: 1.1, rotate: -2 }}
                animate={{ opacity: 0.05, scale: 1, rotate: 0 }}
                transition={{ duration: 4, ease: 'easeOut' }}
                className="w-[80%] lg:w-[60%] max-w-[1200px] mix-blend-multiply"
              />
            </div>

            <p className="oko-eyebrow mb-3 md:mb-5 relative z-10">OSINT-моніторинг бойового простору</p>
            <h1 className="text-[16vw] md:text-[11vw] leading-[0.9] md:leading-[0.85] font-bold tracking-[-0.02em] mb-4 md:mb-7 relative z-10 text-ink">
              Око Гора
            </h1>
            <p className="mb-8 md:mb-12 max-w-2xl text-lg md:text-2xl leading-relaxed text-ink/75 relative z-10">
              Незалежний моніторинг, аеророзвідка та аналітика бойового простору на основі відкритих джерел.
            </p>

            {/* Ukrainian Armed Forces insignia strip — official Wikimedia SVGs */}
            <div className="grid grid-cols-6 gap-2 md:flex md:flex-wrap md:items-center md:gap-5 mb-10 relative z-10">
              <div className="flex flex-col items-center gap-1.5 group cursor-default" title="Нарукавний знак ЗСУ">
                <div className="w-full h-[52px] md:w-14 md:h-14 flex items-center justify-center border border-gold/30 rounded-2xl bg-gold/10 group-hover:border-gold/70 group-hover:bg-gold/20 transition-all duration-300 p-1">
                  <img
                    src="zsu-insignia.png"
                    alt="Нарукавний знак ЗСУ"
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                  />
                </div>
                <span className="text-[10px] font-medium text-gold-ink/80 group-hover:text-gold-ink transition-colors">ЗСУ</span>
              </div>
              {[
                { label: 'СВ',  title: 'Сухопутні війська',           url: 'https://upload.wikimedia.org/wikipedia/commons/3/36/%D0%9D%D0%97_%D0%A1%D0%92.svg' },
                { label: 'ПС',  title: 'Повітряні сили',              url: 'https://upload.wikimedia.org/wikipedia/commons/5/59/%D0%9D%D0%97_%D0%9F%D0%A1.svg' },
                { label: 'ВМС', title: 'Військово-морські сили',      url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/%D0%9D%D0%97_%D0%92%D0%9C%D0%A1.svg' },
                { label: 'ССО', title: 'Сили спеціальних операцій',   url: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/%D0%9D%D0%97_%D0%A1%D0%A1%D0%9E.svg' },
                { label: 'ДШВ', title: 'Десантно-штурмові війська',   url: 'https://upload.wikimedia.org/wikipedia/commons/8/81/%D0%9D%D0%97_%D0%92%D0%94%D0%92.svg' },
              ].map(branch => (
                <div key={branch.label} className="flex flex-col items-center gap-1.5 group cursor-default" title={branch.title}>
                  <div className="w-full h-[52px] md:w-14 md:h-14 flex items-center justify-center border border-gold/20 rounded-2xl bg-gold/5 group-hover:border-gold/60 group-hover:bg-gold/10 transition-all duration-300 p-1">
                    <img
                      src={branch.url}
                      alt={branch.title}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gold-ink/70 group-hover:text-gold-ink transition-colors">{branch.label}</span>
                </div>
              ))}
              <a
                href="https://t.me/oko_gora"
                target="_blank"
                rel="noreferrer"
                className="ml-auto hidden md:inline-flex items-center gap-1.5 font-mono text-[9px] text-gold-ink/55 hover:text-gold-ink uppercase tracking-widest transition-colors"
              >
                t.me/oko_gora <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
            <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-2 border-gold/80 rounded-r-2xl bg-surface-2/70 p-4 md:p-5">
              <div>
                <p className="oko-eyebrow mb-2">Платформа Telegram-каналу</p>
                <p className="text-ink/90 text-base md:text-xl font-bold leading-snug max-w-3xl">
                  Цифрова платформа Telegram-каналу про новини, карту, джерела та аналітику.
                </p>
              </div>
              <a
                href="https://t.me/oko_gora"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] self-start md:self-auto shrink-0 border border-gold/60 rounded-full bg-gold/12 px-5 py-3 text-sm font-medium text-gold-ink hover:bg-gold/20 hover:border-gold transition-colors"
              >
                Перейти в Telegram <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-14">
              {heroSignals.map((signal) => (
                <div key={signal.label} className="group relative overflow-hidden border border-ink/10 rounded-2xl bg-surface p-4 md:p-5 hover:border-gold/45 hover:shadow-[0_8px_28px_rgba(11,11,12,0.06)] transition-all duration-300">
                  <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold to-gold/15" />
                  <p className="text-[11px] md:text-xs font-medium uppercase tracking-wide text-ink/55">{signal.label}</p>
                  <p className="mt-2.5 text-3xl md:text-5xl font-bold tracking-tight text-ink tabular-nums">{formatNumber(signal.value)}</p>
                  <p className="mt-1.5 text-xs md:text-sm text-ink/55">{signal.note}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Interactive Investigations */}
          <motion.section id="investigations" variants={fadeIn} className="mb-16 md:mb-28 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
                <div>
                  <span className="oko-eyebrow mb-4">/ НОВИЙ РОЗДІЛ</span>
                  <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] leading-[1.1] md:leading-[1.04]">Інтерактивні розслідування</h2>
                </div>
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-widest text-ink/30 hover:text-gold-ink transition-colors">
                  Telegram-канал <ArrowUpRight className="inline w-3 h-3 ml-1" />
                </a>
              </div>

              <div className="mb-6 border border-gold/30 rounded-2xl bg-surface p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 border border-gold/40 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5 text-gold-ink" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/80">Розділ відкрито</p>
                    <p className="text-lg md:text-xl font-bold text-ink">Перші розслідування вже доступні.</p>
                    <p className="text-sm text-ink/55 mt-1">Матеріали виходять окремими кейсами з хронологією, таблицями, джерелами та короткими висновками.</p>
                  </div>
                </div>
              </div>

              {featuredInvestigation && (
                <article className="mb-5 bg-surface border border-gold/45 rounded-2xl p-6 md:p-8 lg:p-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end">
                    <div className="lg:col-span-8">
                      <p className="oko-eyebrow mb-4">{featuredInvestigation.code}</p>
                      <h3 className="text-3xl md:text-5xl font-bold tracking-[-0.018em] leading-[1.05] text-ink">{featuredInvestigation.title}</h3>
                      <p className="mt-4 text-base md:text-lg text-ink/60 max-w-3xl leading-relaxed">{featuredInvestigation.summary}</p>
                    </div>
                    <div className="lg:col-span-4 flex lg:justify-end">
                      <Link to={`/investigation/${featuredInvestigation.id}`} className="inline-flex items-center gap-2 border border-gold/50 rounded-full bg-gold/10 px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-gold-ink hover:bg-gold/20 transition-colors">
                        Читати розслідування <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </article>
              )}

              {investigationCards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {investigationCards.slice(0, 6).map(item => (
                  <article key={item.code} className="bg-surface border border-gold/20 rounded-2xl p-6 md:p-8 hover:border-gold/50 transition-colors">
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-gold-ink mb-4">{item.code}</p>
                    <h3 className="text-2xl font-bold tracking-[-0.018em] leading-snug mb-4 text-ink">{item.title}</h3>
                    <p className="text-ink/50 text-sm leading-relaxed">{item.summary}</p>
                    <div className="mt-4 flex items-center gap-4">
                      <Link to={`/investigation/${item.id}`} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/65 hover:text-gold-ink transition-colors">
                        Детально <ArrowUpRight className="w-3 h-3" />
                      </Link>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/45 hover:text-gold-ink transition-colors">
                          Джерело <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Map */}
          <motion.div id="map" variants={fadeIn} className="mb-16 md:mb-28 w-full scroll-mt-28">
            <Suspense fallback={
              <div className="w-full h-[500px] md:h-[800px] bg-surface-2 border border-gold/20 rounded-2xl flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/40 animate-pulse">ЗАВАНТАЖЕННЯ_МАПИ...</span>
              </div>
            }>
              <MapService />
            </Suspense>
          </motion.div>

          {/* System Utilities */}
          <motion.div variants={fadeIn} className="mb-16 md:mb-28">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Terminal */}
              <div className="lg:col-span-1 bg-surface-2 text-gold-ink p-6 font-mono text-[10px] leading-relaxed border border-gold/25 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 border-b border-gold/20 pb-2">
                  <Terminal className="w-3 h-3" />
                  <span className="uppercase tracking-widest text-[9px]">ПРЯМИЙ_ЕФІР_ДАННИХ</span>
                  <span className="ml-auto animate-pulse">●</span>
                </div>
                <div className="space-y-1 opacity-80 h-[120px] overflow-hidden text-ink/70">
                  <p>[оновлено] Telegram-стрічка каналу підтягується з posts.json</p>
                  <p>[оновлено] RSS з X/Facebook очищається від HTML і дублів</p>
                  <p>[мапа] Показуємо цілі, події з постів і відкриті стратегічні обʼєкти</p>
                  <p>[джерела] SBS та DeepState мають окремі посилання на оригінали</p>
                  <p>[важливо] Кожну важливу цифру краще перевіряти за джерелом</p>
                  <p className="animate-pulse text-gold-ink">_</p>
                </div>
                <div className="mt-8 pt-4 border-t border-gold/10 flex justify-between opacity-30 text-[8px] uppercase tracking-widest">
                  <span>ДАНІ: ВІДКРИТІ ДЖЕРЕЛА</span>
                  <span>ОНОВЛЕННЯ: АВТОМАТИЧНІ</span>
                </div>
              </div>

              {/* Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface border border-gold/20 rounded-2xl p-8 hover:border-gold/60 hover:bg-surface-3 transition-all duration-500 group relative">
                  <Activity className="w-8 h-8 mb-6 text-gold-ink/40 group-hover:text-gold-ink transition-colors" />
                  <h4 className="text-2xl font-bold mb-2 tracking-[-0.018em]">Горюшко · щоденне оновлення</h4>
                  <p className="text-sm text-ink/50 leading-snug mb-6">Автоматичний лічильник нових записів у каналі за поточний день і за 7 днів. Сумарне значення беремо з останнього номера у тексті поста, не з ID Telegram.</p>
                  <div className="grid grid-cols-3 gap-2 mb-6 font-mono text-center">
                    <div className="border border-gold/20 rounded-xl py-2">
                      <div className="text-lg font-bold text-gold-ink">{pechalStats?.counters.today ?? 0}</div>
                      <div className="text-[8px] uppercase tracking-widest text-ink/40">сьогодні</div>
                    </div>
                    <div className="border border-gold/20 rounded-xl py-2">
                      <div className="text-lg font-bold text-ink">{pechalStats?.counters.last7Days ?? 0}</div>
                      <div className="text-[8px] uppercase tracking-widest text-ink/40">7 днів</div>
                    </div>
                    <div className="border border-gold/20 rounded-xl py-2">
                      <div className="text-lg font-bold text-ink">{(pechalStats?.counters.totalBySerial ?? pechalStats?.counters.totalApproxByMaxPostId ?? 0).toLocaleString('uk-UA')}</div>
                      <div className="text-[8px] uppercase tracking-widest text-ink/40">сумарно*</div>
                    </div>
                  </div>
                  <div className="mb-5 border border-gold/18 rounded-2xl bg-surface-2/55 p-3 font-mono text-[9px] uppercase tracking-widest text-ink/42">
                    <div className="flex items-center justify-between gap-3">
                      <span>Оновлено</span>
                      <span className="text-ink/75">{formatSnapshotDate(pechalStats?.generatedAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Останній пост</span>
                      {pechalStats?.latestProofs?.[0]?.url ? (
                        <a href={pechalStats.latestProofs[0].url} target="_blank" rel="noreferrer" className="text-gold-ink hover:text-gold-ink transition-colors">
                          #{pechalStats.latestProofs[0].id}
                        </a>
                      ) : (
                        <span className="text-ink/45">н/д</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-ink/10">
                    <a href={pechalStats?.sourceUrl || 'https://t.me/s/pechalbeda200'} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-gold-ink hover:text-gold-ink transition-colors"><Shield className="w-3 h-3" /> Відкрити канал</a>
                    <span className="text-ink/30">*номер у пості</span>
                  </div>
                </div>

                <Link to="/targets" className="bg-surface border border-gold/20 rounded-2xl p-8 hover:border-gold/60 hover:bg-surface-3 transition-all duration-500 group relative block">
                  <Database className="w-8 h-8 mb-6 text-gold-ink/40 group-hover:text-gold-ink transition-colors" />
                  <h4 className="text-2xl font-bold mb-2 tracking-[-0.018em]">База цілей</h4>
                  <p className="text-sm text-ink/50 leading-snug mb-8">Каталог НПЗ, авіабаз, складів і об'єктів ВПК Росії з координатами та статусом ураження.</p>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-widest pt-4 border-t border-ink/10">
                    <span className="flex items-center gap-2 text-gold-ink"><Shield className="w-3 h-3" /> 38+ ОБ'ЄКТІВ</span>
                    <span className="text-ink/30 group-hover:text-gold-ink flex items-center gap-1 transition-colors">ВІДКРИТИ <ArrowUpRight className="w-3 h-3" /></span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Dashboard strip */}
            <div className="mt-8 aspect-[21/4] w-full bg-surface-2 relative overflow-hidden group border border-gold/10 rounded-2xl">
              <img
                src="ui_dashboard.png"
                alt=""
                className="w-full h-full object-cover opacity-30 grayscale group-hover:opacity-50 group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-surface-2 via-transparent to-surface-2" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-gold-ink/30 font-mono text-[10px] tracking-[0.5em] uppercase">
                  Сайт збирає відкриті дані та дає швидкі переходи до джерел
                </div>
              </div>
            </div>
          </motion.div>

          {/* Brigades Dashboard */}
          <motion.section id="brigades" variants={fadeIn} className="mb-16 md:mb-28 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
                <div>
                  <span className="oko-eyebrow mb-4">/ UNITS DASHBOARD</span>
                  <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] leading-[1.1] md:leading-[1.04]">Активні підрозділи: ураження та реорганізація</h2>
                  <p className="mt-4 text-ink/60 max-w-4xl text-sm leading-relaxed">
                    Автоматичний моніторинг офіційних Telegram-каналів українських підрозділів (бригади, корпуси, полки та командування) за останні дні. Показуємо тільки ті підрозділи, що реально публікували оновлення в цей період.
                  </p>
                </div>
                <div className="bg-surface-2 border border-gold/20 rounded-2xl px-6 py-5 min-w-[260px]">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70">Статус вибірки</p>
                  <p className="text-xl font-bold tracking-tight text-ink">
                    {(brigadeDashboard?.totals.unitsWithOfficialFeeds ?? brigadeDashboard?.totals.brigadesWithOfficialFeeds ?? 0)}
                    /
                    {(brigadeDashboard?.totals.units ?? brigadeDashboard?.totals.brigades ?? 0)} активних
                  </p>
                  <p className="mt-1 text-xs text-ink/45">Ураження: {brigadeDashboard?.totals.strikeItems ?? 0}</p>
                  <p className="text-xs text-ink/45">Реорганізація: {brigadeDashboard?.totals.reorgItems ?? 0}</p>
                  <p className="text-xs text-ink/45">Автознайдено підрозділів: {brigadeDashboard?.totals.autoDiscoveredUnits ?? 0}</p>
                  <p className="mt-1 text-xs text-ink/45">Оновлено: {brigadeDashboard?.generatedAt ? formatRssDate(brigadeDashboard.generatedAt) : 'очікується...'}</p>
                </div>
              </div>

              {!brigadeDashboard || !brigadeDashboard.brigades.length ? (
                <div className="border border-gold/20 rounded-2xl bg-surface p-8 font-mono text-xs uppercase tracking-widest text-ink/40">
                  Дані дашборду підрозділів ще формуються. Запусти синхронізацію або зачекай автооновлення.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {brigadeDashboard.brigades.map((row) => (
                    <article key={row.id} className="bg-surface-3 border border-gold/20 rounded-2xl p-5 md:p-6">
                      <h3 className="text-xl font-extrabold leading-snug mb-4">
                        {row.name}
                        {row.autoDiscovered ? <span className="ml-2 text-[10px] align-middle px-2 py-0.5 border border-emerald-400/40 rounded-full text-emerald-300 font-mono uppercase tracking-widest">auto</span> : null}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 font-mono text-center">
                        <div className="border border-gold/20 rounded-xl py-2">
                          <div className="text-base font-bold text-gold-ink">{row.officialItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-ink/40">офіційні</div>
                        </div>
                        <div className="border border-gold/20 rounded-xl py-2">
                          <div className="text-base font-bold text-ink">{row.mentionItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-ink/40">згадки</div>
                        </div>
                        <div className="border border-gold/20 rounded-xl py-2">
                          <div className="text-base font-bold text-ink">{row.significantItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-ink/40">значимі</div>
                        </div>
                        <div className="border border-gold/20 rounded-xl py-2">
                          <div className="text-base font-bold text-ink">{row.strikeItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-ink/40">ураження</div>
                        </div>
                        <div className="border border-gold/20 rounded-xl py-2">
                          <div className="text-base font-bold text-ink">{row.reorgItems}</div>
                          <div className="text-[8px] uppercase tracking-widest text-ink/40">реорганізація</div>
                        </div>
                      </div>

                      {row.items.length === 0 ? (
                        <p className="text-sm text-ink/45 leading-relaxed">За останні 3 доби не знайдено релевантних постів у доступних публічних фідах.</p>
                      ) : (
                        <div className="space-y-3">
                          {row.items.slice(0, 3).map((item) => (
                            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block border border-ink/10 rounded-xl p-3 hover:border-gold/45 transition-colors">
                              <div className="flex items-center justify-between mb-2 font-mono text-[9px] tracking-widest uppercase">
                                <span className={item.origin === 'official' ? 'text-gold-ink' : 'text-ink/50'}>{item.origin === 'official' ? 'Офіційний канал' : 'Моніторинг згадок'}</span>
                                <span className="text-ink/35">{formatRssDate(item.publishedAt)}</span>
                              </div>
                              <p className="text-sm text-ink/80 leading-snug">{formatPreview(item.titleUk || item.title || '', 130)}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.isStrike && (
                                  <span className="px-2 py-0.5 border border-gold/40 rounded-full text-[9px] font-mono uppercase tracking-widest text-gold-ink">Ураження</span>
                                )}
                                {item.isReorg && (
                                  <span className="px-2 py-0.5 border border-sky-400/40 rounded-full text-[9px] font-mono uppercase tracking-widest text-sky-300">Реорганізація</span>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* 7D Dashboard */}
          <motion.section id="analytics" variants={fadeIn} className="mb-16 md:mb-28 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="mb-8">
                <span className="oko-eyebrow mb-4">/ МОНІТОРИНГ ВІДКРИТИХ ДЖЕРЕЛ</span>
                <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] leading-[1.1] md:leading-[1.04]">Карта згадок про удари</h2>
                <p className="mt-4 text-ink/60 max-w-3xl text-sm md:text-base leading-relaxed">Скільки разів за останні 7 днів у відкритих джерелах згадували удари — у розрізі областей і днів. Це міра інформаційної активності навколо теми, а не реєстр підтверджених влучань.</p>
              </div>

              {/* Key disclaimer — the section is mention-intensity, not confirmed strikes */}
              <div className="mb-8 flex items-start gap-3 border border-gold/35 rounded-2xl bg-gold-soft px-5 py-4">
                <Info className="w-5 h-5 text-gold-ink shrink-0 mt-0.5" />
                <p className="text-sm text-ink/75 leading-relaxed">
                  <span className="font-semibold text-ink">Як читати:</span> одне число = одна унікальна згадка про удар у стрічці (Telegram, X, Facebook), а не одне підтверджене влучання. Один реальний епізод може дати кілька згадок у різних каналах. Кожен приклад нижче має пряме посилання на першоджерело.
                </p>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="border border-gold/25 bg-surface-2 rounded-2xl p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-2">Усього згадок · 7 днів</p>
                  <p className="text-3xl md:text-4xl font-bold tracking-[-0.01em] text-gold-ink tabular-nums">{dashboard.total}</p>
                </div>
                <div className="border border-ink/10 bg-surface-2 rounded-2xl p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-2">Областей у вибірці</p>
                  <p className="text-3xl md:text-4xl font-bold tracking-[-0.01em] text-ink tabular-nums">{dashboard.oblasts.length}</p>
                </div>
                <div className="border border-ink/10 bg-surface-2 rounded-2xl p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-2">Згадок за добу · сер.</p>
                  <p className="text-3xl md:text-4xl font-bold tracking-[-0.01em] text-ink tabular-nums">{dashboard.days.length ? (dashboard.total / dashboard.days.length).toFixed(1) : '0.0'}</p>
                </div>
                <div className="border border-ink/10 bg-surface-2 rounded-2xl p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-2">Пік за добу</p>
                  <p className="text-3xl md:text-4xl font-bold tracking-[-0.01em] text-ink tabular-nums">{dashboard.maxTrend}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-surface-2 border border-gold/20 rounded-2xl p-6 md:p-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-2">Теплокарта · день × область</h3>
                  <p className="text-xs text-ink/45 mb-4">Рядок — день, стовпчик — область. Що темніша клітинка, то більше згадок про удари в цей день у цій області.</p>
                  <div className="space-y-2">
                    {dashboard.days.map((day) => (
                      <div key={day} className="grid gap-2 items-center" style={{ gridTemplateColumns: `70px repeat(${Math.max(1, dashboard.oblasts.length)}, minmax(0, 1fr))` }}>
                        <span className="font-mono text-[10px] text-ink/35 uppercase">{day.slice(5)}</span>
                        {dashboard.oblasts.map((oblast) => {
                          const value = dashboard.byDayOblast[day][oblast] || 0;
                          const alpha = value === 0 ? 0.06 : 0.18 + (value / dashboard.maxCell) * 0.82;
                          return (
                            <div key={`${day}-${oblast}`} className="h-8 border border-gold/20 rounded-lg flex items-center justify-between px-2" style={{ backgroundColor: `rgba(201,162,39,${alpha})` }}>
                              <span className="font-mono text-[9px] uppercase text-ink/70 truncate">{oblast.replace('РФ: ', '')}</span>
                              <span className="font-mono text-[10px] font-bold text-ink">{value}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-surface border border-gold/20 rounded-2xl p-6 md:p-8">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-2">Згадок за добу</h3>
                  <p className="text-xs text-ink/45 mb-4">Сумарна кількість згадок про удари за кожну добу — по всіх областях вибірки разом.</p>
                  <div className="space-y-2">
                    {dashboard.trend.map((t) => (
                      <div key={t.day} className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-ink/35 w-14">{t.day.slice(5)}</span>
                        <div className="h-3 bg-gold transition-all" style={{ width: `${Math.max(6, (t.total / dashboard.maxTrend) * 100)}%` }} />
                        <span className="font-mono text-[10px] text-ink/75">{t.total}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mt-8 mb-3">Топ-області</h3>
                  <div className="space-y-2">
                    {dashboard.concreteByOblast.slice(0, 6).map((row) => (
                      <div key={row.oblast} className="flex items-center justify-between border-b border-ink/10 pb-1">
                        <span className="text-ink/70 text-sm truncate">{row.oblast}</span>
                        <span className="font-mono text-[10px] text-gold-ink">{row.total}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mt-8 mb-3">Джерела (7 днів)</h3>
                  <div className="space-y-2 font-mono text-[10px] uppercase tracking-widest">
                    <div className="flex items-center justify-between border-b border-ink/10 pb-1"><span className="text-ink/60">X / Twitter</span><span className="text-gold-ink">{dashboard.bySource.x}</span></div>
                    <div className="flex items-center justify-between border-b border-ink/10 pb-1"><span className="text-ink/60">Facebook</span><span className="text-gold-ink">{dashboard.bySource.facebook}</span></div>
                    <div className="flex items-center justify-between border-b border-ink/10 pb-1"><span className="text-ink/60">Telegram</span><span className="text-gold-ink">{dashboard.bySource.telegram}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-surface-2 border border-gold/20 rounded-2xl p-6 md:p-8">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-2">Приклади згадок по областях</h3>
                <p className="text-xs text-ink/45 mb-4">Реальні заголовки з джерел із датою та автором. Клік відкриває першоджерело у новій вкладці.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboard.concreteByOblast.map((row) => (
                    <div key={row.oblast} className="border border-gold/20 rounded-2xl bg-surface p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-gold-ink">{row.oblast}</span>
                        <span className="font-mono text-[10px] text-ink/50">{row.total} згадок</span>
                      </div>
                      <div className="space-y-2">
                        {row.samples.length === 0 ? (
                          <p className="text-xs text-ink/40">Немає заголовків у вікні 7 днів.</p>
                        ) : row.samples.map((s) => (
                          <a key={`${row.oblast}-${s.day}-${s.url}`} href={s.url} target="_blank" rel="noreferrer" className="block text-sm text-ink/80 leading-snug hover:text-gold-ink transition-colors">
                            • [{s.source}] {s.headline}
                            <span className="ml-1 text-ink/40 font-mono text-[10px]">({s.day.slice(5)} · {s.sourceLabel})</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 bg-surface-2 border border-gold/20 rounded-2xl p-6 md:p-8">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-4">Методологія підрахунку</h3>
                <p className="text-sm text-ink/55 leading-relaxed mb-4">Блок варто читати як моніторинг інформаційного навантаження по темі ударів. Один і той самий реальний епізод може дати кілька окремих згадок у різних джерелах, а окремі згадки можуть описувати наслідки, а не момент удару.</p>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-ink/75 leading-relaxed">
                  <li>Збираємо пости за останні 7 діб із Telegram, X і Facebook.</li>
                  <li>Враховуємо лише пости з маркерами удару: `удар`, `влуч`, `strike`, `missile`, `бпла` тощо.</li>
                  <li>Визначаємо область через словник гео-аліасів у тексті.</li>
                  <li>Видаляємо дублікати подій за ключем: день + область + джерело + заголовок.</li>
                  <li>Кожен пункт має пряме посилання на пост або сторінку, звідки взята інформація.</li>
                </ol>
              </div>
            </div>
          </motion.section>

          {/* SBS Stats */}
          <motion.section id="sbs" variants={fadeIn} className="mb-16 md:mb-28 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <span className="oko-eyebrow mb-4">/ SBS STATS</span>
                  <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] leading-[1.1] md:leading-[1.04]">SBS: ураження за добу</h2>
                  <p className="mt-4 text-ink/68 max-w-4xl text-sm md:text-base leading-relaxed">
                    Тут показана відкрита статистика SBS у зручному вигляді. Беремо останній доступний запис за добу, показуємо кількість уражених і знищених цілей, категорії техніки та посилання на оригінальну сторінку.
                  </p>
                </div>
                <a href="https://foosint.github.io/sbs-stats/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-gold/60 rounded-2xl bg-gold/12 px-4 py-2 font-mono text-[11px] md:text-xs tracking-widest uppercase text-gold-ink hover:bg-gold/20 hover:border-gold transition-colors">
                  Відкрити джерело <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="relative overflow-hidden border border-gold/25 rounded-2xl bg-surface-2">
                <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(201,162,39,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.12) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
                <div className="absolute -right-28 -top-28 w-[520px] h-[520px] border border-gold/20 rounded-full" />
                <div className="relative grid grid-cols-1 xl:grid-cols-12 gap-6 p-5 md:p-8">
                  <div className="xl:col-span-4 border border-gold/25 rounded-2xl bg-surface-2/90 p-5 md:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70">останній зріз</p>
                        <h3 className="text-2xl md:text-3xl font-extrabold tracking-[-0.018em] leading-tight mt-2">Доба {sbsStats?.latestDate || '...'}</h3>
                        <p className="mt-2 text-xs text-ink/48">Година: {sbsStats ? `${sbsStats.latestHour}:00 UTC` : 'очікується'} · оновлено {formatSnapshotDate(sbsStats?.generatedAt)}</p>
                      </div>
                      <RadioTower className="w-8 h-8 text-gold-ink shrink-0" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-7">
                      {[
                        ['Цілі hit', sbsStats?.summary.targetsHit, 'за поточну добу'],
                        ['Знищено', sbsStats?.summary.targetsDestroyed, 'destroyed'],
                        ['Втрати о/с', sbsStats?.summary.personnelCasualties, 'killed + wounded'],
                        ['KIA', sbsStats?.summary.personnelKilled, 'за SBS DB'],
                      ].map(([label, value, note]) => (
                        <div key={label as string} className="border border-gold/18 rounded-2xl bg-surface/80 p-4">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-ink/42">{label}</p>
                          <p className="mt-2 text-3xl font-black tracking-tighter text-gold-ink tabular-nums">{formatNumber(value as number)}</p>
                          <p className="mt-1 text-[11px] text-ink/45">{note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 border-t border-ink/10 pt-5">
                      <p className="text-sm text-ink/65 leading-relaxed">
                    Це не прогноз і не оцінка редакції. Це зріз із відкритої бази: якщо джерело оновило дані, сайт підтягує новий JSON.
                      </p>
                    </div>
                  </div>
                  <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="lg:col-span-2 border border-gold/20 rounded-2xl bg-surface-2/85 p-5">
                      <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70">категорії уражень</p>
                          <h4 className="text-2xl font-extrabold tracking-[-0.018em] leading-tight mt-1">Що саме фіксує SBS</h4>
                        </div>
                        <BarChart3 className="w-7 h-7 text-gold-ink" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(sbsTopCategories.length ? sbsTopCategories : [{ id: 0, label: 'Очікуємо синхронізацію', hit: 0, destroyed: 0 }]).map((item) => (
                          <div key={item.id} className="border border-gold/18 rounded-2xl bg-surface/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-base md:text-lg font-extrabold tracking-[-0.018em] leading-tight">{item.label}</p>
                              <p className="font-mono text-[10px] text-gold-ink shrink-0">hit {formatNumber(item.hit)}</p>
                            </div>
                            <div className="mt-3 h-2 bg-ink/[0.05]">
                              <div className="h-full bg-gold" style={{ width: `${Math.max(3, ((item.hit + item.destroyed) / sbsMaxCategory) * 100)}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-ink/50">Знищено: <span className="font-bold text-ink/80">{formatNumber(item.destroyed)}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-gold/20 rounded-2xl bg-surface-2/80 p-5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-4">добовий тренд hit</p>
                      <div className="space-y-2">
                        {sbsTrend.map((row) => (
                          <div key={`${row.date}-${row.hour}`} className="grid grid-cols-[76px_1fr_52px] items-center gap-3">
                            <span className="font-mono text-[10px] text-ink/50">{row.date.slice(5)}</span>
                            <div className="h-3 bg-ink/[0.05]">
                              <div className="h-full bg-gold" style={{ width: `${Math.max(4, (row.targetsHit / sbsMaxDaily) * 100)}%` }} />
                            </div>
                            <span className="font-mono text-[10px] text-ink/75 text-right">{formatNumber(row.targetsHit)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-gold/20 rounded-2xl bg-surface-2/80 p-5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-4">методологія</p>
                      <div className="space-y-3 text-sm text-ink/67 leading-relaxed">
                        {(sbsStats?.methodology || [
                          'JSON ще не завантажено у браузері.',
                          'Після синхронізації тут буде методологія джерела.',
                        ]).map((line) => (
                          <p key={line} className="border-b border-ink/10 pb-2">{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* DeepState Table */}
          <motion.section id="deepstate" variants={fadeIn} className="mb-16 md:mb-28 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <span className="oko-eyebrow mb-4">/ DEEPSTATE TABLE</span>
                  <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] leading-[1.1] md:leading-[1.04]">DeepState: зміни фронту</h2>
                  <p className="mt-4 text-ink/68 max-w-4xl text-sm md:text-base leading-relaxed">
                    Тут коротко показані останні рядки з таблиці DeepState: скільки змінилося, який текст пояснення і де відкрити повну таблицю.
                  </p>
                </div>
                <a href="https://deepstat.xyz/table" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-gold/60 rounded-2xl bg-gold/12 px-4 py-2 font-mono text-[11px] md:text-xs tracking-widest uppercase text-gold-ink hover:bg-gold/20 hover:border-gold transition-colors">
                  Відкрити DeepState <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 border border-gold/25 rounded-2xl bg-surface-2 p-5 md:p-7 overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70">data-diff matrix</p>
                      <h3 className="text-2xl md:text-3xl font-extrabold tracking-[-0.018em] leading-tight mt-2">Останні зміни за таблицею</h3>
                      <p className="mt-2 text-sm text-ink/52">Мінус у DeepState означає збільшення окупованої площі, плюс — звільнення або уточнення на користь України.</p>
                    </div>
                    <MapPinned className="w-8 h-8 text-gold-ink" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                      ['Окуповано', formatKm2(deepstateTable?.latest?.occupiedKm2), `${deepstateTable?.latest?.occupiedPercent?.toFixed(3) || '0.000'}%`],
                      ['Останній diff', formatSignedKm2(deepstateTable?.latest?.diffKm2), `рядок: ${deepstateTable?.latest?.day || '...'}`],
                      ['Сума вікна', formatSignedKm2(deepstateTable?.netChangeKm2), `${deepstateTable?.recentWindowDays || 0} останніх рядків`],
                      ['Оновлено', formatSnapshotDate(deepstateTable?.generatedAt), 'локальний JSON'],
                    ].map(([label, value, note]) => (
                      <div key={label} className="border border-gold/18 rounded-2xl bg-surface-2/80 p-4">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-ink/42">{label}</p>
                        <p className="mt-2 text-lg sm:text-xl md:text-2xl font-black tracking-[-0.01em] text-gold-ink tabular-nums whitespace-nowrap">{value}</p>
                        <p className="mt-1 text-xs text-ink/48">{note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 min-h-[220px]">
                    {(deepstateRows.length ? deepstateRows : Array.from({ length: 8 }, (_, i) => ({ day: `${i + 1}`, diffKm2: 0, text: 'Очікуємо дані', occupiedKm2: 0, occupiedPercent: 0 }))).map((row, i) => {
                      const intensity = Math.max(0.12, Math.min(1, Math.abs(row.diffKm2) / deepstateMaxAbs));
                      const isRelease = row.diffKm2 > 0;
                      return (
                        <div
                          key={`${row.day}-${i}`}
                          className={`relative min-h-[120px] border p-3 flex flex-col justify-between ${isRelease ? 'border-sky-300/40 bg-sky-400/15' : 'border-gold/35 bg-gold/15'}`}
                          style={{ opacity: 0.48 + intensity * 0.52 }}
                          title={row.text}
                        >
                          <span className="font-mono text-[10px] text-ink/60">день {row.day}</span>
                          <span className={`text-base sm:text-sm md:text-xs lg:text-sm xl:text-base font-black tracking-[-0.01em] tabular-nums whitespace-nowrap ${isRelease ? 'text-sky-700' : 'text-gold-ink'}`}>{formatSignedKm2(row.diffKm2)}</span>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/38">{isRelease ? 'звільнення' : 'просування ворога'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 border border-ink/10 bg-surface-2/70 rounded-xl p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-2">останнє пояснення</p>
                    <p className="text-lg md:text-xl font-bold leading-snug text-ink">{deepstateTable?.latest?.text || 'Очікуємо синхронізацію таблиці DeepState.'}</p>
                  </div>
                </div>
                <div className="xl:col-span-5 border border-gold/25 rounded-2xl bg-surface-2 p-5 md:p-7">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70">table rows</p>
                      <h3 className="text-2xl font-extrabold tracking-[-0.018em] leading-tight mt-2">Пояснення з рядків</h3>
                    </div>
                    <Table2 className="w-7 h-7 text-gold-ink" />
                  </div>
                  <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                    {deepstateRows.map((row) => (
                      <div key={`${row.day}-${row.text}`} className="grid grid-cols-[1fr_auto] gap-4 items-start border-b border-ink/10 pb-3">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70">рядок {row.day} · {row.occupiedPercent.toFixed(3)}%</p>
                          <p className="text-base md:text-lg font-bold leading-snug mt-1">{row.text}</p>
                          <p className="text-xs text-ink/45 mt-1">Окупована площа: {formatKm2(row.occupiedKm2)}</p>
                        </div>
                        <span className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-1 shrink-0 ${row.diffKm2 > 0 ? 'border-sky-300/35 text-sky-200' : 'border-gold/35 text-gold-ink'}`}>{formatSignedKm2(row.diffKm2)}</span>
                      </div>
                    ))}
                    {deepstateRows.length === 0 && (
                      <p className="text-sm text-ink/55">JSON DeepState ще не завантажено. Після синхронізації тут зʼявляться останні рядки таблиці.</p>
                    )}
                  </div>
                  <a href="https://deepstat.xyz/table" target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-between border border-gold/30 rounded-2xl bg-gold/10 p-4 font-mono text-[10px] uppercase tracking-widest text-gold-ink hover:bg-gold/15 transition-colors">
                    Перейти до актуальної таблиці
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <div className="mt-4 space-y-2 text-xs text-ink/45 leading-relaxed">
                    {(deepstateTable?.methodology || []).map((line) => (
                      <p key={line}>• {line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* RSS / X feed */}
          <motion.section id="rss" variants={fadeIn} className="mb-16 md:mb-28 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <span className="oko-eyebrow mb-4">/ LIVE RSS</span>
                  <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] leading-[1.1] md:leading-[1.04]">RSS OSINT-стрічка</h2>
                  <p className="mt-4 text-ink/70 max-w-4xl text-sm md:text-base leading-relaxed font-medium">
                    Новини з українських та OSINT-видань (Українська Правда, Euromaidan Press, ArmyInform, UNIAN, Militarnyi) за останні дні про Україну, війну, підрозділи та удари. Текст очищається від HTML-вставок, картки сортуються за часом, а фільтри допомагають швидко знайти потрібну тему.
                  </p>
                </div>
                <a href="https://www.pravda.com.ua/" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 self-start lg:self-auto border border-gold/45 rounded-2xl bg-gold/10 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-gold-ink hover:bg-gold/16 transition-colors shrink-0">
                  Джерела новин <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="mb-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-5 border border-gold/20 rounded-2xl bg-surface-2/80 p-4 md:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-3">швидкий пошук</p>
                  <input
                    value={rssSearch}
                    onChange={(e) => setRssSearch(e.target.value)}
                    placeholder="Пошук: Pokrovsk, drone, СБС, reorg..."
                    className="w-full bg-surface-2 border border-gold/25 rounded-2xl px-4 py-3 text-base font-bold text-ink placeholder:text-ink/28 outline-none focus:border-gold/70 transition-colors"
                  />
                </div>
                <div className="xl:col-span-4 border border-gold/20 rounded-2xl bg-surface-2/80 p-4 md:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-3">джерело</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['all', 'Усі', rssItems.length + fbItems.length],
                      ['x', 'Новини', rssItems.length],
                      ['facebook', 'Facebook', fbItems.length],
                    ].map(([id, label, count]) => (
                      <button
                        key={id as string}
                        type="button"
                        onClick={() => setRssSourceFilter(id as 'all' | 'x' | 'facebook')}
                        className={`border px-3 py-2 text-left transition-colors ${rssSourceFilter === id ? 'border-gold bg-gold/18 text-gold-ink' : 'border-ink/10 bg-white/[0.03] text-ink/52 hover:text-ink hover:border-gold/40'}`}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-widest">{label}</span>
                        <span className="block mt-1 text-xl font-black tabular-nums">{formatNumber(count as number)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="xl:col-span-3 border border-gold/20 rounded-2xl bg-surface-2/80 p-4 md:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gold-ink/70 mb-3">результат</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-4xl font-black tracking-tighter text-gold-ink tabular-nums">{formatNumber(rssFeed.length)}</p>
                      <p className="text-xs text-ink/45 font-bold">карток після фільтрів</p>
                    </div>
                    <Rss className="w-8 h-8 text-gold-ink/60 mb-1" />
                  </div>
                </div>
              </div>

              <div className="mb-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRssTopicFilter('all')}
                  className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${rssTopicFilter === 'all' ? 'border-gold bg-gold/18 text-gold-ink' : 'border-ink/10 text-ink/45 hover:text-ink hover:border-gold/40'}`}
                >
                  Усі теми
                </button>
                {rssTopics.map((topic) => (
                  <button
                    key={topic.tag}
                    type="button"
                    onClick={() => setRssTopicFilter(topic.tag)}
                    className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${rssTopicFilter === topic.tag ? 'border-gold bg-gold/18 text-gold-ink' : 'border-ink/10 text-ink/45 hover:text-ink hover:border-gold/40'}`}
                  >
                    {topic.tag} <span className="text-ink/35">{topic.count}</span>
                  </button>
                ))}
              </div>

              {rssItems.length + fbItems.length === 0 ? (
                <div className="border border-gold/20 rounded-2xl bg-surface p-8 font-mono text-xs uppercase tracking-widest text-ink/30">
                  Дані RSS ще оновлюються. Перевір через кілька хвилин.
                </div>
              ) : rssFeed.length === 0 ? (
                <div className="border border-gold/20 rounded-2xl bg-surface p-8">
                  <p className="text-2xl font-black tracking-[-0.018em] text-ink">Нічого не знайдено</p>
                  <p className="mt-2 text-sm text-ink/55 leading-relaxed">Спробуй очистити пошук або вибрати іншу тему. Фільтри працюють по перекладеному заголовку, опису, автору і тегам.</p>
                  <button type="button" onClick={() => { setRssSearch(''); setRssSourceFilter('all'); setRssTopicFilter('all'); }} className="mt-5 border border-gold/40 rounded-xl px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-gold-ink hover:bg-gold/10 transition-colors">
                    Скинути фільтри
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {rssFeed.slice(0, 24).map((item, index) => (
                    <article
                      key={`${item.feedSource}-${item.id}`}
                      className={`${index === 0 ? 'lg:col-span-6 lg:row-span-2' : 'lg:col-span-3'} group relative overflow-hidden border border-gold/18 rounded-2xl bg-surface-2 hover:border-gold/55 transition-colors shadow-[0_14px_45px_rgba(0,0,0,0.24)]`}
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-gold-ink to-transparent opacity-60" />
                      <div className="p-5 md:p-6 flex min-h-full flex-col">
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gold-ink/75">{item.sourceLabel}</p>
                            <p className="mt-1 font-mono text-[10px] tracking-wider text-ink/38">@{item.handle || item.author}</p>
                          </div>
                          <span className="shrink-0 border border-gold/22 rounded-2xl bg-gold/8 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-gold-ink/80">
                            {formatRssDate(item.publishedAt)}
                          </span>
                        </div>
                        <h3 className={`${index === 0 ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'} font-black tracking-tight mb-4 leading-[1.05] text-ink group-hover:text-gold-ink transition-colors`}>
                          {formatPreview(item.titleClean, index === 0 ? 230 : 150)}
                        </h3>
                        <p className={`${index === 0 ? 'text-base md:text-lg line-clamp-7' : 'text-[0.98rem] line-clamp-5'} font-semibold text-ink/72 leading-relaxed mb-5`}>
                          {formatPreview(item.summaryClean, index === 0 ? 420 : 240)}
                        </p>
                        <div className="mt-auto">
                          <div className="flex flex-wrap gap-2 mb-4">
                            {item.tagsClean.slice(0, index === 0 ? 5 : 3).map(tag => (
                              <button
                                key={`${item.id}-${tag}`}
                                type="button"
                                onClick={() => setRssTopicFilter(tag)}
                                className="px-2.5 py-1 border border-gold/20 rounded-full font-mono text-[8px] uppercase tracking-widest text-gold-ink/62 hover:text-gold-ink hover:border-gold/50 transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-ink/10">
                            <a href={item.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/65 hover:text-gold-ink transition-colors">
                              Відкрити пост <ArrowUpRight className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => shareLink(item.id, item.titleClean, item.url)}
                              className="font-mono text-[10px] uppercase tracking-widest text-ink/45 hover:text-gold-ink transition-colors"
                            >
                              {sharedItemId === item.id ? 'Скопійовано' : 'Поділитися'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Posts Feed */}
          <motion.section id="feed" variants={fadeIn} className="mb-16 scroll-mt-28">
            <div className="border-t border-gold/30 pt-12 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 border-b border-gold/22 pb-7 mb-8 md:mb-10">
                <div>
                  <span className="oko-eyebrow mb-4">/ ПУБЛІКАЦІЇ КАНАЛУ</span>
                  <h2 className="text-[1.6rem] md:text-5xl font-bold tracking-[-0.022em] text-ink leading-[1.1] md:leading-[1.04]">Стрічка Око Гора</h2>
                  <p className="mt-4 max-w-3xl text-base md:text-lg font-semibold leading-relaxed text-ink/64">
                    Останні пости з Telegram-каналу: коротке превʼю, джерело внизу картки та швидка кнопка для поширення.
                  </p>
                </div>
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 self-start lg:self-auto border border-gold/45 rounded-2xl bg-gold/10 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-gold-ink hover:bg-gold/16 hover:border-gold/70 transition-colors">
                  Відкрити Telegram <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
                {posts.map((post, index) => {
                  const isLead = index === 0;
                  const postUrl = `/#/post/${post.id}`;
                  return (
                    <article
                      key={post.id}
                      className={`${isLead ? 'lg:col-span-6 lg:row-span-2' : 'lg:col-span-3'} group overflow-hidden border border-gold/18 rounded-2xl bg-surface-2 hover:border-gold/55 transition-colors shadow-[0_18px_55px_rgba(0,0,0,0.24)]`}
                    >
                      <Link to={`/post/${post.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/80">
                        <div className={`${isLead ? 'aspect-[16/10] md:aspect-[21/10]' : 'aspect-[16/9]'} relative overflow-hidden bg-surface`}>
                          {post.image ? (
                            <img
                              src={resolveImageUrl(post.image)}
                              alt={post.title}
                              loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.035] transition-all duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(201,162,39,0.22),transparent_34%),linear-gradient(135deg,#ffffff,#f4f5f3)]">
                              <img src="oko_logo.png" alt="" className="w-20 h-20 object-contain opacity-28" loading="lazy" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/18 to-transparent" />
                          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                            <span className="border border-gold/45 rounded-2xl bg-surface/72 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-gold-ink">
                              {post.id}
                            </span>
                            <span className="border border-ink/15 bg-surface/58 rounded-2xl px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-ink/68">
                              {post.date}
                            </span>
                          </div>
                        </div>

                        <div className="p-5 md:p-6">
                          <div className="mb-4 flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.22em] text-ink/36">
                            <span>Telegram / Око Гора</span>
                            <span>{(post.tags || []).slice(0, 1).map(tag => `#${tag}`).join(' ')}</span>
                          </div>
                          <h3 className={`${isLead ? 'text-3xl md:text-5xl' : 'text-[1.7rem] md:text-[2rem]'} font-black tracking-[-0.018em] mb-4 group-hover:text-gold-ink transition-colors leading-[1.08] text-ink`}>
                            {post.title}
                          </h3>
                          <p className={`${isLead ? 'text-base md:text-lg line-clamp-7' : 'text-[1rem] line-clamp-5'} text-ink/68 leading-relaxed mb-5 font-semibold`}>
                            {formatPreview(post.text, isLead ? 420 : 260)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(post.tags || []).slice(0, isLead ? 6 : 4).map(tag => (
                              <span key={tag} className="px-2.5 py-1 border border-gold/20 rounded-full font-mono text-[8px] tracking-widest uppercase text-gold-ink/64 group-hover:border-gold/50 group-hover:text-gold-ink transition-all">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>

                      <div className="mx-5 md:mx-6 mb-5 md:mb-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
                        <button
                          type="button"
                          onClick={() => window.open(postTelegramUrl(post), '_blank', 'noopener,noreferrer')}
                          className="inline-flex min-h-11 items-center gap-1.5 border border-gold/25 rounded-2xl bg-gold/8 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-ink/62 hover:text-gold-ink hover:border-gold/55 hover:bg-gold/12 transition-colors"
                        >
                          Джерело в Telegram <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => shareLink(post.id, post.title, `${window.location.origin}${postUrl}`)}
                          className="inline-flex min-h-11 items-center border border-ink/10 rounded-2xl px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-ink/48 hover:text-gold-ink hover:border-gold/45 transition-colors"
                        >
                          {sharedItemId === post.id ? 'Скопійовано' : 'Поділитися з друзями'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </motion.section>

        </motion.div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer id="contacts" className="relative overflow-hidden border-t border-gold/30 px-4 md:px-8 py-12 md:py-20 bg-surface-2 text-ink scroll-mt-28">
        <div className="absolute inset-0 pointer-events-none opacity-35" style={{ backgroundImage: 'linear-gradient(rgba(201,162,39,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.08) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <div className="absolute -right-32 -bottom-32 w-[460px] h-[460px] rounded-full border border-gold/15 pointer-events-none" />
        <div className="max-w-[1800px] mx-auto relative">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 mb-8 md:mb-12">
            <div className="xl:col-span-5 border border-gold/25 rounded-2xl bg-surface-2/88 p-6 md:p-8">
              <div className="flex items-start gap-4 mb-7">
                <div className="w-12 h-12 md:w-14 md:h-14 border border-gold/40 rounded-2xl bg-gold/10 flex items-center justify-center shrink-0">
                  <img src="oko_logo.png" alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-90" loading="lazy" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-ink/75">/ ЦИФРОВА ПЛАТФОРМА КАНАЛУ</p>
                  <h3 className="mt-2 text-3xl md:text-5xl font-black tracking-[-0.022em] leading-[1.04] text-gold-ink">
                    Око Гора
                  </h3>
                </div>
              </div>
              <p className="text-ink/72 max-w-2xl text-base md:text-lg font-bold leading-relaxed">
                Це сайт Telegram-каналу «Око Гора - новини та аналітика». Тут зібрані пости, карта, RSS-джерела, статистика SBS, таблиця DeepState і посилання для перевірки.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-7">
                {[
                  ['Оновлено SBS', sbsStats?.latestDate || 'очікується'],
                  ['DeepState рядків', deepstateRows.length],
                  ['RSS записів', rssItems.length + fbItems.length],
                  ['Подій 7 днів', dashboard.total],
                ].map(([label, value]) => (
                  <div key={label as string} className="border border-gold/16 rounded-2xl bg-surface/70 p-3 md:p-4">
                    <p className="font-mono text-[8px] md:text-[9px] uppercase tracking-widest text-ink/38">{label}</p>
                    <p className="mt-1 text-xl md:text-2xl font-black tracking-tighter text-ink tabular-nums">{typeof value === 'number' ? formatNumber(value) : value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gold/20 rounded-2xl bg-surface-2/72 p-5 md:p-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-ink/70 block mb-5">/ РОЗДІЛИ</span>
                <div className="grid grid-cols-1 gap-2 font-mono text-[11px] md:text-xs tracking-widest uppercase">
                  {[
                    ['Карта', 'map'],
                    ['Підрозділи', 'brigades'],
                    ['Аналітика ударів', 'analytics'],
                    ['SBS Stats', 'sbs'],
                    ['DeepState', 'deepstate'],
                    ['RSS', 'rss'],
                    ['Стрічка', 'feed'],
                  ].map(([label, id]) => (
                    <button key={id} type="button" onClick={() => openSection(id as SectionId)} className="flex items-center justify-between gap-3 border-b border-ink/10 py-2 text-left text-ink/58 hover:text-gold-ink hover:border-gold/40 transition-colors">
                      <span>{label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-45" />
                    </button>
                  ))}
                  <Link to="/targets" className="flex items-center justify-between gap-3 border-b border-ink/10 py-2 text-left text-gold-ink hover:border-gold/40 transition-colors">
                    <span>База цілей</span>
                    <Target className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div className="border border-gold/20 rounded-2xl bg-surface-2/72 p-5 md:p-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-ink/70 block mb-5">/ ДЖЕРЕЛА</span>
                <div className="space-y-3 font-mono text-[11px] md:text-xs tracking-widest uppercase">
                  {[
                    ['Telegram канал', 'https://t.me/oko_gora'],
                    ['X / Twitter', 'https://x.com/oko_gora_tg'],
                    ['SBS Stats', 'https://foosint.github.io/sbs-stats/'],
                    ['DeepState Table', 'https://deepstat.xyz/table'],
                  ].map(([label, href]) => (
                    <a key={href} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border-b border-ink/10 py-2 text-ink/58 hover:text-gold-ink hover:border-gold/40 transition-colors">
                      <span>{label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-55" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 flex flex-col gap-4">
              <SupportCard variant="footer" />
              <div className="border border-gold/25 rounded-2xl bg-gold/10 p-5 md:p-6 flex flex-col justify-between gap-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-ink/80">/ CONTACT</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black tracking-[-0.018em] leading-tight">Слідкувати за оновленнями</h4>
                <p className="mt-4 text-sm md:text-base text-ink/65 leading-relaxed font-medium">
                  Найшвидше оновлення, пояснення до мапи та нові розбори публікуються у Telegram.
                </p>
              </div>
              <div className="space-y-3">
                <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 bg-ink text-white px-4 py-3 font-mono text-[11px] md:text-xs font-black uppercase tracking-widest hover:opacity-85 transition-opacity">
                  Відкрити Telegram
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                <button type="button" onClick={() => shareLink('footer-home', 'Око Гора', window.location.origin)} className="w-full flex items-center justify-between gap-3 border border-gold/40 rounded-xl px-4 py-3 font-mono text-[11px] md:text-xs font-black uppercase tracking-widest text-gold-ink hover:bg-gold/12 transition-colors">
                  {sharedItemId === 'footer-home' ? 'Посилання скопійовано' : 'Поділитися сайтом'}
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            </div>{/* end support+contact column */}
          </div>

          <div className="border-t border-gold/12 pt-5 md:pt-6 flex flex-col lg:flex-row justify-between gap-4 font-mono text-[9px] md:text-[10px] tracking-[0.22em] text-ink/34 uppercase">
            <div className="leading-relaxed">© {new Date().getFullYear()} OKO GORA. ЦИФРОВА ПЛАТФОРМА TELEGRAM-КАНАЛУ. ДАНІ З ВІДКРИТИХ ДЖЕРЕЛ.</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <span>STATUS: ACTIVE</span>
              <span>SBS: {sbsStats?.latestDate || 'WAITING'}</span>
              <span>DEEPSTATE: {deepstateTable?.latest?.day ? `ROW ${deepstateTable.latest.day}` : 'WAITING'}</span>
              <span>VERSION: 3.1.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Mobile Bottom Nav (PWA) ─────────────────────────────────────────── */}
      {/* "More" sheet — slides up from behind the nav bar */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[998]" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface-2 border-t border-gold/20 px-4 pt-4 pb-2 flex flex-col gap-1 font-mono text-[11px] uppercase tracking-widest z-[999]"
            style={{ paddingBottom: 'calc(var(--nav-h) + var(--safe-bottom) + 0.5rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-gold-ink font-bold text-[10px] tracking-[0.2em]">НАВІГАЦІЯ</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="text-ink/40 hover:text-ink p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button type="button" onClick={() => openSection('brigades')}
              className="flex items-center gap-3 text-ink/60 hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04] text-left w-full">
              <Shield className="w-4 h-4 flex-shrink-0" /><span>Підрозділи</span>
            </button>
            <button type="button" onClick={() => openSection('analytics')}
              className="flex items-center gap-3 text-ink/60 hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04] text-left w-full">
              <BarChart3 className="w-4 h-4 flex-shrink-0" /><span>Аналітика</span>
            </button>
            <button type="button" onClick={() => openSection('sbs')}
              className="flex items-center gap-3 text-ink/60 hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04] text-left w-full">
              <Activity className="w-4 h-4 flex-shrink-0" /><span>SBS</span>
            </button>
            <button type="button" onClick={() => openSection('deepstate')}
              className="flex items-center gap-3 text-ink/60 hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04] text-left w-full">
              <Table2 className="w-4 h-4 flex-shrink-0" /><span>DeepState</span>
            </button>
            <button type="button" onClick={() => openSection('investigations')}
              className="flex items-center gap-3 text-ink/60 hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04] text-left w-full">
              <Database className="w-4 h-4 flex-shrink-0" /><span>Розслідування</span>
            </button>
            <button type="button" onClick={() => openSection('rss')}
              className="flex items-center gap-3 text-ink/60 hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04] text-left w-full">
              <Rss className="w-4 h-4 flex-shrink-0" /><span>RSS</span>
            </button>
            <a href="https://t.me/oko_gora" target="_blank" rel="noreferrer"
              className="flex items-center gap-3 text-ink font-bold hover:text-gold-ink transition-colors py-2.5 px-3 rounded-lg hover:bg-ink/[0.04]">
              <RadioTower className="w-4 h-4 flex-shrink-0" /><span>Телеграм</span><ArrowUpRight className="w-3 h-3 ml-auto" />
            </a>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] bottom-nav
        bg-surface-2/96 backdrop-blur-xl border-t border-gold/15">
        <div className="h-14 flex items-stretch">
          {/* Home */}
          <Link to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
              ${location.pathname === '/' && !mobileMenuOpen ? 'text-gold-ink' : 'text-ink/55 active:text-ink'}`}>
            <Home className="w-[18px] h-[18px]" />
            <span className="text-[10px] font-medium">Огляд</span>
          </Link>
          {/* Map */}
          <button type="button"
            onClick={() => openSection('map')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-ink/55 active:text-ink transition-colors">
            <MapIcon className="w-[18px] h-[18px]" />
            <span className="text-[10px] font-medium">Карта</span>
          </button>
          {/* Targets */}
          <Link to="/targets"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
              ${location.pathname === '/targets' && !mobileMenuOpen ? 'text-gold-ink' : 'text-ink/55 active:text-ink'}`}>
            <Target className="w-[18px] h-[18px]" />
            <span className="text-[10px] font-medium">Цілі</span>
          </Link>
          {/* Feed */}
          <button type="button"
            onClick={() => openSection('feed')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-ink/55 active:text-ink transition-colors">
            <Radio className="w-[18px] h-[18px]" />
            <span className="text-[10px] font-medium">Стрічка</span>
          </button>
          {/* More */}
          <button type="button"
            onClick={() => setMobileMenuOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
              ${mobileMenuOpen ? 'text-gold-ink' : 'text-ink/55 active:text-ink'}`}>
            <MoreHorizontal className="w-[18px] h-[18px]" />
            <span className="text-[10px] font-medium">Ще</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
