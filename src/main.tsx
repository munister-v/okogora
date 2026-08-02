import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import AdminPage from './pages/AdminPage.tsx';
import PostPage from './pages/PostPage.tsx';
import InvestigationPage from './pages/InvestigationPage.tsx';
import TargetsPage from './pages/TargetsPage.tsx';
import MaintenancePage from './pages/MaintenancePage.tsx';
import './index.css';

// Site-wide kill switch. Flip back to true to restore normal routing,
// including /admin.
const SITE_ENABLED = false;

if (typeof window !== 'undefined' && window.location.hash && !window.location.hash.startsWith('#/')) {
  const section = window.location.hash.slice(1).replace(/^\/+/, '');
  const nextHash = section ? `#/${section}` : '#/';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        {SITE_ENABLED ? (
          <>
            <Route path="/" element={<App />} />
            <Route path="/map" element={<App />} />
            <Route path="/brigades" element={<App />} />
            <Route path="/analytics" element={<App />} />
            <Route path="/sbs" element={<App />} />
            <Route path="/deepstate" element={<App />} />
            <Route path="/investigations" element={<App />} />
            <Route path="/rss" element={<App />} />
            <Route path="/feed" element={<App />} />
            <Route path="/contacts" element={<App />} />
            <Route path="/post/:id" element={<PostPage />} />
            <Route path="/investigation/:id" element={<InvestigationPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<App />} />
          </>
        ) : (
          <Route path="*" element={<MaintenancePage />} />
        )}
      </Routes>
    </HashRouter>
  </StrictMode>,
);
