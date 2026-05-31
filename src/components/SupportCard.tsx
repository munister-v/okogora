import { useState } from 'react';
import { Heart, Copy, Check, ExternalLink } from 'lucide-react';

const MONO_JAR_URL = 'https://send.monobank.ua/jar/2RFUu64QTK';
const AUTHOR_TG = 'https://t.me/oko_gora';

type CardEntry = { label: string; value: string };

const CARDS: CardEntry[] = [
  { label: 'МоноБанк', value: '5375 4112 0940 3844' },
  { label: 'ПриватБанк', value: '5168 7559 0761 2929' },
];

function CopyLine({ label, value }: CardEntry) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value.replace(/\s/g, '')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-surface-2 px-3.5 py-2.5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">{label}</p>
        <p className="mt-0.5 font-mono text-sm font-medium tracking-wider text-ink">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        title="Скопіювати номер"
        className="shrink-0 rounded-lg border border-ink/10 bg-white p-1.5 text-ink/50 transition-colors hover:border-gold/50 hover:text-gold-ink active:scale-95"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

interface SupportCardProps {
  /** 'article' = full-width below article; 'footer' = compact inline */
  variant?: 'article' | 'footer';
}

export default function SupportCard({ variant = 'article' }: SupportCardProps) {
  if (variant === 'footer') {
    return (
      <div className="rounded-2xl border border-gold/30 bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Heart className="h-4 w-4 shrink-0 text-gold-ink" />
          <span className="font-semibold text-ink">Підтримати проєкт</span>
        </div>
        <a
          href={MONO_JAR_URL}
          target="_blank"
          rel="noreferrer"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1db954]/10 border border-[#1db954]/30 px-4 py-2.5 text-sm font-semibold text-[#0e7534] transition-colors hover:bg-[#1db954]/20"
        >
          <img src="https://www.monobank.ua/favicon.ico" alt="" className="h-4 w-4 rounded" onError={e => (e.currentTarget.style.display='none')} />
          MonoBank · Банка
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
        </a>
        <div className="space-y-2">
          {CARDS.map(c => <CopyLine key={c.label} {...c} />)}
        </div>
        <a
          href={AUTHOR_TG}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1.5 text-[11px] text-ink/50 hover:text-gold-ink transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Автор: t.me/oko_gora
        </a>
      </div>
    );
  }

  // article variant — full-width warm card
  return (
    <div className="mt-10 rounded-2xl border border-gold/35 bg-gradient-to-br from-surface to-[#fdf8ed] p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
          <Heart className="h-4.5 w-4.5 text-gold-ink" />
        </span>
        <div>
          <p className="font-semibold text-ink text-base md:text-lg leading-tight">Шановні читачі!</p>
          <p className="text-sm text-ink/60">Якщо бажаєте підтримати нас —</p>
        </div>
      </div>

      <a
        href={MONO_JAR_URL}
        target="_blank"
        rel="noreferrer"
        className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#1db954]/12 border border-[#1db954]/35 px-5 py-3 text-sm font-semibold text-[#0e7534] transition-colors hover:bg-[#1db954]/22 md:w-auto md:inline-flex"
      >
        <img src="https://www.monobank.ua/favicon.ico" alt="" className="h-4 w-4 rounded" onError={e => (e.currentTarget.style.display='none')} />
        MonoBank — Банка підтримки
        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
      </a>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {CARDS.map(c => <CopyLine key={c.label} {...c} />)}
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[12px] text-ink/50">
        <ExternalLink className="h-3 w-3" />
        Автор каналу: <a href={AUTHOR_TG} target="_blank" rel="noreferrer" className="text-gold-ink hover:underline underline-offset-2">t.me/oko_gora</a>
      </div>
    </div>
  );
}
