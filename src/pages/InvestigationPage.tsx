import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Database, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { InvestigationArticle } from '../types';
import { setSeo } from '../lib/seo';

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(md: string) {
  const safe = escapeHtml(md || '');
  const lines = safe.split('\n');
  const out: string[] = [];
  let inList = false;
  let h2Index = 0;
  let skippedFirstH1 = false;
  let paragraphBuffer: string[] = [];

  const inline = (text: string) =>
    text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    out.push(`<p>${inline(paragraphBuffer.join(' '))}</p>`);
    paragraphBuffer = [];
  };

  const isTableSeparator = (line: string) => /^\|?[\s:-]+\|[\s|:-]+$/.test(line);
  const splitTableRow = (line: string) => line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  const attr = (text: string) => text.replace(/"/g, '&quot;');
  const figureLabel = (alt: string) => {
    const lower = alt.toLowerCase();
    if (lower.includes('схема') && lower.includes('колони')) return 'Схема / атмосферна колона';
    if (lower.includes('схема')) return 'Схема / технічний контекст';
    if (lower.includes('osint')) return 'Доказ / візуальна верифікація';
    return 'Доказ / ілюстративний матеріал';
  };
  const renderScheme = (type: string) => {
    if (type !== 'recovery-bars') return '';

    // Realistic 2026 recovery horizon by equipment type.
    // base = виробництво + монтаж (міс.), queue = черга + санкційні затримки (міс.).
    const SCALE = 60; // міс. = 5 років
    const rows = [
      { label: 'Насоси, КВПіА, кабелі', base: 2, queue: 0, note: 'до 2 міс' },
      { label: 'Типові теплообмінники', base: 4, queue: 2, note: '4–6 міс' },
      { label: 'Внутрішні пристрої колон', base: 8, queue: 4, note: '8–12 міс' },
      { label: 'Нестандартні теплообмінники', base: 10, queue: 5, note: '10–16 міс' },
      { label: 'Коксова камера', base: 24, queue: 10, note: '1.5–3 роки' },
      { label: 'Атмосферна колона', base: 25, queue: 12, note: '2–3 роки' },
      { label: 'Вакуумна колона', base: 28, queue: 14, note: '2.5–3.5 роки' },
      { label: 'Реактор гідроочистки', base: 30, queue: 15, note: '2.5–4 роки' },
      { label: 'Реактор каткрекінгу', base: 38, queue: 19, note: '3–5 років' },
    ];
    const pct = (v: number) => `${((v / SCALE) * 100).toFixed(1)}%`;
    const gridYears = [1, 2, 3, 4, 5];

    const bars = rows.map((r) => `
      <div class="rc-row">
        <div class="rc-label">${r.label}</div>
        <div class="rc-val">${r.note}</div>
        <div class="rc-track">
          <div class="rc-seg rc-base${r.queue ? '' : ' rc-solo'}" style="width:${pct(r.base)}"></div>
          ${r.queue ? `<div class="rc-seg rc-queue" style="width:${pct(r.queue)}"></div>` : ''}
        </div>
      </div>`).join('');

    const grid = gridYears.map((y) => `
      <div class="rc-gridline" style="left:${pct(y * 12)}"><span>${y} р</span></div>`).join('');

    return `
      <figure class="recovery-chart" aria-label="Час відновлення обладнання НПЗ за типом">
        <div class="rc-head">
          <div class="figure-label">Дані / реальний горизонт відновлення</div>
          <h3 class="rc-title">Чим важче обладнання, тим довша черга</h3>
          <p class="rc-sub">Час від удару до повного повернення на проєктний режим, з урахуванням черги на чотирьох заводах, конкуренції з ОПК і санкцій. Місяці.</p>
        </div>
        <div class="rc-legend">
          <span class="rc-leg"><i class="rc-sw rc-base"></i>Виробництво + монтаж</span>
          <span class="rc-leg"><i class="rc-sw rc-queue"></i>Черга та санкційні затримки</span>
        </div>
        <div class="rc-plot">
          <div class="rc-grid">${grid}</div>
          ${bars}
        </div>
        <figcaption>Косметичні пошкодження повертають завод за тижні. Корпусні апарати — колони та реактори — вибивають його з ладу на роки. Саме ця різниця і є справжнім ефектом ударів.</figcaption>
      </figure>
    `;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^::scheme\s+/.test(line)) {
      flushParagraph();
      closeList();
      out.push(renderScheme(line.replace(/^::scheme\s+/, '').trim()));
      continue;
    }

    if (/^(&gt;|>)\s+/.test(line)) {
      flushParagraph();
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^(&gt;|>)\s+/, ''))}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      closeList();
      out.push('<hr />');
      continue;
    }

    const imageMatch = line.match(/^!\[(.*?)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/);
    if (imageMatch) {
      flushParagraph();
      closeList();
      // peek at next non-empty line to see if it's an italic caption
      let captionHtml = '';
      let skipNext = 0;
      for (let j = i + 1; j < lines.length; j++) {
        const peek = lines[j].trim();
        if (!peek) { skipNext = j - i; continue; }
        // italic-only line used as caption: *text* or _text_
        if (/^\*[^*].+[^*]\*$/.test(peek) || /^_[^_].+[^_]_$/.test(peek)) {
          captionHtml = inline(peek.replace(/^[*_]/, '').replace(/[*_]$/, ''));
          skipNext = j - i;
        }
        break;
      }
      if (skipNext) i += skipNext;
      out.push(`<figure class="editorial-figure"><div class="figure-label">${figureLabel(imageMatch[1])}</div><img src="${imageMatch[2]}" alt="${imageMatch[1]}" loading="lazy" />${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}</figure>`);
      continue;
    }

    if (line.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1].trim())) {
      flushParagraph();
      closeList();
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(splitTableRow(lines[i].trim()));
        i += 1;
      }
      i -= 1;
      out.push('<div class="article-table-wrap"><table><thead><tr>');
      headers.forEach((header) => out.push(`<th>${inline(header)}</th>`));
      out.push('</tr></thead><tbody>');
      rows.forEach((row) => {
        out.push('<tr>');
        headers.forEach((header, idx) => out.push(`<td data-label="${attr(header)}">${inline(row[idx] || '')}</td>`));
        out.push('</tr>');
      });
      out.push('</tbody></table></div>');
      continue;
    }

    if (/^###\s+/.test(line)) {
      flushParagraph();
      closeList();
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushParagraph();
      closeList();
      h2Index += 1;
      out.push(`<h2 id="section-${h2Index}">${inline(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      flushParagraph();
      closeList();
      if (!skippedFirstH1) {
        skippedFirstH1 = true;
        continue;
      }
      out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      closeList();
      out.push(`<p class="numbered-item">${inline(line)}</p>`);
      continue;
    }

    // Bold label + text: convert to compact evidence row for entities/dates/plants
    const evidenceMatch = line.match(/^\*\*([^*]+)\*\*\s*(.+)$/);
    if (evidenceMatch) {
      flushParagraph();
      closeList();
      out.push(`<p class="lead-in"><strong>${inline(evidenceMatch[1])}</strong> ${inline(evidenceMatch[2])}</p>`);
      continue;
    }

    // Bold-only line = lead/kicker paragraph
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      flushParagraph();
      closeList();
      out.push(`<p class="article-lead">${inline(line)}</p>`);
      continue;
    }

    closeList();
    paragraphBuffer.push(line);
  }
  flushParagraph();
  closeList();

  return out.join('\n');
}

function extractHeadings(md: string) {
  let index = 0;
  return md
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^##\s+/.test(line))
    .map((line) => {
      index += 1;
      return {
        id: `section-${index}`,
        label: line.replace(/^##\s+/, ''),
      };
    });
}

function formatArticleDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return value;
  }
}

function StatusBadge({ status }: { status?: string }) {
  const value = (status || 'published').toLowerCase();
  const isPublished = value === 'published';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${isPublished ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700' : 'border-amber-600/30 bg-amber-600/10 text-amber-700'}`}>
      {isPublished ? 'Published' : value}
    </span>
  );
}

