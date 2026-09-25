import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPhrases, repairWords, retimePhrase, sanitizePhrases, toSrt } from './captionUtils';
import { findActive } from './captionRenderer';

const w = (word: string, start: number, end: number) => ({ word, start, end });

test('repairWords sorts, drops junk and fixes overlapping times', () => {
  const out = repairWords([
    w('world', 1, 1.4),
    w('', 0.2, 0.4),
    w('hello', 0.5, 1.2), // overlaps "world"
    { word: 'bad', start: NaN, end: 1 } as any,
    null as any,
  ]);
  assert.deepEqual(out.map((x) => x.word), ['hello', 'world']);
  assert.ok(out[1].start >= out[0].end, 'words must not overlap');
});

test('repairWords caps words stretched over long pauses', () => {
  const [word] = repairWords([w('hi', 0, 6)]);
  assert.ok(word.end - word.start <= 0.5 + 1e-9);
});

test('repairWords enforces a minimum on-screen duration', () => {
  const [word] = repairWords([w('a', 1, 1.01)]);
  assert.ok(word.end - word.start >= 0.12 - 1e-9);
});

test('repairWords survives non-array input', () => {
  assert.deepEqual(repairWords(undefined as any), []);
});

test('buildPhrases splits on max words and on pauses', () => {
  const words = [w('a', 0, 0.2), w('b', 0.2, 0.4), w('c', 0.4, 0.6), w('d', 2, 2.2)];
  const phrases = buildPhrases(words, 2);
  assert.deepEqual(phrases.map((p) => p.words.map((x) => x.word).join(' ')), ['a b', 'c', 'd']);
  assert.equal(phrases[0].start, 0);
  assert.equal(phrases[0].end, 0.4);
});

test('sanitizePhrases repairs stored data without crashing', () => {
  const out = sanitizePhrases([
    { id: 'x', start: 0, end: 1, words: [w('ok', 0, 1)] },
    { id: 'y', words: 'not-an-array' },
    null,
    { words: [w('late', 5, 4)] }, // end before start, missing id
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'x');
  assert.ok(out[1].id, 'missing ids are generated');
  assert.ok(out[1].end > out[1].start);
  assert.deepEqual(sanitizePhrases('garbage'), []);
});

test('sanitizePhrases keeps user-edited timings untouched', () => {
  const phrase = { id: 'p', start: 0, end: 4, words: [w('longword', 0, 4)] };
  assert.equal(sanitizePhrases([phrase])[0].words[0].end, 4);
});

test('retimePhrase spreads edited words across the original span', () => {
  const p = retimePhrase({ id: 'p', start: 1, end: 3, words: [w('old', 1, 3)] }, 'new text here');
  assert.equal(p.words.length, 3);
  assert.equal(p.words[0].start, 1);
  assert.equal(p.words[2].end, 3);
});

test('toSrt formats timestamps and applies offset', () => {
  const srt = toSrt([{ id: 'p', start: 61.5, end: 62.25, words: [w('hi', 61.5, 62.25)] }], 0.5);
  assert.equal(srt, '1\n00:01:01,000 --> 00:01:01,750\nhi\n');
});

test('findActive picks the right phrase and word', () => {
  const phrases = buildPhrases([w('a', 0, 0.3), w('b', 0.3, 0.6), w('c', 5, 5.3)], 5);
  assert.deepEqual(findActive(phrases, 0.4), { phrase: 0, word: 1, speaking: true });
  assert.equal(findActive(phrases, 3).phrase, -1, 'nothing shown during long silence');
  assert.equal(findActive(phrases, 5.1).phrase, 1);
  assert.equal(findActive([], 1).phrase, -1);
});
