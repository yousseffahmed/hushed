const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/lib/weddingTimeline.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const context = { exports: {}, Date, Intl };
vm.runInNewContext(source, context);
const { isWeddingDate, formatWeddingDate, sortWeddingMoments, validateWeddingInput, validateWeddingFiles } = context.exports;
const input = { title: ' Our rings ', subtitle: '', description: '', type: 'rings', status: 'completed', eventDate: '2026-09-02', plannedDate: null };

test('calendar dates stay local, including leap days', () => {
  for (const zone of ['Pacific/Honolulu', 'Africa/Cairo', 'Pacific/Kiritimati']) {
    process.env.TZ = zone;
    assert.equal(formatWeddingDate('2026-09-02'), '2 September 2026');
  }
  assert.equal(isWeddingDate('2024-02-29'), true);
  for (const date of ['2025-02-29', '2026-02-31', '2026-13-01', '2026-09-00', '2026-9-2', '1800-01-01']) assert.equal(isWeddingDate(date), false);
});

test('past then future, chronological dates with undated plans last, no source mutation', () => {
  const fixture = [
    { id: 'undated', status: 'upcoming', plannedDate: null, createdAt: '' },
    { id: 'later', status: 'completed', eventDate: '2026-09-02', createdAt: '' },
    { id: 'future', status: 'upcoming', plannedDate: '2027-01-01', createdAt: '' },
    { id: 'earlier', status: 'completed', eventDate: '2025-01-01', createdAt: '' }
  ];
  assert.equal(sortWeddingMoments(fixture).map((m) => m.id).join(','), 'earlier,later,future,undated');
  assert.equal(fixture[0].id, 'undated');
});

test('shared editor cannot accidentally write server metadata or the partner note', () => {
  const result = validateWeddingInput({ ...input, notesByUid: { other: 'private' }, photos: [], createdAt: 'wrong' });
  assert.equal(result.title, 'Our rings');
  assert.equal('notesByUid' in result, false);
  assert.equal('photos' in result, false);
  assert.equal('createdAt' in result, false);
  assert.equal(validateWeddingInput({ ...input, status: 'upcoming' }).eventDate, null);
  assert.throws(() => validateWeddingInput({ ...input, title: ' ' }));
  assert.throws(() => validateWeddingInput({ ...input, eventDate: null }));
  assert.throws(() => validateWeddingInput({ ...input, type: 'invalid' }));
  assert.throws(() => validateWeddingInput({ ...input, eventDate: '2025-02-29' }));
});

test('photos reject empty, oversize, unsupported and over-capacity selections', () => {
  const file = { type: 'image/jpeg', size: 1000 };
  assert.doesNotThrow(() => validateWeddingFiles([file], 9));
  assert.throws(() => validateWeddingFiles([file], 10));
  assert.throws(() => validateWeddingFiles([{ ...file, size: 0 }], 0));
  assert.throws(() => validateWeddingFiles([{ ...file, size: 5 * 1024 * 1024 + 1 }], 0));
  assert.throws(() => validateWeddingFiles([{ ...file, type: 'image/svg+xml' }], 0));
  assert.throws(() => validateWeddingFiles([{ ...file, type: 'text/html' }], 0));
});
