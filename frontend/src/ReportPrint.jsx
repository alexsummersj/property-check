// Печатный лист A4 для кнопки «PDF»: браузер сам превращает его в PDF через
// «Сохранить как PDF», поэтому шрифты и RTL (ar) берутся системные, а текст остаётся
// векторным и выделяемым. Экран приложения при печати скрывается print:hidden,
// этот блок наоборот — hidden на экране, print:block. Цвета задаёт print.css.
import { useLanguage, useT } from './i18n/LanguageContext';
import MarkdownLite from './MarkdownLite';

const MODE_LABELS = {
  overview: 'analysis.overview',
  news: 'analysis.news',
  growth: 'analysis.growth',
  risks: 'analysis.risks',
  comparison: 'analysis.regions',
  timeline: 'analysis.timeline',
  custom: 'analysis.customQuestion'
};

// doc = { property, risk, analysis, analysisInfo, summary } — его кладёт сюда приложение
// (real_estate_agent.jsx), потому что именно там живут объект, риск и текст отчёта.
export default function ReportPrint({ doc }) {
  const t = useT();
  const { language } = useLanguage();

  const property = doc?.property;
  const risk = doc?.risk;
  const analysis = doc?.analysis;
  const analysisInfo = doc?.analysisInfo;
  const summary = doc?.summary || [];

  if (!analysis) return null;

  const score = typeof risk?.overallRisk === 'number' ? risk.overallRisk : null;
  const riskLabel = score == null ? '' : score <= 35 ? t('risk.low') : score <= 60 ? t('risk.medium') : t('risk.high');
  const savedDate = (() => {
    const iso = analysisInfo?.createdAt;
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; }
  })();

  return (
    <div className="print-sheet hidden print:block text-slate-900">
      <header className="avoid-break mb-4 pb-2 border-b border-slate-300">
        <p className="text-[9pt] uppercase tracking-wider text-slate-500">{t('print.header')}</p>
        <h1 className="text-2xl font-bold leading-tight mt-1">{property?.name || t('shared.untitled')}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {[property?.location, t(MODE_LABELS[analysisInfo?.mode] || 'analysis.results'), savedDate].filter(Boolean).join(' · ')}
        </p>
      </header>

      {analysisInfo?.question && (
        <p className="avoid-break text-sm italic text-slate-600 mb-4">“{analysisInfo.question}”</p>
      )}

      {summary.length > 0 && (
        <section className="avoid-break mb-5">
          <h2 className="text-[10pt] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('print.summary')}</h2>
          <table className="w-full text-sm">
            <tbody>
              {summary.map((row) => (
                <tr key={row.label}>
                  <th className="text-left font-medium text-slate-500 py-0.5 pr-3 align-top w-40">{row.label}</th>
                  <td className="py-0.5 font-medium">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {risk && (
        <section className="avoid-break mb-5">
          <h2 className="text-[10pt] font-bold uppercase tracking-wide text-slate-500 mb-1">
            {t('risk.title')}{score == null ? '' : `: ${score}% ${riskLabel}`}
          </h2>
          {risk.summary && <p className="text-sm mb-2">{risk.summary}</p>}
          {risk.factors && (
            <ul className="text-sm space-y-0.5">
              {Object.entries(risk.factors).map(([key, factor]) => (
                <li key={key}>
                  <span className="font-medium">{t(`risk.factors.${key}`)}</span>
                  {typeof factor?.score === 'number' ? ` — ${factor.score}%` : ''}
                  {factor?.reason ? `: ${factor.reason}` : ''}
                </li>
              ))}
            </ul>
          )}
          {risk.recommendations?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10pt] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('risk.recommendations')}</p>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {risk.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      <MarkdownLite text={analysis} />

      <footer className="mt-6 pt-2 border-t border-slate-300 text-[9pt] text-slate-500">
        property-check.com · {t('print.printedOn')} {new Date().toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })} · {t('print.disclaimer')}
      </footer>
    </div>
  );
}
