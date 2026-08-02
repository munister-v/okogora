export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        background: '#0e0f0c',
        color: '#f4f5f3',
        fontFamily: 'Geist Variable, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '20px' }} aria-hidden="true">
        😴
      </div>
      <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.01em', color: '#ffffff' }}>
        Око Гора моргнуло
      </h1>
      <p style={{ maxWidth: '460px', color: 'rgba(244,245,243,.72)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 28px' }}>
        Технічна перерва — навіть тотальний візуальний контроль іноді йде по каву.
        Скоро розплющимося знову.
      </p>
      <a
        href="https://t.me/oko_gora"
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 22px',
          borderRadius: '999px',
          background: '#c9a227',
          color: '#0e0f0c',
          fontWeight: 600,
          fontSize: '13px',
          textDecoration: 'none',
          letterSpacing: '0.02em',
        }}
      >
        Стежити в Telegram →
      </a>
    </div>
  );
}
