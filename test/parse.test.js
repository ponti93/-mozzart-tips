import { parseTips, looksLikeTip, isPlaceholder } from '../src/parse.js';

const P = (color, text) =>
  `<p style="text-align:center; color: ${color}; font-size:135%;">${text}</p>`;

const samples = [
  // placeholders that must never be announced
  ['...', true],
  ['…', true],
  ['Tips coming soon at 18:00', true],
  ['will be posted soon', true],
  ['Stay tuned : tips at 20:00', true],
  ['No tips today', true],
  // real tips
  ['20:45 Fiorentina – Atalanta : Over 2.5 @ 1.50', false],
  ['01:00 Bolivar – U. de Vinto : Over 3.5 @ 1.60', false],
  ['17:00 Radnicki Nis – Partizan : 2 @ 1.80', false],
  ['20:00 Al Ahli SC – Al Khaleej : Over 2.5 @ 1.55', false],
];

let failed = 0;
for (const [text, shouldBePlaceholder] of samples) {
  const got = !looksLikeTip(text);
  const ok = got === shouldBePlaceholder;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${shouldBePlaceholder ? 'placeholder' : 'tip        '}  ${text}`);
}

// whole-page behaviour: placeholders are flagged, VIP blocks are labelled
const html = [
  '<p style="color:white">Single :</p>',
  P('white', 'Tips coming soon at 18:00'),
  '<p style="color:white">Single :</p>',
  P('lime', '20:45 Fiorentina &#8211; Atalanta : Over 2.5 @ 1.50'),
  '<p style="color:white">VIP MATCH :</p>',
  P('white', '19:00 Arsenal &#8211; Chelsea : 1 @ 1.70'),
].join('\n');

const tips = parseTips(html);
console.log('\nparsed:');
for (const t of tips) console.log(`  ${t.label.padEnd(9)} ${t.kind.padEnd(11)} ${t.status.padEnd(8)} ${t.text}`);

const singles = tips.filter((t) => t.label === 'Single' && t.kind === 'tip');
if (singles.length !== 1 || singles[0].text.indexOf('Fiorentina') === -1) {
  failed++;
  console.log('FAIL: expected exactly one Single tip (Fiorentina)');
} else {
  console.log('ok    only the real Single tip is announced');
}

// sanity: entity decoding + separator preserved
if (!singles[0].text.includes('–')) {
  failed++;
  console.log('FAIL: en dash not decoded');
}

console.log(failed ? `\n${failed} failure(s)` : '\nall good');
process.exit(failed ? 1 : 0);
