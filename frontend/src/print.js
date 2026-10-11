// Печать отчёта = «Сохранить как PDF» средствами браузера: векторный текст, системные
// шрифты (важно для ar/zh/ja/th/ka) и нулевой рост бандла. Имя файла браузер берёт из
// document.title, поэтому меняем его на время диалога и возвращаем обратно.
export const printAsPdf = (fileName) => {
  const prev = document.title;
  if (fileName) document.title = fileName;
  const restore = () => {
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  // Пауза в один кадр: React успевает дорендерить печатный лист до открытия диалога
  setTimeout(() => window.print(), 50);
};

// «Palm Jumeirah Villa» + «overview» → «Palm-Jumeirah-Villa-overview»
export const reportFileName = (name, mode) => {
  const safe = String(name || 'property')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'property';
  return `${safe}-${mode || 'analysis'}`;
};
