import { api } from './api';
import { renderAdminDashboard } from './admin-dashboard';
import './admin-dashboard.css';

export function connectMobileApp(root) {
  const $ = id => root.querySelector(`#${id}`);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const card = content => `<div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">${content}</div>`;
  const button = (label, action) => `<button class="p-2 rounded-xl bg-emerald-700 text-white text-xs" onclick="${action}">${label}</button>`;
  const date = value => new Date(value.endsWith('Z') ? value : `${value}Z`);
  let data = null, admin = null, filter = 'all', busy = false, disposed = false;
  const notice = document.createElement('div');
  notice.className = 'text-xs p-3 bg-amber-50 text-slate-800 border rounded-xl';
  notice.setAttribute('role', 'status');
  root.querySelector('header').after(notice);
  const say = text => { notice.textContent = text; };
  let sessionId = '';
  const active = () => data?.reservations.find(r => r.user_id === 1 && r.status === 'CHECKED_IN' && String(r.id) === sessionId) || data?.reservations.find(r => r.user_id === 1 && r.status === 'CHECKED_IN');
  const plateKey = plate => plate.replace(/\s/g,'').toUpperCase();
  const bookingFor = plate => data.reservations.find(r => ['UPCOMING','CHECKED_IN'].includes(r.status) && plateKey(r.vehicle_plate) === plateKey(plate));
  const selected = () => data?.reservations.find(r => r.id === Number($('sim-reservation-select').value));
  const text = (id, value) => { if ($(id)) $(id).textContent = value; };
  const actions = {};
  async function refresh() {
    const result = await Promise.all([api('/bootstrap'), api('/admin/dashboard')]);
    if (disposed) return;
    [data, admin] = result;
    render();
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    try { await task(); await refresh(); }
    catch (error) { say(error.message); }
    finally { busy = false; }
  }
  function renderBays() {
    if (!data) return;
    const query = $('bay-search').value.toLowerCase();
    $('bays-grid').innerHTML = data.spaces.filter(s => (filter === 'all' || s.zone.toLowerCase() === filter) && s.code.toLowerCase().includes(query)).map(s => `<button onclick="selectBay(${s.id})" class="bg-white p-3 rounded-2xl border text-left space-y-3"><div class="flex justify-between text-xs"><strong>${escape(s.code)}</strong><span>${escape(s.status)}</span></div><i class="fa-solid fa-car text-2xl ${s.status === 'AVAILABLE' ? 'text-emerald-600' : 'text-slate-400'}"></i><div class="text-[10px]">${s.zone === 'SMART' ? `Bollard ${escape(s.bollard_status)}` : 'Walk-in parking'} · ${s.sensor_occupied ? 'Occupied' : 'Sensor clear'}</div></button>`).join('');
  }
  function renderAccess() {
    const r = selected();
    text('sim-bay-id', r?.space.code || 'No booking');
    text('sim-bollard-status', r?.space.bollard_status || '—');
    $('sim-bollard-status').previousElementSibling.textContent = r?.space.status || 'Reserve a Smart Bay first';
  }
  function tick() {
    const r = active();
    const seconds = r ? Math.floor((date(r.end_time) - Date.now()) / 1000) : 0;
    text('session-timer', r ? `${seconds < 0 ? '+' : ''}${String(Math.floor(Math.abs(seconds)/60)).padStart(2,'0')}:${String(Math.abs(seconds)%60).padStart(2,'0')}` : '—');
    $('session-timer').nextElementSibling.textContent = !r ? 'No active parking session' : seconds < 0 ? 'past your booked departure' : 'remaining until your booked departure';
  }
  function render() {
    const r = active();
    sessionPicker.innerHTML = '<label class="text-xs font-bold">Parking session<select class="w-full border rounded-xl p-2">' + data.reservations.filter(r=>r.user_id===1 && r.status==='CHECKED_IN').map(item=>`<option value="${item.id}">${escape(item.vehicle_plate)} · ${escape(item.space.code)}</option>`).join('') + '</select></label>';
    if(r) sessionPicker.querySelector('select').value=String(r.id);
    sessionPicker.querySelector('select').onchange=e=>{sessionId=e.target.value;render();};
    vehicleList.innerHTML = (data.vehicles || []).map(v=>{const booking=bookingFor(v.vehicle_plate);return `<div class="border rounded-xl p-3 text-xs"><strong>${escape(v.vehicle_plate)}</strong><p>${booking ? `${escape(booking.space.code)} · ${escape(booking.status)}` : 'Available to reserve'}${booking?.status === 'UPCOMING' ? ` ${button('Cancel booking',`cancelBooking(${booking.id})`)}` : ''}</p></div>`;}).join('');
    const stats = root.querySelectorAll('#view-overview .text-2xl.font-extrabold');
    [data.spaces.filter(s=>s.status==='AVAILABLE').length, data.spaces.filter(s=>s.zone==='SMART' && s.status==='AVAILABLE').length, `${admin.metrics.occupancy_rate}%`].forEach((v,i)=>{ if(stats[i]) stats[i].textContent=v; });
    text('stat-reports-count', admin.metrics.open_reports);
    const capacity = root.querySelectorAll('#view-overview .font-mono strong');
    ['GENERAL','SMART'].forEach((zone,i)=>{
      const spaces=data.spaces.filter(s=>s.zone===zone), free=spaces.filter(s=>s.status==='AVAILABLE').length;
      if(capacity[i]) { capacity[i].parentElement.innerHTML=`<strong class="text-slate-800">${free}</strong> / ${spaces.length} free`; }
      const bars=root.querySelectorAll('#view-overview .h-2.overflow-hidden > div');
      if(bars[i]) bars[i].style.width=`${100*free/spaces.length}%`;
    });
    root.querySelector('#view-overview .uppercase').textContent = new Date().toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
    text('modal-plate-display', data.user.vehicle_plate);
    text('overview-session-text', r ? `Active session at ${r.space.code} (${r.vehicle_plate})` : 'No active parking session');
    text('session-plate-display', r?.vehicle_plate || '—');
    text('session-end-time', r ? date(r.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—');
    text('session-penalty', `RM ${Number(r?.penalty_amount || 0).toFixed(2)}`);
    root.querySelector('#view-parking-session .text-lg.font-bold.text-white').textContent=r?.space.code || '—';
    root.querySelectorAll('.rounded-full.uppercase').forEach(el=>{ if(el.textContent==='ON TIME' || el.dataset.stage) {el.dataset.stage='true'; el.textContent=r?.overstay_stage.replaceAll('_',' ') || 'NO SESSION';} });
    const select=$('sim-reservation-select'), old=select.value;
    select.innerHTML=data.reservations.filter(r=>r.user_id===1 && ['UPCOMING','CHECKED_IN'].includes(r.status)).map(r=>`<option value="${r.id}">${escape(r.space.code)} · ${escape(r.vehicle_plate)} · ${r.status}</option>`).join('') || '<option value="">No active bookings</option>';
    if([...select.options].some(o=>o.value===old)) select.value=old;
    renderAccess(); renderBays(); tick();
    text('reports-badge', data.reports.length);
    $('reports-list').innerHTML=data.reports.map(r=>card(`<strong>${escape(r.category)} · ${escape(r.status)}</strong><p class="text-xs">${escape(r.description)}</p><small>${escape(r.location)} · ${date(r.created_at).toLocaleString()}</small>${r.image_path ? '<p class="text-xs">Photo URL saved with report</p>' : ''}`)).join('');
    $('view-admin-dashboard').innerHTML = renderAdminDashboard(data, admin, escape);
  }
  actions.switchTab = tab => {
    const isAdmin = tab === 'admin-dashboard';
    root.querySelector('.phone-container').classList.toggle('admin-mode', isAdmin);
    if (isAdmin && location.hash !== '#admin') history.replaceState(null, '', '#admin');
    if (!isAdmin && location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search);
    root.querySelectorAll('.view-section').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${tab}`));
    root.querySelectorAll('.nav-btn').forEach(el=>{el.classList.toggle('text-emerald-400',el.id===`nav-${tab}`);el.classList.toggle('text-slate-400',el.id!==`nav-${tab}`);});
    $('mainContainer').scrollTop=0;
  };
  actions.toggleUserModal = ()=>$('userModal').classList.toggle('hidden');
  actions.filterBays = value=>{filter=value;renderBays();['all','general','smart'].forEach(v=>$(`btn-filter-${v}`).classList.toggle('bg-white',v===value));};
  actions.searchBays=renderBays;
  actions.selectBay=id=>{
    const s=data?.spaces.find(s=>s.id===id);
    if(!s) return;
    if(s.zone!=='SMART') return say('General bays are walk-in only. Choose a Smart Bay to reserve.');
    if(s.status!=='AVAILABLE') return say(`${s.code} is ${s.status.toLowerCase()}.`);
    const vehicles=(data.vehicles || []).filter(v=>!bookingFor(v.vehicle_plate));
    if(!vehicles.length) {actions.switchTab('vehicle-access');return say('All saved plates have a slot. Add another plate, cancel a booking, or exit first.');}
    const dialog=document.createElement('dialog');
    dialog.className='rounded-2xl p-5 w-80';
    dialog.innerHTML=`<form class="space-y-4"><h2 class="font-bold">Reserve ${escape(s.code)}</h2><label>Vehicle plate<select name="plate" class="w-full border p-2">${vehicles.map(v=>`<option value="${escape(v.vehicle_plate)}">${escape(v.vehicle_plate)}</option>`).join('')}</select></label><p class="text-xs">One active slot per plate. Starts now.</p><label>Visit duration<select name="duration" class="w-full border p-2"><option value="30">30 minutes</option><option value="60" selected>60 minutes</option><option value="120">120 minutes</option></select></label><div class="flex justify-between"><button type="button">Cancel</button><button class="bg-emerald-700 text-white p-3 rounded-xl">Reserve bay</button></div></form>`;
    root.append(dialog); dialog.showModal();
    dialog.querySelector('[type=button]').onclick=()=>dialog.close();
    dialog.onclose=()=>dialog.remove();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const form=new FormData(e.target), minutes=Number(form.get('duration')), plate=form.get('plate');dialog.close();run(async()=>{await api('/reservations',{method:'POST',body:JSON.stringify({user_id:1,vehicle_plate:plate,space_id:id,start_time:new Date().toISOString(),end_time:new Date(Date.now()+minutes*60000).toISOString()})});say(`${s.code} reserved for ${plate}. Choose it in Vehicle & access.`);});};
  };
  actions.saveVehiclePlate=()=>run(async()=>{await api('/users/1/vehicles',{method:'POST',body:JSON.stringify({vehicle_plate:$('input-plate').value})});$('input-plate').value='';say('Vehicle added. You can now select it when reserving a bay.');});
  actions.cancelBooking=id=>run(async()=>{await api(`/reservations/${id}/cancel`,{method:'POST'});say('Booking cancelled. This plate can reserve another slot.');});
  const signal=(path,extra)=>run(async()=>{const r=selected();if(!r) throw Error('Reserve a Smart Bay first.');const result=await api(`/simulation/${path}`,{method:'POST',body:JSON.stringify({space_id:r.space_id,vehicle_plate:r.vehicle_plate,...extra})});const message=result.message || `Updated: ${result.status || result.bollard_status}`;text('sim-log-output',message);say(message);});
  actions.runANPRVerify=()=>signal('anpr',{});
  actions.confirmOccupancy=()=>signal('occupancy',{occupied:true});
  actions.simulateExit=()=>signal('occupancy',{occupied:false});
  const overstay=minutes=>run(async()=>{const r=active();if(!r) throw Error('No active parking session.');const result=await api(`/simulation/overstay/${r.id}`,{method:'POST',body:JSON.stringify({minutes_over:minutes})});say(result.message);});
  actions.addSessionTime=()=>overstay(5);
  actions.triggerOverstayPenalty=()=>overstay(15);
  actions.triggerEscalation=()=>overstay(35);
  actions.submitIncident=e=>{e.preventDefault();const form=e.target;run(async()=>{await api('/reports',{method:'POST',body:JSON.stringify({user_id:1,category:$('report-category').value,location:$('report-location').value,description:$('report-desc').value,image_path:$('report-photo').value || null})});form.reset();say('Incident saved to Safety Hub.');});};
  actions.updateReport=(id,status)=>run(()=>api(`/reports/${id}`,{method:'PATCH',body:JSON.stringify({status})}));
  actions.resetDemo=()=>{if(window.confirm('Restore demo data? This removes current demo bookings and reports.'))run(async()=>{await api('/simulation/reset',{method:'POST'});say('Demo restored.');});};
  Object.assign(window,actions);
  const onHashChange = () => actions.switchTab(location.hash === '#admin' ? 'admin-dashboard' : 'overview');
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
  const vehicleList=document.createElement('div'); vehicleList.className='space-y-2';
  $('input-plate').closest('.bg-white').append(vehicleList);
  $('input-plate').value=''; $('input-plate').placeholder='e.g. ABC 1234'; $('input-plate').maxLength=20;
  root.querySelector('[onclick="saveVehiclePlate()"]').textContent='Add vehicle plate';
  root.querySelector('#view-vehicle-access h3').textContent='My vehicles';
  const sessionPicker=document.createElement('div');
  $('view-parking-session').firstElementChild.after(sessionPicker);
  $('sim-reservation-select').onchange=renderAccess;
  const exit=document.createElement('button'); exit.textContent='Simulate vehicle exit';exit.className='w-full p-3 rounded-xl bg-slate-200 text-sm';exit.onclick=actions.simulateExit;
  $('sim-reservation-select').closest('.bg-white').append(exit);
  root.querySelectorAll('label').forEach(label=>{const input=label.parentElement.querySelector('input,select,textarea');if(input?.id)label.htmlFor=input.id;});
  root.querySelector('.fa-grid-2')?.classList.replace('fa-grid-2','fa-table-cells-large');
  say('Connecting to parking service…');
  refresh().then(()=>{if(!disposed)say('Connected · hardware signals and penalties are simulated.');}).catch(e=>say(`Connection failed: ${e.message}. Start the backend and refresh.`));
  const timer=setInterval(tick,1000);
  const poll=setInterval(()=>{if(!busy)refresh().catch(e=>say(`Connection interrupted: ${e.message}`));},10000);
  return ()=>{disposed=true;window.removeEventListener('hashchange',onHashChange);clearInterval(timer);clearInterval(poll);notice.remove();exit.remove();vehicleList.remove();sessionPicker.remove();Object.keys(actions).forEach(key=>delete window[key]);};
}
