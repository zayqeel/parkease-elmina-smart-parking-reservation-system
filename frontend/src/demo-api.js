// Browser-only adapter: no requests or real-world hardware/payment actions.
const KEY = 'parkease-elmina-demo-v1';
const active = r => ['UPCOMING', 'CHECKED_IN'].includes(r.status);
const plateKey = p => String(p ?? '').replace(/\s/g, '').toUpperCase();
const iso = offset => new Date(Date.now() + offset * 60000).toISOString();
const nextId = items => Math.max(0, ...items.map(x => x.id)) + 1;
const check = (condition, message) => { if (!condition) throw Error(message); };
function reservation(id, user_id, space_id, vehicle_plate, start, end, status = 'UPCOMING') {
  return { id, user_id, space_id, vehicle_plate, start_time: iso(start), end_time: iso(end), status,
    checked_in_at: status === 'CHECKED_IN' ? iso(start) : null, checked_out_at: null,
    penalty_amount: 0, overstay_stage: 'ON_TIME', overstay_minutes: 0,
    escalation_status: 'NONE', warnings_sent: 0, rerouted_from_space_id: null };
}
export function seedDemo() {
  const spaces = Array.from({ length: 20 }, (_, i) => {
    const smart = i >= 12, n = smart ? i - 11 : i + 1;
    const occupied = smart ? [2, 6].includes(n) : [1, 4, 7, 11].includes(n);
    return { id: i + 1, code: `${smart ? 'S' : 'G'}-${String(n).padStart(2, '0')}`,
      zone: smart ? 'SMART' : 'GENERAL', level: smart ? 'Level 1' : 'Ground',
      status: occupied ? 'OCCUPIED' : smart && n === 8 ? 'MAINTENANCE' : smart && n === 3 ? 'RESERVED' : 'AVAILABLE',
      sensor_occupied: occupied, bollard_status: smart ? occupied ? 'LOWERED' : 'RAISED' : 'NONE',
      current_vehicle_plate: occupied ? smart && n === 2 ? 'VCD 2187' : `DEMO ${n}` : null };
  });
  return { version: 1, user: { id: 1, name: 'Aina Rahman', email: 'aina@elminapark.demo', vehicle_plate: 'VCD 2187' },
    vehicles: ['VCD 2187', 'WXY 4401', 'BQV 9032'].map((p, i) => ({ id: i + 1, user_id: i + 1, vehicle_plate: p })), spaces,
    reservations: [reservation(1, 1, 14, 'VCD 2187', -25, 20, 'CHECKED_IN'), reservation(2, 2, 14, 'WXY 4401', 30, 90), reservation(3, 3, 15, 'BQV 9032', 60, 120)],
    reports: [{ id: 1, user_id: 2, category: 'Lighting', location: 'General Zone, G-09', description: 'Lamp is flickering near the pedestrian walkway.', status: 'IN_REVIEW', created_at: iso(-120), image_path: null }],
    events: [{ id: 1, space_id: 14, vehicle_plate: 'VCD 2187', event_type: 'OCCUPANCY_CONFIRMED', detail: 'Simulated vehicle parked in S-02', timestamp: iso(-24) }] };
}
export function createDemoApi(storage) {
  function load() {
    let raw;
    try { raw = storage.getItem(KEY); } catch { throw Error('Browser storage is unavailable. Allow site storage to use this demo.'); }
    if (!raw) return seedDemo();
    try {
      const data = JSON.parse(raw);
      check(data.version === 1 && ['spaces','vehicles','reservations','reports','events'].every(k => Array.isArray(data[k])), 'Invalid data');
      return data;
    } catch { throw Error('Saved demo data is incompatible. Open Admin and use Reset demo.'); }
  }
  function save(data) {
    try { storage.setItem(KEY, JSON.stringify(data)); } catch { throw Error('Could not save demo data. Free some browser storage and retry.'); }
  }
  function execute(path, options) {
    const method = options.method || 'GET', p = JSON.parse(options.body || '{}');
    if (path === '/simulation/reset' && method === 'POST') { save(seedDemo()); return { message: 'Your browser demo has been reset.' }; }
    const d = load();
    const space = id => d.spaces.find(s => s.id === Number(id));
    const hydrate = r => ({ ...r, space: space(r.space_id) });
    const event = (s, type, detail, plate = null) => {
      d.events.unshift({ id: nextId(d.events), space_id: s.id, event_type: type, detail, vehicle_plate: plate, timestamp: iso(0) });
      d.events = d.events.slice(0, 100);
    };
    const release = s => {
      if (!s.sensor_occupied && s.status !== 'MAINTENANCE') {
        s.status = d.reservations.some(r => r.space_id === s.id && r.status === 'UPCOMING') ? 'RESERVED' : 'AVAILABLE';
        s.bollard_status = s.zone === 'SMART' ? 'RAISED' : 'NONE'; s.current_vehicle_plate = null;
      }
    };
    let result;
    if (method === 'GET' && path === '/bootstrap') result = { ...d, vehicles: d.vehicles.filter(v => v.user_id === 1), reservations: d.reservations.map(hydrate) };
    else if (method === 'GET' && path === '/admin/dashboard') {
      const occupied = d.spaces.filter(s => s.sensor_occupied).length;
      result = { metrics: { total_spaces: d.spaces.length, occupied, occupancy_rate: Math.round(occupied / d.spaces.length * 100), active_reservations: d.reservations.filter(active).length, open_reports: d.reports.filter(r => r.status !== 'RESOLVED').length, penalties_collected: d.reservations.reduce((n,r) => n + r.penalty_amount, 0) },
        events: d.events.slice(0,12).map(hydrate), reports: d.reports, enforcement: d.reservations.filter(r => r.overstay_stage !== 'ON_TIME').map(hydrate) };
    } else if (method === 'POST' && path === '/users/1/vehicles') {
      const plate = String(p.vehicle_plate || '').trim().toUpperCase().replace(/\s+/g, ' ');
      check(/^[A-Z0-9 ]{2,20}$/.test(plate) && plateKey(plate).length >= 2, 'Use 2–20 letters, digits or spaces for the plate.');
      check(!d.vehicles.some(v => plateKey(v.vehicle_plate) === plateKey(plate)), 'This plate is already registered.');
      result = { id: nextId(d.vehicles), user_id: 1, vehicle_plate: plate }; d.vehicles.push(result);
    } else if (method === 'POST' && path === '/reservations') {
      const s = space(p.space_id), v = d.vehicles.find(v => v.user_id === 1 && plateKey(v.vehicle_plate) === plateKey(p.vehicle_plate));
      check(v, 'Register this vehicle first.');
      check(s?.zone === 'SMART' && s.status === 'AVAILABLE', 'Select an available Smart Bay.');
      check(!d.reservations.some(r => active(r) && plateKey(r.vehicle_plate) === plateKey(v.vehicle_plate)), 'This plate already has an active booking.');
      check(Number.isFinite(Date.parse(p.start_time)) && Date.parse(p.end_time) > Date.parse(p.start_time) && Date.parse(p.end_time) > Date.now(), 'Invalid booking times.');
      const r = { ...reservation(nextId(d.reservations), 1, s.id, v.vehicle_plate, 0, 60), start_time: p.start_time, end_time: p.end_time };
      d.reservations.push(r); s.status = 'RESERVED'; event(s, 'RESERVATION_CREATED', 'Exact bay reserved', v.vehicle_plate); result = hydrate(r);
    } else if (method === 'POST' && /^\/reservations\/\d+\/cancel$/.test(path)) {
      const r = d.reservations.find(r => r.id === Number(path.split('/')[2]));
      check(r?.user_id === 1 && r.status === 'UPCOMING', 'Only upcoming bookings can be cancelled.');
      r.status = 'CANCELLED'; release(space(r.space_id)); result = hydrate(r);
    } else if (method === 'POST' && ['/simulation/anpr', '/simulation/occupancy'].includes(path)) {
      const s = space(p.space_id);
      check(s?.zone === 'SMART' && s.status !== 'MAINTENANCE', 'Smart Bay unavailable.');
      const r = d.reservations.find(r => r.space_id === s.id && active(r) && plateKey(r.vehicle_plate) === plateKey(p.vehicle_plate));
      if (path.endsWith('/anpr')) {
        check(!s.sensor_occupied, 'Bay is already occupied.');
        const verified = Boolean(r && Date.now() >= Date.parse(r.start_time) - 600000 && Date.now() < Date.parse(r.end_time));
        if (verified) { s.bollard_status = 'LOWERED'; s.current_vehicle_plate = r.vehicle_plate; }
        event(s, verified ? 'ANPR_VERIFIED' : 'ANPR_DENIED', verified ? 'Plate matched; bollard lowered' : 'No valid matching reservation', p.vehicle_plate);
        result = { verified, message: verified ? `Welcome. ${s.code} is unlocked.` : 'Plate not authorised for this bay.', bollard_status: s.bollard_status };
      } else if (p.occupied) {
        check(r && !s.sensor_occupied && s.bollard_status === 'LOWERED' && plateKey(s.current_vehicle_plate) === plateKey(p.vehicle_plate), 'Verify this vehicle with ANPR before parking.');
        r.status = 'CHECKED_IN'; r.checked_in_at = iso(0); s.sensor_occupied = true; s.status = 'OCCUPIED'; event(s, 'OCCUPANCY_CONFIRMED', 'Parking session started', r.vehicle_plate); result = { status: s.status };
      } else {
        check(r?.status === 'CHECKED_IN' && s.sensor_occupied, 'This vehicle has no active parking session.');
        r.status = 'COMPLETED'; r.checked_out_at = iso(0); s.sensor_occupied = false; release(s); event(s, 'VEHICLE_EXITED', 'Bay released; bollard raised', r.vehicle_plate); result = { status: s.status };
      }
    } else if (method === 'POST' && /^\/simulation\/overstay\/\d+$/.test(path)) {
      const r = d.reservations.find(r => r.id === Number(path.split('/')[3])), n = p.minutes_over;
      check(r?.status === 'CHECKED_IN', 'Only active sessions can overstay.');
      check(Number.isInteger(n) && n >= r.overstay_minutes && n <= 240, 'Demo time cannot move backwards; reset the demo to restart.');
      r.end_time = iso(-n); r.overstay_minutes = n; r.overstay_stage = n === 0 ? 'ON_TIME' : n <= 10 ? 'GRACE' : n <= 30 ? 'PENALTY' : 'ESCALATED';
      r.penalty_amount = n <= 10 ? 0 : 10 + (n - 10) * 2;
      r.escalation_status = n === 0 ? 'NONE' : n <= 10 ? 'MONITORING' : n <= 30 ? 'PENALTY_ACTIVE' : 'SECURITY_NOTIFIED';
      r.warnings_sent = Math.max(r.warnings_sent, n > 10 ? 2 : n > 0 ? 1 : 0);
      let message = n <= 10 ? `Grace-period warning: ${10-n} minutes remain.` : 'Simulated penalty applied.';
      if (n > 30) message += ' Security escalation simulated.';
      if (n > 10) {
        const next = d.reservations.filter(q => q.space_id === r.space_id && q.status === 'UPCOMING').sort((a,b) => Date.parse(a.start_time) - Date.parse(b.start_time))[0];
        const alternative = d.spaces.find(s => s.zone === 'SMART' && s.status === 'AVAILABLE' && !s.sensor_occupied);
        if (next && alternative) {
          next.rerouted_from_space_id = next.space_id; next.space_id = alternative.id; alternative.status = 'RESERVED';
          event(alternative, 'BOOKING_REROUTED', `Moved from ${space(r.space_id).code} due to overstay`, next.vehicle_plate);
          message += ` Next booking moved to ${alternative.code}.`;
        } else if (next) message += ' No alternative bay available; management assistance needed.';
      }
      event(space(r.space_id), `OVERSTAY_${r.overstay_stage}`, message, r.vehicle_plate); result = { ...hydrate(r), message };
    } else if (method === 'POST' && path === '/reports') {
      check(typeof p.category === 'string' && p.category.trim().length >= 2 && p.category.length <= 60 && typeof p.location === 'string' && p.location.trim().length >= 2 && p.location.length <= 120 && typeof p.description === 'string' && p.description.trim().length >= 5 && p.description.length <= 1200 && (!p.image_path || (typeof p.image_path === 'string' && p.image_path.length <= 500)), 'Please provide a category, location and description (5–1200 characters).');
      result = { id: nextId(d.reports), user_id: 1, category: p.category, location: p.location, description: p.description, image_path: p.image_path || null, status: 'OPEN', created_at: iso(0) }; d.reports.unshift(result);
    } else if (method === 'PATCH' && /^\/reports\/\d+$/.test(path)) {
      const r = d.reports.find(r => r.id === Number(path.split('/')[2]));
      check(r && ['OPEN','IN_REVIEW','RESOLVED'].includes(p.status), 'Invalid report status.'); r.status = p.status; result = r;
    } else throw Error(`Unsupported demo action: ${method} ${path}`);
    save(d); return structuredClone(result);
  }
  return async (path, options = {}) => {
    // Serialise changes across same-origin tabs when Web Locks are available.
    if (typeof window !== 'undefined' && globalThis.navigator?.locks) return navigator.locks.request(KEY, () => execute(path, options));
    return execute(path, options);
  };
}
let browserApi;
export function demoApi(path, options) {
  browserApi ||= createDemoApi(window.localStorage);
  return browserApi(path, options);
}
