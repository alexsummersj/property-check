import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Loader2, AlertCircle, MapPin, Eye } from 'lucide-react';
import MarkdownLite from './MarkdownLite';
import { getTranslation } from './i18n';

// Публичная страница отчёта: открывается по ссылке /#a/<id> без входа в аккаунт.
// Ключи подписи режима совпадают с ANALYSIS_MODES в real_estate_agent.jsx.
const MODE_LABELS = {
  overview: 'analysis.overview',
  news: 'analysis.news',
  growth: 'analysis.growth',
  risks: 'analysis.risks',
  comparison: 'analysis.regions',
  timeline: 'analysis.timeline',
  custom: 'analysis.customQuestion'
};

// Язык страницы: тот, на котором генерировали отчёт, иначе язык браузера
const detectLanguage = (share) => {
  if (share && share.language) return String(share.language).slice(0, 2);
  try { return (navigator.language || 'en').slice(0, 2); } catch { return 'en'; }
};

export default function SharedReport({ shareId, onEnterApp }) {
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/share/${encodeURIComponent(shareId)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !d.share) {
          setShare(null);
          setError(d.error || 'Link not found');
        } else {
          setShare(d.share);
          setError('');
          setLang(detectLanguage(d.share));
        }
      })
      .catch(() => { if (!cancelled) setError('Connection error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shareId]);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    } catch {}
  }, [lang]);

  const t = (path) => getTranslation(lang, path);
  const savedDate = (() => {
    if (!share || !share.savedAt) return '';
    try { return new Date(share.savedAt).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{t('shared.title')}</h1>
            <p className="text-xs text-gray-400">{t('shared.subtitle')}</p>
          </div>
          <button onClick={onEnterApp} className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />{t('shared.analyzeYours')}
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center gap-3 text-gray-400 py-16">
            <Loader2 className="w-5 h-5 animate-spin" /><span>{t('shared.loading')}</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-8 bg-white/5 border border-white/10 rounded-2xl text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-yellow-400 opacity-80" />
            <p className="text-gray-300">{t('shared.notFound')}</p>
            <button onClick={onEnterApp} className="mt-5 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-sm font-medium transition">
              {t('shared.analyzeYours')}
            </button>
          </div>
        )}

        {!loading && share && (
          <article className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
            <header className="mb-6 pb-5 border-b border-white/10">
              <h2 className="text-xl md:text-2xl font-bold flex items-start gap-2">
                <Building2 className="w-5 h-5 mt-1 shrink-0 text-blue-400" />
                <span>{share.title || t('shared.untitled')}</span>
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                {share.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{share.location}</span>}
                <span className="px-2 py-1 bg-white/10 rounded text-gray-300">{t(MODE_LABELS[share.mode] || 'analysis.results')}</span>
                {savedDate && <span>🗂 {savedDate}</span>}
                {typeof share.views === 'number' && <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{share.views}</span>}
              </div>
              {share.question && <p className="mt-3 text-sm text-gray-400">“{share.question}”</p>}
            </header>

            <MarkdownLite text={share.text} />

            <footer className="mt-8 pt-5 border-t border-white/10 text-center">
              <p className="text-sm text-gray-400 mb-4">{t('shared.footer')}</p>
              <button onClick={onEnterApp} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-sm font-medium transition">
                {t('shared.analyzeYours')}
              </button>
            </footer>
          </article>
        )}
      </main>
    </div>
  );
}
