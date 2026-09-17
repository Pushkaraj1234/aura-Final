/**
 * The trajectory charts.
 *
 * Both keyed their x-axis on a formatted date ("Sep 8"). Several check-ins
 * commonly fall on the same day, so a category axis collapsed them: hovering
 * anywhere in a duplicated band resolved to whichever point recharts matched
 * first, and the tooltip and the highlighted dot disagreed with the cursor.
 * Neither chart drew a dot at all.
 *
 * The trajectory is the point of this product, so this is pinned rather than
 * left to look right on whichever dataset happened to be open.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const CHARTS = [
  ['participant trajectory', 'src/pages/ParticipantProfile.tsx'],
  ['counsellor trajectory', 'src/pages/ParticipantDetail.tsx'],
];

for (const [name, rel] of CHARTS) {
  const src = read(rel);

  t(`${name}: the x key is unique per point`, () => {
    ok(/dataKey="i"/.test(src),
       'the axis must key on the index, not on a date that repeats');
    ok(!/<XAxis dataKey="(timestamp|date)"/.test(src),
       'keying on a formatted date collapses same-day check-ins');
  });

  t(`${name}: the date is still what a reader sees`, () => {
    ok(/tickFormatter=\{(chartLabel|trendLabel)\}/.test(src),
       'indices on the axis would be meaningless to a person');
    ok(/labelFormatter=\{\(i: number\) => (chartLabel|trendLabel)\(i\)\}/.test(src),
       'and the tooltip must name the date too');
  });

  t(`${name}: every check-in is a visible point`, () => {
    ok(/dot=\{\{ r: 2\.5/.test(src),
       'without dots the line is a shape with no readable readings on it');
    ok(/activeDot=\{\{ r: 6/.test(src),
       'and the hovered point must be marked');
  });

  t(`${name}: the active dot reads against both line and fill`, () => {
    ok(/activeDot=\{\{ r: 6, fill: "#[0-9A-F]{6}", stroke: "#FFFFFF", strokeWidth: 2 \}\}/i.test(src),
       'a white ring is what separates it from the area underneath');
  });

  t(`${name}: the tooltip reading is legible on its own background`, () => {
    // Recharts colours the value with the series stroke, #5A5049, which is
    // 1.54:1 on the dark tooltip. The reading is the entire point of hovering.
    ok(/itemStyle=\{\{ color: "#F5EDE1" \}\}/.test(src),
       'the value colour must be set, not inherited from the line');
    ok(/labelStyle=\{\{ color: "#FFFFFF"/.test(src),
       'and the date above it too');
  });

  t(`${name}: the label helper cannot throw on a missing point`, () => {
    ok(/\?\.(timestamp|date) \?\? ""/.test(src),
       'recharts calls the formatter for ticks that have no datum');
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
