import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2] || 'app';
const domain = await import(pathToFileURL(path.resolve(root,'src','domain.js')).href + '?policy-test=1');
const pricing = await import(pathToFileURL(path.resolve(root,'src','pricing.js')).href + '?policy-test=1');

const commissionCases = [
  [99,5],[100,10],[199,10],[200,20],[299,20],[300,30],[399,30],[400,40]
];
for (const [fare, expected] of commissionCases) {
  assert.equal(domain.commissionForFare(fare), expected, 'commission '+fare);
}

const plain = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T11:00');
assert.equal(plain.baseFare ?? plain.fare, 170, 'Rishon base fare');
assert.equal(plain.fare, 170, 'plain fare');

const morningPeak = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T08:00');
assert.equal(morningPeak.fare, 180, 'morning peak +5%, rounded up to 5');

const morningEdge = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T09:30');
assert.equal(morningEdge.fare, 180, '09:30 remains peak');
const morningAfter = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T09:31');
assert.equal(morningAfter.fare, 170, '09:31 leaves morning peak');

const afternoonPeak = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T15:00');
assert.equal(afternoonPeak.fare, 180, 'afternoon peak +5%, rounded up to 5');
const eveningEdge = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T18:00');
assert.equal(eveningEdge.fare, 180, '18:00 remains peak');
const eveningAfter = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-05T18:01');
assert.equal(eveningAfter.fare, 170, '18:01 leaves afternoon peak');

const fridayBefore = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-09T15:59');
assert.equal(fridayBefore.fare, 180, 'Friday 15:59 has peak only, Shabbat has not started');

const fridayStart = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-09T16:00');
assert.equal(fridayStart.fare, 205, 'Friday 16:00 starts commercial Shabbat and stacks with peak');

const shabbat = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-10T11:00');
assert.equal(shabbat.fare, 200, 'Shabbat +15%, rounded up to 5');

const saturdayEnd = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-10T20:00');
assert.equal(saturdayEnd.fare, 200, 'Saturday 20:00 remains inside commercial Shabbat');

const saturdayAfter = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-10T20:01');
assert.equal(saturdayAfter.fare, 170, 'Saturday 20:01 exits commercial Shabbat');

const overlap = pricing.quoteAirportRoute('ראשון לציון','נתב״ג','2026-10-10T15:00');
assert.equal(overlap.fare, 205, 'peak + Shabbat additive 20%, rounded up to 5');
assert.equal(overlap.commission, 20, 'commission recalculated from final fare');
assert.equal(overlap.driverNet, 185, 'driver net from final fare');

console.log('TAXI4_POLICY_TEST_OK', JSON.stringify({
  commissionCases:commissionCases.length,
  plain:plain.fare,
  morningPeak:morningPeak.fare,
  morningEdge:morningEdge.fare,
  morningAfter:morningAfter.fare,
  afternoonPeak:afternoonPeak.fare,
  eveningEdge:eveningEdge.fare,
  eveningAfter:eveningAfter.fare,
  fridayBefore:fridayBefore.fare,
  fridayStart:fridayStart.fare,
  shabbat:shabbat.fare,
  saturdayEnd:saturdayEnd.fare,
  saturdayAfter:saturdayAfter.fare,
  overlap:overlap.fare
}));
