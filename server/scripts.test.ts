import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devanagariToHinglish, expectedScript, needsScriptFix, scriptShares } from './scripts';

test('devanagariToHinglish writes everyday Hindi the way people type it', () => {
  const cases: [string, string][] = [
    ['नमस्ते', 'namaste'],
    ['दोस्तों', 'doston'],
    ['बात', 'baat'],
    ['करेंगे', 'karenge'],
    ['करना', 'karna'],
    ['अपने', 'apne'],
    ['समझना', 'samajhna'],
    ['नहीं', 'nahin'],
    ['हैं', 'hain'],
    ['क्या', 'kya'],
    ['प्यार', 'pyaar'],
    ['फ़िल्म', 'film'],
    ['ज़िंदगी', 'zindgi'],
  ];
  for (const [hindi, expected] of cases) assert.equal(devanagariToHinglish(hindi), expected, hindi);
});

test('devanagariToHinglish keeps Latin words, digits and spacing', () => {
  assert.equal(devanagariToHinglish('video को like करो १२३'), 'video ko like karo 123');
  assert.equal(devanagariToHinglish('हाँ।'), 'haan.');
  assert.equal(devanagariToHinglish(''), '');
});

test('devanagariToHinglish never throws on odd input', () => {
  for (const s of ['्', 'ं', '़', 'ाि', '😀 नमस्ते', 'क्‍ष']) assert.equal(typeof devanagariToHinglish(s), 'string');
});

test('expectedScript maps languages to scripts', () => {
  assert.equal(expectedScript('Hinglish'), 'Latin');
  assert.equal(expectedScript('Hindi'), 'Devanagari');
  assert.equal(expectedScript('Punjabi'), 'Gurmukhi');
  assert.equal(expectedScript('Urdu'), 'Arabic');
  assert.equal(expectedScript('Japanese'), null);
});

test('needsScriptFix spots captions in the wrong script', () => {
  assert.equal(needsScriptFix('वीडियो को लाइक करो', 'Hinglish'), true);
  assert.equal(needsScriptFix('video ko like karo', 'Hinglish'), false);
  assert.equal(needsScriptFix('सत श्री अकाल', 'Punjabi'), true);
  assert.equal(needsScriptFix('ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'Punjabi'), false);
  assert.equal(needsScriptFix('नमस्ते video दोस्तों', 'Hindi'), false, 'a few English words in Hindi are fine');
  assert.equal(needsScriptFix('anything', 'Japanese'), false, 'unknown targets are left alone');
});

test('scriptShares ignores digits and punctuation', () => {
  assert.deepEqual(scriptShares('ab, 12 !'), { Latin: 1 });
});