function RiskBadge({ tags }: { tags?: string[] }) {
  const joined = (tags || []).join(' ').toLowerCase();
  const level = joined.includes('critical') ? 'Critical' : joined.includes('high') ? 'High' : 'Medium';
  const cls = level === 'Critical'
    ? 'border-red-600/30 bg-red-600/10 text-red-700'
    : level === 'High'
      ? 'border-orange-600/30 bg-orange-600/10 text-orange-700'
      : 'border-sky-600/30 bg-sky-600/10 text-sky-700';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${cls}`}>Risk: {level}</span>;
}

export default function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InvestigationArticle | null>(null);
  const [allItems, setAllItems] = useState<InvestigationArticle[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    setLoading(true);
    setMarkdown('');
    fetch(`/data/investigations.json?_t=${Date.now()}`)
      .then((r) => r.json())
      .then(async (data: InvestigationArticle[]) => {
        const arr = Array.isArray(data) ? data : [];
        setAllItems(arr);
        const found = arr.find((x) => x.id === id) || null;
        setItem(found);
        if (found?.contentPath) {
          const res = await fetch(`${found.contentPath}?_t=${Date.now()}`);
          if (res.ok) {
            setMarkdown(await res.text());
            return;
          }
        }
        setMarkdown(found?.contentMarkdown || '');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!item) return;
    setSeo({
      title: item.title,
      description: item.summary,
      path: `/investigation/${item.id}`,
      type: 'article',
    });
  }, [item]);

  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const wordCount = useMemo(() => markdown.split(/\s+/).filter(Boolean).length, [markdown]);
  const readMinutes = Math.max(3, Math.round(wordCount / 180));
  const related = useMemo(() => allItems.filter((x) => x.id !== item?.id && (x.status || 'published') === 'published').slice(0, 2), [allItems, item?.id]);
  const category = item?.tags?.[0] || 'OSINT';

  if (loading) return <div className="min-h-screen bg-surface text-ink flex items-center justify-center">Loading...</div>;
  if (!item) return <div className="min-h-screen bg-surface text-ink flex items-center justify-center">Not found</div>;

  return (
    <div className="min-h-screen bg-surface text-ink font-sans">
      <div className="relative overflow-hidden border-b border-gold/15 bg-surface-2">
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
          <Link to="/#investigations" className="inline-flex min-h-11 items-center gap-2 text-[12px] text-ink-2 transition-colors hover:text-gold-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> До розслідувань
          </Link>
        </div>

        <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 pb-10 md:px-8 md:pb-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-gold/45 bg-gold/10 px-3 py-1 text-[11px] font-medium tracking-wide text-gold-ink">{item.code}</span>
              <StatusBadge status={item.status} />
              <RiskBadge tags={item.tags} />
            </div>
            <h1 className="max-w-5xl text-balance text-[2rem] font-bold leading-[1.03] text-ink md:text-[3rem] lg:text-[3.5rem]">{item.title}</h1>
            <p className="mt-5 max-w-3xl text-pretty text-base leading-7 text-ink-2 md:text-lg">{item.summary}</p>
          </div>

          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="oko-card p-5 md:p-6">
              <p className="mb-4 text-[11px] uppercase tracking-[0.08em] text-gold-ink">Article Meta</p>
              <div className="space-y-3 text-sm text-ink-2">
                <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gold" /> Опубліковано</span>
                  <span className="text-right">{formatArticleDate(item.publishedAt)}</span>
                </div>
                {item.updatedAt && item.updatedAt !== item.publishedAt && (
                  <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2.5">
                    <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 text-gold" /> Оновлено</span>
                    <span className="text-right">{formatArticleDate(item.updatedAt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-gold" /> Категорія</span>
                  <span>{category}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-gold" /> Читання</span>
                  <span>{readMinutes} хв</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2.5">
                  <span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-gold" /> Формат</span>
                  <span>OSINT</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" /> Точність</span>
                  <span>відкриті джерела</span>
                </div>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gold/40 px-4 py-3 text-[12px] text-gold-ink transition-colors hover:bg-gold/10">
                  Зовнішнє джерело <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </aside>
        </section>
      </div>

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-4 py-8 md:px-8 md:py-12 lg:grid-cols-12 lg:gap-10">
        <aside className="lg:col-span-3 xl:col-span-3">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="oko-card p-5">
              <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-gold-ink">
                <FileText className="h-3.5 w-3.5" /> Навігація
              </div>
              <nav className="space-y-1">
                {headings.slice(0, 10).map((heading) => (
                  <button
                    key={heading.id}
                    type="button"
                    onClick={() => document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="block w-full border-l border-ink/10 px-3 py-2 text-left text-[13px] leading-snug text-ink-2 transition-colors hover:border-gold/70 hover:text-ink"
                  >
                    {heading.label}
                  </button>
                ))}
              </nav>
            </div>
            {(item.tags || []).length > 0 && (
              <div className="oko-card p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-gold-ink">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {(item.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full border border-ink/10 bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="lg:col-span-9 xl:col-span-9">
          <article className="article-shell rounded-2xl border border-ink/10 bg-surface p-5 md:p-8 lg:p-10">
            {markdown ? (
              <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className="text-ink-2">Контент ще готується.</p>
            )}
            <div className="share-bar">
              <span className="share-label">Поділитися розслідуванням</span>
              <button onClick={handleCopyLink} className="share-btn">
                {copied ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Скопійовано!</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Копіювати посилання</>
                )}
              </button>
            </div>
            {related.length > 0 && (
              <section className="mt-8 border-t border-ink/10 pt-6">
                <h3 className="mb-3 text-lg font-bold text-ink">Пов’язані матеріали</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {related.map((r) => (
                    <Link key={r.id} to={`/investigation/${r.id}`} className="rounded-xl border border-ink/10 bg-surface p-4 transition-colors hover:border-gold/45 hover:bg-surface-2">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-gold-ink">{r.id}</p>
                      <p className="mt-1 text-sm font-medium text-ink">{r.title}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        </main>
      </div>
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        .share-bar {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(11,11,12,0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .share-label {
          font-family: var(--font-sans);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #54564f;
          font-weight: 600;
        }
        .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.2rem;
          font-family: var(--font-sans);
          font-size: 0.82rem;
          font-weight: 600;
          color: #0b0b0c;
          background: transparent;
          border: 1px solid rgba(11,11,12,0.2);
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          letter-spacing: 0.02em;
        }
        .share-btn:hover {
          background: rgba(11,11,12,0.04);
          border-color: rgba(11,11,12,0.4);
        }
        .article-body {
          max-width: 740px;
          margin: 0 auto;
          color: #2c2c2e;
          font-family: var(--font-sans);
          font-size: 1rem;
          line-height: 1.82;
          text-align: left;
          hyphens: none;
          text-wrap: pretty;
          counter-reset: section-counter;
          font-weight: 400;
        }
        .article-body > *:first-child {
          margin-top: 0;
        }
        .article-body h1,
        .article-body h2,
        .article-body h3 {
          font-family: var(--font-head);
          color: #0b0b0c;
          font-weight: 700;
          line-height: 1.16;
          letter-spacing: -0.018em;
          text-align: left;
          hyphens: none;
        }
        .article-body h2 {
          margin: 3.25rem 0 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(11,11,12,0.1);
          font-size: clamp(1.18rem, 1.9vw, 1.48rem);
          scroll-margin-top: 7rem;
          counter-increment: section-counter;
          position: relative;
        }
        .article-body h2::before {
          content: "0" counter(section-counter);
          display: block;
          margin-bottom: 0.4rem;
          color: #8a6a0e;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
        }
        .article-body h3 {
          margin: 2.15rem 0 0.8rem;
          font-size: 0.98rem;
          font-weight: 700;
          text-transform: none;
          text-align: left;
        }
        .article-body p {
          margin: 0 0 1.15rem 0;
          text-align: left;
          text-indent: 0;
        }
        .article-body p + p {
          margin-top: 0;
        }
        .article-body > .recovery-chart,
        .article-body > .editorial-figure,
        .article-body > .article-table-wrap {
          width: min(880px, calc(100vw - 4rem));
          margin-left: 50%;
          transform: translateX(-50%);
        }
        /* No indent after headings, blockquotes, figures, lists */
        .article-body h2 + p,
        .article-body h3 + p,
        .article-body blockquote + p,
        .article-body figure + p,
        .article-body ul + p,
        .article-body hr + p,
        .article-body .recovery-chart + p {
          text-indent: 0;
        }
        /* Lead paragraph */
        .article-body p:first-of-type {
          font-family: var(--font-sans);
          font-size: 1.08rem;
          line-height: 1.65;
          color: #0b0b0c;
          font-weight: 500;
          margin-bottom: 0;
          text-align: left;
          text-indent: 0;
        }
        .article-body a {
          color: #8a6a0e;
          text-decoration: underline;
          text-decoration-color: rgba(138,106,14,0.4);
          text-underline-offset: 0.25em;
          transition: text-decoration-color 0.2s;
        }
        .article-body a:hover {
          text-decoration-color: #8a6a0e;
        }
        .article-body strong {
          color: #0b0b0c;
          font-weight: 600;
        }
        .article-body .lead-in {
          margin: 0 0 0.95rem;
          color: #2c2c2e;
          line-height: 1.7;
          font-size: 1rem;
          text-align: left;
          text-indent: 0;
        }
        .article-body .lead-in strong {
          color: #0b0b0c;
          font-weight: 700;
        }
        .article-body code {
          font-family: var(--font-mono);
          background: rgba(11,11,12,0.06);
          padding: 0.2rem 0.4rem;
          font-size: 0.85em;
          border-radius: 4px;
        }
        .article-body blockquote {
          position: relative;
          margin: 1.6rem 0;
          padding: 0.9rem 0 0.9rem 1.9rem;
          border-left: 2px solid rgba(201,162,39,0.6);
          color: #0b0b0c;
          font-size: 1.1rem;
          font-style: normal;
          font-weight: 500;
          line-height: 1.5;
          background: transparent;
          border-radius: 0;
          text-align: left;
          text-wrap: balance;
        }
        .article-body blockquote::before {
          content: "“";
          position: absolute;
          left: -0.05rem;
          top: -0.15rem;
          color: rgba(201,162,39,0.85);
          font-size: 2.15rem;
          line-height: 1;
          font-weight: 500;
        }
        .article-body blockquote p {
          margin: 0;
          text-indent: 0;
        }
        .article-lead {
          font-family: var(--font-sans);
          font-size: 1rem;
          font-weight: 400;
          color: #54564f;
          font-style: italic;
          margin: 0;
          line-height: 1.6;
          text-align: left;
        }
        .numbered-item {
          padding-left: 0;
          position: relative;
          margin: 0 0 0.75rem;
          color: #2c2c2e;
          text-align: left;
        }
        .numbered-item strong {
          color: #0b0b0c;
        }
        .recovery-chart {
          margin: 2.8rem 0;
          font-family: var(--font-sans);
          border: 1px solid rgba(11,11,12,0.1);
          border-radius: 16px;
          background: #ffffff;
          padding: 1.6rem 1.6rem 1.4rem;
        }
        .rc-head { margin-bottom: 1.3rem; }
        .rc-title {
          margin: 0.5rem 0 0;
          color: #0b0b0c;
          font-family: var(--font-head);
          font-size: 1.45rem;
          line-height: 1.18;
          font-weight: 700;
        }
        .rc-sub {
          margin: 0.55rem 0 0;
          color: #54564f;
          font-size: 0.9rem;
          line-height: 1.5;
          max-width: 56ch;
        }
        .rc-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1.2rem;
          margin-bottom: 1.6rem;
        }
        .rc-leg {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: #54564f;
          font-size: 0.78rem;
          font-weight: 500;
        }
        .rc-sw {
          width: 0.85rem;
          height: 0.85rem;
          border-radius: 3px;
          flex: none;
        }
        .rc-sw.rc-base { background: #0b0b0c; }
        .rc-sw.rc-queue { background: #c9a227; }
        .rc-plot {
          position: relative;
          padding-top: 1.5rem;
          display: grid;
          gap: 1rem;
        }
        .rc-grid {
          position: absolute;
          left: 0;
          right: 0;
          top: 1.5rem;
          bottom: 0;
          pointer-events: none;
        }
        .rc-gridline {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(11,11,12,0.08);
        }
        .rc-gridline span {
          position: absolute;
          top: -1.35rem;
          left: 0;
          transform: translateX(-50%);
          color: #9a9a90;
          font-size: 0.66rem;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .rc-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.4rem 0.8rem;
          align-items: baseline;
        }
        .rc-label {
          grid-column: 1;
          color: #2c2c2e;
          font-size: 0.86rem;
          line-height: 1.25;
        }
        .rc-val {
          grid-column: 2;
          text-align: right;
          color: #8a6a0e;
          font-size: 0.78rem;
          font-weight: 600;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .rc-track {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          height: 1.35rem;
        }
        .rc-seg {
          height: 100%;
        }
        .rc-seg.rc-base {
          background: #0b0b0c;
          border-radius: 3px 0 0 3px;
        }
        .rc-seg.rc-queue {
          background: #c9a227;
          border-radius: 0 3px 3px 0;
        }
        .rc-seg.rc-solo {
          border-radius: 3px;
        }
        .recovery-chart figcaption {
          margin-top: 1.5rem;
          padding: 1rem 0 0;
          border-top: 1px solid rgba(11,11,12,0.08);
          color: #54564f;
          font-size: 0.82rem;
          line-height: 1.55;
          text-align: left;
        }
        .recovery-chart .figure-label {
          margin-bottom: 0;
        }
        .article-body hr {
          margin: 1.5rem 0;
          border: 0;
          border-top: 1px solid rgba(11,11,12,0.1);
        }
        .article-body ul {
          margin: 0 0 1.5rem 1rem;
          padding: 0;
          list-style: none;
          text-align: left;
        }
        .article-body li {
          position: relative;
          margin: 0 0 0.65rem;
          padding-left: 1.35rem;
          color: #2c2c2e;
          line-height: 1.7;
          text-align: left;
        }
        .article-body li::before {
          content: "—";
          position: absolute;
          left: 0;
          top: 0;
          color: #8a6a0e;
          font-family: var(--font-sans);
        }
        .article-table-wrap {
          overflow-x: auto;
          margin: 2.2rem 0;
          font-family: var(--font-sans);
          border: 1px solid rgba(11,11,12,0.1);
          border-radius: 12px;
          padding: 0 0.85rem;
          background: #ffffff;
        }
        .article-table-wrap table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
          font-size: 0.9rem;
        }
        .article-table-wrap th,
        .article-table-wrap td {
          border-bottom: 1px solid rgba(11,11,12,0.08);
          padding: 0.92rem 0.6rem;
          vertical-align: top;
          text-align: left;
        }
        .article-table-wrap th {
          border-top: 1px solid rgba(11,11,12,0.12);
          border-bottom: 2px solid rgba(11,11,12,0.12);
          color: #0b0b0c;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
        }
        .article-table-wrap td {
          color: #2c2c2e;
          line-height: 1.4;
          font-size: 0.86rem;
        }
        figure {
          margin: 2.4rem 0;
          overflow: hidden;
          border: 1px solid rgba(11,11,12,0.1);
          border-radius: 12px;
          background: #ffffff;
        }
        .editorial-figure {
          padding: 0.6rem;
        }
        .figure-label {
          margin: 0 0 0.65rem;
          color: #8a6a0e;
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        figure img {
          width: 100%;
          height: 360px;
          object-fit: cover;
          display: block;
          background: #f4f5f3;
        }
        figcaption {
          padding: 0.8rem 0.9rem 0.9rem;
          color: #54564f;
          font-family: var(--font-sans);
          font-size: 0.78rem;
          line-height: 1.52;
          border-top: 1px solid rgba(11,11,12,0.08);
          text-align: left;
        }
        @media (max-width: 720px) {
          .article-body {
            font-size: 0.94rem;
            line-height: 1.68;
          }
          .article-body > .recovery-chart,
          .article-body > .editorial-figure,
          .article-body > .article-table-wrap {
            width: 100%;
            margin-left: 0;
            transform: none;
          }
          .article-body p {
            margin-bottom: 0.9rem;
          }
          .share-bar {
            margin-top: 2.2rem;
            padding-top: 1.5rem;
          }
          .recovery-chart {
            padding: 1.2rem 1.1rem 1.1rem;
          }
          .rc-row {
            grid-template-columns: minmax(0, 1fr);
          }
          .rc-val {
            grid-column: 1;
            text-align: left;
          }
          .article-body blockquote {
            font-size: 1.08rem;
            padding-left: 1.35rem;
          }
          .article-body blockquote::before {
            font-size: 2rem;
            top: -0.05rem;
          }
          figure img {
            height: 240px;
          }
          .article-table-wrap {
            border-top: 1px solid rgba(11,11,12,0.08);
          }
          .article-table-wrap table,
          .article-table-wrap thead,
          .article-table-wrap tbody,
          .article-table-wrap tr,
          .article-table-wrap th,
          .article-table-wrap td {
            display: block;
            min-width: 0;
            width: 100%;
          }
          .article-table-wrap thead {
            display: none;
          }
          .article-table-wrap tr {
            margin-bottom: 1rem;
            background: #f4f5f3;
            border-radius: 12px;
          }
          .article-table-wrap td {
            border-bottom: 1px solid rgba(11,11,12,0.08);
            padding: 1rem;
          }
          .article-table-wrap td::before {
            content: attr(data-label);
            display: block;
            margin-bottom: 0.5rem;
            color: #8a6a0e;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
        }
      `}</style>
    </div>
  );
}
