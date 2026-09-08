// The assembly is a cascade: seven slots, each with its own moment. If STEP and
// WINDOW ever drift apart, a layer silently never finishes and the plan view
// loses a part — with no error anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { explosionOffset, slotOf } from '../components/movement/explosion-motion.ts';

const center = { x: 1, y: 2, z: .5 };
const target = { x: -3, y: 4, z: 0 };
const cases = [
  ['upper' as const, 4], ['lower' as const, 0],
  [null, 0], [null, 1], [null, 2], [null, 3], [null, 4],
] as const;

void test('nothing has moved at rest, and every layer has landed at full extension', () => {
  for (const [shell, layer] of cases) {
    const at0 = explosionOffset(0, layer, center, target, shell);
    assert.ok(Math.hypot(at0.x, at0.y, at0.z) === 0, `layer ${layer}/${shell} drifts at rest`);
    const at1 = explosionOffset(1, layer, center, target, shell);
    for (const k of ['x', 'y'] as const) {
      assert.ok(Math.abs(at1[k] - (target[k] - center[k])) < 1e-9, `layer ${layer}/${shell} never reaches its ${k} cell`);
    }
    assert.ok(Math.abs(at1.z + center.z) < 1e-9, `layer ${layer}/${shell} never flattens`);
  }
});

void test('the shells part before any plate inside them moves', () => {
  const slots = cases.map(([shell, layer]) => slotOf(layer, shell));
  assert.deepEqual(slots, [0, 1, 2, 3, 4, 5, 6]);
  // At the moment the first plate starts, both shells are already under way.
  const plateStart = 2 * .11;
  for (const shell of ['upper', 'lower'] as const) {
    const open = explosionOffset(plateStart, shell === 'upper' ? 4 : 0, center, target, shell);
    assert.ok(Math.abs(open.z) > .2, `${shell} shell has barely opened when the plates start`);
  }
  const plate = explosionOffset(plateStart, 0, center, target, null);
  assert.ok(Math.hypot(plate.x, plate.y, plate.z) === 0, 'the first plate has already moved before its slot opens');
});
