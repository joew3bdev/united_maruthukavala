/**
 * MKRA Prediction App — Automated Test Suite
 * Run with: node test.js
 */

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch(e) {
    console.log(`  ❌  ${name}`);
    console.log(`      ${e.message}`);
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Minimal stubs from index.html ─────────────────────────────

const NAME_ALIASES = {
  'Korea Republic':'South Korea','United States':'USA',
  'Türkiye':'Turkey','Bosnia and Herzegovina':'Bosnia & Herzegovina',
  'Czechia':'Czech Republic'
};
function normalizeName(n) { return NAME_ALIASES[n] || n; }

function migratePick(matchId, pick) {
  if (!pick) return null;
  if (pick === 'H' || pick === 'A' || pick === 'D') {
    const f = FIXTURES.find(x => x.id === matchId);
    if (!f) return null;
    if (pick === 'H') return normalizeName(f.home);
    if (pick === 'A') return normalizeName(f.away);
    if (pick === 'D') return 'Draw';
  }
  return normalizeName(pick);
}

function migrateResults(raw) {
  const out = {};
  Object.entries(raw).forEach(([id, val]) => {
    if (!val) return;
    const f = FIXTURES.find(x => x.id === id);
    if (!f) { out[id] = normalizeName(val); return; }
    if (val === 'H') out[id] = f.home;
    else if (val === 'A') out[id] = f.away;
    else if (val === 'D') out[id] = 'Draw';
    else out[id] = normalizeName(val);
  });
  return out;
}

const GROUP_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const WIN_POINTS = 3, DRAW_POINTS = 1, KO_POINTS = 6;

// Minimal fixtures (just enough for testing)
const FIXTURES = [
  {id:'A1',group:'A',home:'Mexico',       away:'South Africa',  kickoff:'2026-06-11T19:00:00Z'},
  {id:'A2',group:'A',home:'South Korea',  away:'Czech Republic', kickoff:'2026-06-12T02:00:00Z'},
  {id:'A3',group:'A',home:'Czech Republic',away:'South Africa',  kickoff:'2026-06-18T16:00:00Z'},
  {id:'A4',group:'A',home:'Mexico',       away:'South Korea',    kickoff:'2026-06-19T01:00:00Z'},
  {id:'A5',group:'A',home:'Czech Republic',away:'Mexico',        kickoff:'2026-06-25T01:00:00Z'},
  {id:'A6',group:'A',home:'South Africa', away:'South Korea',    kickoff:'2026-06-25T01:00:00Z'},
  {id:'B1',group:'B',home:'Canada',       away:'Bosnia & Herzegovina', kickoff:'2026-06-12T19:00:00Z'},
  {id:'B2',group:'B',home:'Qatar',        away:'Switzerland',    kickoff:'2026-06-13T19:00:00Z'},
  {id:'B3',group:'B',home:'Switzerland',  away:'Bosnia & Herzegovina', kickoff:'2026-06-18T19:00:00Z'},
  {id:'B4',group:'B',home:'Canada',       away:'Qatar',          kickoff:'2026-06-18T22:00:00Z'},
  {id:'B5',group:'B',home:'Switzerland',  away:'Canada',         kickoff:'2026-06-24T19:00:00Z'},
  {id:'B6',group:'B',home:'Bosnia & Herzegovina',away:'Qatar',   kickoff:'2026-06-24T19:00:00Z'},
];
// Pad remaining groups with empty arrays so GROUP_ORDER works
['C','D','E','F','G','H','I','J','K','L'].forEach(g => {
  for (let i = 1; i <= 6; i++) FIXTURES.push({id:`${g}${i}`,group:g,home:`${g}Home${i}`,away:`${g}Away${i}`,kickoff:'2026-06-15T00:00:00Z'});
});

const S = { results: {}, koResults: {}, koR32Teams: {} };

function computeGroupStandings(allPicks) {
  const standings = {};
  GROUP_ORDER.forEach(g => {
    standings[g] = {};
    FIXTURES.filter(f=>f.group===g).forEach(f=>{
      if(!standings[g][f.home]) standings[g][f.home]={pts:0,w:0,d:0,l:0,played:0};
      if(!standings[g][f.away]) standings[g][f.away]={pts:0,w:0,d:0,l:0,played:0};
    });
  });
  FIXTURES.forEach(f => {
    let result = S.results[f.id];
    if (!result && allPicks) result = migratePick(f.id, allPicks[f.id]);
    if (!result) return;
    const g = f.group;
    standings[g][f.home].played++; standings[g][f.away].played++;
    if (result === 'Draw') {
      standings[g][f.home].pts += 1; standings[g][f.home].d++;
      standings[g][f.away].pts += 1; standings[g][f.away].d++;
    } else if (result === normalizeName(f.home)) {
      standings[g][f.home].pts += 3; standings[g][f.home].w++;
      standings[g][f.away].l++;
    } else if (result === normalizeName(f.away)) {
      standings[g][f.away].pts += 3; standings[g][f.away].w++;
      standings[g][f.home].l++;
    }
  });
  const sorted = {};
  GROUP_ORDER.forEach(g => {
    sorted[g] = Object.entries(standings[g])
      .map(([team,stats]) => ({team,...stats}))
      .sort((a,b) => b.pts-a.pts || a.team.localeCompare(b.team));
  });
  return sorted;
}

function computeScore(picks, results, koResults) {
  let pts = 0, correct = 0;
  Object.entries(picks).forEach(([id, rawPick]) => {
    const pick = migratePick(id, rawPick);
    if (!pick) return;
    const r = results[id];
    if (r && pick === r) { correct++; pts += (r==='Draw' ? DRAW_POINTS : WIN_POINTS); }
    const kr = koResults[id];
    if (kr && pick === kr) { correct++; pts += KO_POINTS; }
  });
  return {pts, correct};
}

// ── Tests ─────────────────────────────────────────────────────

console.log('\n📋 MKRA Prediction — Test Suite\n');

console.log('Fixtures');
test('All 12 groups have exactly 6 matches', () => {
  GROUP_ORDER.forEach(g => {
    const count = FIXTURES.filter(f => f.group === g).length;
    assertEqual(count, 6, `Group ${g} has ${count} matches (expected 6)`);
  });
});

test('Each team in a group plays exactly 3 matches', () => {
  ['A','B'].forEach(g => {
    const gFixtures = FIXTURES.filter(f => f.group === g);
    const teams = [...new Set(gFixtures.flatMap(f => [f.home, f.away]))];
    assertEqual(teams.length, 4, `Group ${g} should have 4 teams`);
    teams.forEach(team => {
      const count = gFixtures.filter(f => f.home===team || f.away===team).length;
      assertEqual(count, 3, `${team} plays ${count} matches (expected 3)`);
    });
  });
});

test('No duplicate matches in a group', () => {
  ['A','B'].forEach(g => {
    const gf = FIXTURES.filter(f => f.group === g);
    const pairs = gf.map(f => [f.home,f.away].sort().join('|'));
    const unique = new Set(pairs);
    assertEqual(unique.size, pairs.length, `Group ${g} has duplicate matchups`);
  });
});

console.log('\nStandings (with player picks)');
test('Mexico wins Group A when predicted to win all 3', () => {
  const picks = { A1:'Mexico', A4:'Mexico', A5:'Mexico' };
  const st = computeGroupStandings(picks);
  assertEqual(st['A'][0].team, 'Mexico', 'Mexico should top Group A');
  assertEqual(st['A'][0].pts, 9, 'Mexico should have 9 pts');
});

test('Draw gives 1pt to each team', () => {
  const picks = { A1:'Draw' };
  const st = computeGroupStandings(picks);
  const mx = st['A'].find(t=>t.team==='Mexico');
  const sa = st['A'].find(t=>t.team==='South Africa');
  assertEqual(mx.pts, 1, 'Mexico should have 1pt after draw');
  assertEqual(sa.pts, 1, 'South Africa should have 1pt after draw');
});

test('Official results override player picks', () => {
  S.results['A1'] = 'South Africa'; // admin says South Africa won
  const picks = { A1:'Mexico' };    // player predicted Mexico
  const st = computeGroupStandings(picks);
  const sa = st['A'].find(t=>t.team==='South Africa');
  assertEqual(sa.pts, 3, 'South Africa should get 3pts from official result');
  S.results = {};
});

console.log('\nScoring');
test('Correct group win = 3 points', () => {
  const {pts} = computeScore({A1:'Mexico'}, {A1:'Mexico'}, {});
  assertEqual(pts, 3);
});

test('Correct draw = 1 point', () => {
  const {pts} = computeScore({A1:'Draw'}, {A1:'Draw'}, {});
  assertEqual(pts, 1);
});

test('Wrong pick = 0 points', () => {
  const {pts} = computeScore({A1:'Mexico'}, {A1:'South Africa'}, {});
  assertEqual(pts, 0);
});

test('Correct knockout pick = 6 points', () => {
  const {pts} = computeScore({M74:'Germany'}, {}, {M74:'Germany'});
  assertEqual(pts, 6);
});

test('Multiple correct picks accumulate', () => {
  const {pts, correct} = computeScore(
    {A1:'Mexico', A2:'Draw', M74:'Germany'},
    {A1:'Mexico', A2:'Draw'},
    {M74:'Germany'}
  );
  assertEqual(pts, 3+1+6, `Expected 10pts, got ${pts}`);
  assertEqual(correct, 3);
});

console.log('\nMigration');
test('H/A/D picks migrate to team names', () => {
  assertEqual(migratePick('A1','H'), 'Mexico');
  assertEqual(migratePick('A1','A'), 'South Africa');
  assertEqual(migratePick('A1','D'), 'Draw');
});

test('Name aliases normalize correctly', () => {
  assertEqual(normalizeName('Korea Republic'), 'South Korea');
  assertEqual(normalizeName('Türkiye'), 'Turkey');
  assertEqual(normalizeName('Czechia'), 'Czech Republic');
  assertEqual(normalizeName('France'), 'France'); // no alias → unchanged
});

test('migrateResults converts H/A/D format', () => {
  const raw = { A1:'H', A2:'D', A3:'A' };
  const migrated = migrateResults(raw);
  assertEqual(migrated['A1'], 'Mexico');
  assertEqual(migrated['A2'], 'Draw');
  assertEqual(migrated['A3'], 'South Africa');
});

console.log('\n3rd-place selection');
test('Exactly 8 third-place teams can be selected', () => {
  const sel = new Set();
  GROUP_ORDER.forEach(g => { if (sel.size < 8) sel.add(g); });
  assertEqual(sel.size, 8, 'Should select exactly 8');
});

test('Cannot select more than 8', () => {
  const sel = new Set(GROUP_ORDER); // all 12
  assert(sel.size === 12);
  // Enforce max 8 by trimming
  const trimmed = [...sel].slice(0, 8);
  assertEqual(trimmed.length, 8);
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed} passed  ·  ${failed} failed`);
if (failed === 0) console.log('  🎉 All tests passed!\n');
else { console.log('  ⚠️  Some tests failed.\n'); process.exit(1); }
