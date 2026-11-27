import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getExportVideoBitrate, isExportFps, isExportQuality } from './exportSettings';

test('high quality at 30 fps preserves the previous resolution-based bitrate', () => {
  assert.equal(getExportVideoBitrate(1080, 1920, 30, 'high'), 9_331_200);
});

test('frame rate scales bitrate and quality choices change bitrate', () => {
  const high30 = getExportVideoBitrate(1080, 1920, 30, 'high');
  assert.equal(getExportVideoBitrate(1080, 1920, 60, 'high'), high30 * 2);
  assert.ok(getExportVideoBitrate(1080, 1920, 30, 'standard') < high30);
  assert.ok(getExportVideoBitrate(1080, 1920, 30, 'maximum') > high30);
});

test('export preferences accept only supported options', () => {
  assert.equal(isExportFps(24), true);
  assert.equal(isExportFps(25), false);
  assert.equal(isExportQuality('maximum'), true);
  assert.equal(isExportQuality('ultra'), false);
});
