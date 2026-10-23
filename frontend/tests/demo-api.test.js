import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi } from '../src/demo-api.js';
function fixture() {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) };
  const api = createDemoApi(storage);
  return { api, storage, post: (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify(body) }) };
}
test('plates, reservation, ANPR, parking, exit and persistence', async () => {
  const { api, storage, post } = fixture();
  assert.equal((await api('/bootstrap')).spaces.length, 20);
  await post('/users/1/vehicles', { vehicle_plate: 'abc 123' });
  await assert.rejects(post('/users/1/vehicles', { vehicle_plate: 'ABC123' }), /already registered/);
  await assert.rejects(post('/users/1/vehicles', { vehicle_plate: 'WXY4401' }), /already registered/);
  await assert.rejects(post('/users/1/vehicles', { vehicle_plate: '  ' }));
  const booking = { space_id: 13, vehicle_plate: 'ABC 123', start_time: new Date().toISOString(), end_time: new Date(Date.now()+3600000).toISOString() };
  const r = await post('/reservations', booking);
  await assert.rejects(post('/reservations', { ...booking, space_id: 16 }), /active booking/);
  const signal = { space_id: 13, vehicle_plate: 'ABC 123' };
  await assert.rejects(post('/simulation/occupancy', { ...signal, occupied: true }), /ANPR/);
  assert.equal((await post('/simulation/anpr', { ...signal, vehicle_plate: 'WRONG' })).verified, false);
  assert.equal((await post('/simulation/anpr', signal)).verified, true);
  await post('/simulation/occupancy', { ...signal, occupied: true });
  const restored = await createDemoApi(storage)('/bootstrap');
  assert.equal(restored.reservations.find(x=>x.id===r.id).status, 'CHECKED_IN');
  assert.equal(restored.spaces.find(x=>x.id===13).bollard_status, 'LOWERED');
  await post('/simulation/occupancy', { ...signal, occupied: false });
  assert.equal((await api('/bootstrap')).spaces.find(x=>x.id===13).bollard_status, 'RAISED');
  const again = await post('/reservations', booking);
  await post(`/reservations/${again.id}/cancel`);
  assert.equal((await api('/bootstrap')).spaces.find(x=>x.id===13).status, 'AVAILABLE');
});
test('enforcement, reroute, escalation, reports, reset, isolated browsers', async () => {
  const { api, post } = fixture();
  assert.equal((await post('/simulation/overstay/1', { minutes_over: 5 })).overstay_stage, 'GRACE');
  const penalty = await post('/simulation/overstay/1', { minutes_over: 15 });
  assert.equal(penalty.penalty_amount, 20);
  let d = await api('/bootstrap');
  assert.equal(d.reservations[1].rerouted_from_space_id, 14);
  assert.notEqual(d.reservations[1].space_id, 14);
  assert.equal((await post('/simulation/overstay/1', { minutes_over: 35 })).escalation_status, 'SECURITY_NOTIFIED');
  await assert.rejects(post('/simulation/overstay/1', { minutes_over: 5 }), /backwards/);
  const report = await post('/reports', { category: 'Lighting', location: 'G-01', description: 'Demo broken light' });
  await api(`/reports/${report.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'RESOLVED' }) });
  assert.equal((await api('/admin/dashboard')).metrics.open_reports, 1);
  assert.equal((await fixture().api('/bootstrap')).reservations[0].overstay_stage, 'ON_TIME');
  await post('/simulation/reset');
  d = await api('/bootstrap');
  assert.equal(d.reservations[0].overstay_stage, 'ON_TIME');
  assert.equal(d.reports.length, 1);
});
test('storage errors are surfaced rather than silently losing data', async () => {
  const api = createDemoApi({ getItem: () => null, setItem: () => { throw Error('quota'); } });
  await assert.rejects(api('/bootstrap'), /Could not save/);
});
