// Проверяет, что все словари совпадают с английским по ключам: новая строка в en.json
// без перевода в остальных языках иначе молча падает на английский, и это легко проглядеть.
// Запуск: node scripts/check-i18n.mjs (из frontend/) — код выхода 1, если есть расхождения.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const I18N_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n');

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, prefix + k + '.') : [prefix + k]
  );

const read = (lang) => JSON.parse(fs.readFileSync(path.join(I18N_DIR, lang + '.json'), 'utf8'));

const langs = fs.readdirSync(I18N_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const reference = 'en';
if (!langs.includes(reference)) {
  console.error(`No ${reference}.json in ${I18N_DIR}`);
  process.exit(1);
}

const enKeys = flatten(read(reference));
let problems = 0;

for (const lang of langs) {
  const keys = flatten(read(lang)); // read() бросит исключение битого JSON — это тоже ошибка
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  if (missing.length || extra.length) {
    problems += missing.length + extra.length;
    console.log(`${lang}: ${missing.length ? 'MISSING ' + missing.join(', ') : ''}${missing.length && extra.length ? ' | ' : ''}${extra.length ? 'NOT_IN_EN ' + extra.join(', ') : ''}`);
  }
}

if (problems) {
  console.error(`i18n check failed: ${problems} key difference(s) against ${reference}.json (${enKeys.length} keys)`);
  process.exit(1);
}
console.log(`i18n OK: ${langs.length} languages, ${enKeys.length} keys each`);
