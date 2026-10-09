import React from 'react';

// Claude отдаёт анализ в markdown (`##`, `**`, списки, таблицы), а мы выводили его
// как plain text — получалась простыня с решётками. Этот компонент разбирает
// подмножество markdown вручную, чтобы не тянуть зависимость ради одного блока.

// Inline: **bold**, __bold__, *italic*, _italic_, `code`
const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

function renderInline(text, keyBase) {
  return String(text)
    .split(INLINE_RE)
    .filter((part) => part !== '' && part !== undefined)
    .map((part, i) => {
      const key = `${keyBase}-i${i}`;
      if (/^\*\*[\s\S]+\*\*$/.test(part) || /^__[\s\S]+__$/.test(part)) {
        return <strong key={key} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (/^`[\s\S]+`$/.test(part)) {
        return <code key={key} className="bg-white/10 px-1 py-0.5 rounded font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
      }
      if (/^\*[\s\S]+\*$/.test(part) || /^_[\s\S]+_$/.test(part)) {
        return <em key={key} className="text-gray-300">{part.slice(1, -1)}</em>;
      }
      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

const HEADING_CLASS = {
  1: 'text-lg sm:text-xl font-bold text-white',
  2: 'text-lg font-bold text-white',
  3: 'text-base font-semibold text-blue-200',
  4: 'text-sm font-semibold text-gray-100',
  5: 'text-sm font-semibold text-gray-100',
  6: 'text-sm font-semibold text-gray-300'
};

// Отступы сверху задаём одним классом: если написать mt-5 и mt-0 одновременно,
// победит не порядок в атрибуте class, а порядок в сгенерированном CSS
const headingMargin = (level, isFirst) =>
  isFirst ? 'mt-0' : level <= 2 ? 'mt-5 mb-2' : level === 3 ? 'mt-4 mb-1.5' : 'mt-3 mb-1';


function parseCells(row) {
  return row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

const isSeparatorRow = (row) => /^\|?[\s:|-]+\|?$/.test(row) && row.includes('-');

export default function MarkdownLite({ text, className = '' }) {
  if (!text) return null;

  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];

  let para = [];
  let list = null; // { type: 'ul' | 'ol', items: [{ text, sub: [] }] }
  let quote = [];
  let table = [];
  let code = null;

  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join('\n') }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  const flushQuote = () => { if (quote.length) { blocks.push({ type: 'quote', text: quote.join('\n') }); quote = []; } };
  const flushTable = () => { if (table.length) { blocks.push({ type: 'table', rows: table }); table = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (code !== null) {
      if (/^```/.test(trimmed)) { blocks.push({ type: 'code', text: code.join('\n') }); code = null; }
      else code.push(raw);
      continue;
    }
    if (/^```/.test(trimmed)) { flushAll(); code = []; continue; }
    if (!trimmed) { flushAll(); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) { flushAll(); blocks.push({ type: 'h', level: heading[1].length, text: heading[2] }); continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flushAll(); blocks.push({ type: 'hr' }); continue; }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushPara(); flushList(); flushQuote();
      table.push(trimmed);
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushPara(); flushList(); flushTable();
      quote.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    const indented = /^\s{2,}/.test(raw);

    // Вложенный пункт — приклеиваем к предыдущему элементу того же списка
    if (bullet && indented && list?.type === 'ul' && list.items.length) {
      list.items[list.items.length - 1].sub.push(bullet[1]);
      continue;
    }
    if (bullet) {
      flushPara(); flushQuote(); flushTable();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push({ text: bullet[1], sub: [] });
      continue;
    }
    if (ordered) {
      flushPara(); flushQuote(); flushTable();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push({ text: ordered[2], sub: [] });
      continue;
    }

    flushList(); flushQuote(); flushTable();
    para.push(trimmed);
  }
  flushAll();
  if (code !== null) blocks.push({ type: 'code', text: code.join('\n') }); // незакрытый ``` — не теряем текст


  return (
    <div className={`text-gray-200 leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h':
            return React.createElement(
              `h${Math.min(block.level + 1, 6)}`, // в карточке h1 был бы слишком крупным
              { key: i, className: `${HEADING_CLASS[block.level]} ${headingMargin(block.level, i === 0)}` },
              renderInline(block.text, `h${i}`)
            );

          case 'ul':
          case 'ol':
            return React.createElement(
              block.type,
              { key: i, className: `${block.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1 my-2 marker:text-blue-300` },
              block.items.map((item, j) => (
                <li key={j}>
                  {renderInline(item.text, `l${i}-${j}`)}
                  {item.sub.length > 0 && (
                    <ul className="list-[circle] pl-5 mt-1 space-y-0.5 text-gray-300 marker:text-gray-500">
                      {item.sub.map((sub, k) => <li key={k}>{renderInline(sub, `s${i}-${j}-${k}`)}</li>)}
                    </ul>
                  )}
                </li>
              ))
            );

          case 'quote':
            return (
              <blockquote key={i} className="border-l-2 border-blue-500/50 pl-3 my-3 text-gray-300 italic">
                {renderInline(block.text, `q${i}`)}
              </blockquote>
            );

          case 'hr':
            return <hr key={i} className="border-white/10 my-4" />;

          case 'code':
            return (
              <pre key={i} className="bg-black/40 border border-white/10 rounded-lg p-3 my-3 text-sm font-mono overflow-x-auto whitespace-pre">
                {block.text}
              </pre>
            );

          case 'table': {
            const rows = block.rows.filter((r) => !isSeparatorRow(r)).map(parseCells);
            if (rows.length === 0) return null;
            return (
              <div key={i} className="my-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {rows[0].map((cell, j) => (
                        <th key={j} className="text-left font-semibold text-white px-2 py-1.5 border-b border-white/20 bg-white/5">
                          {renderInline(cell, `th${i}-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(1).map((row, r) => (
                      <tr key={r} className="even:bg-white/[0.03]">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1.5 border-b border-white/10 align-top">
                            {renderInline(cell, `td${i}-${r}-${j}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case 'p':
          default:
            return (
              <p key={i} className="my-2 whitespace-pre-line">
                {renderInline(block.text, `p${i}`)}
              </p>
            );
        }
      })}
    </div>
  );
}

