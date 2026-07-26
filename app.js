// 👉 depois de colocar o backend no ar (veja o README), troque a URL abaixo
// pela URL real, ex: 'https://clarinha-api.onrender.com'
const API_BASE_URL = 'http://localhost:5000';

let data = { routines: [], history: [], bodyweight: [], measurements: [], exercisePhotos: {}, settings: { weeklyGoal: 4 } };
let activeWorkout = null; // {routineId, routineName, exercises:[{name, note, supersetGroup, sets:[{weight,reps,done,type}]}], startedAt, note}
let currentTab = 'home';
let progressExercise = null;
let measurementField = 'arm';
let calendarCursor = new Date(); calendarCursor.setDate(1);
let modal = null; // {type, ...}

let restTimer = null; // {total, remaining, tickId}
let restDefaultSeconds = 90;
let durationTickId = null;
let sessionPRs = new Set();

const SET_TYPES = ['normal','warmup','drop','failure'];
const SUPERSET_LETTERS = ['A','B','C','D','E','F'];
const SUPERSET_COLORS = { A:'#F0A8BF', B:'#B79CE0', C:'#F0B87A', D:'#8FCBA0', E:'#89C2E8', F:'#E88B96' };
const MEASUREMENT_FIELDS = { arm:'Braço', chest:'Peito', waist:'Cintura', hip:'Quadril', thigh:'Coxa', calf:'Panturrilha' };

// ---------- SPOTIFY ----------
const SPOTIFY_REDIRECT_URI = 'https://feefesn.github.io/Clarinha./';
const SPOTIFY_SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;
let spotifyPollId = null;

const EXERCISE_LIBRARY = {
  'Peito': ['Supino reto com barra','Supino reto com halteres','Supino inclinado com halteres','Crucifixo com halteres','Crossover no cabo','Peck deck','Flexão de braço'],
  'Costas': ['Puxada frontal','Remada baixa (cabo)','Remada curvada com barra','Remada unilateral com halter','Barra fixa (pull-up)','Pulldown','Levantamento terra'],
  'Pernas': ['Agachamento livre','Agachamento no smith','Leg press','Cadeira extensora','Cadeira flexora','Afundo com halteres','Stiff com barra','Panturrilha em pé'],
  'Ombros': ['Desenvolvimento com halteres','Desenvolvimento militar com barra','Elevação lateral','Elevação frontal','Remada alta','Crucifixo inverso'],
  'Bíceps': ['Rosca direta com barra','Rosca alternada com halteres','Rosca martelo','Rosca scott','Rosca concentrada'],
  'Tríceps': ['Tríceps corda no cabo','Tríceps testa com barra','Tríceps francês','Mergulho no banco','Tríceps coice com halter'],
  'Abdômen': ['Abdominal reto','Abdominal infra','Prancha','Elevação de pernas','Abdominal oblíquo','Abdominal na polia'],
  'Glúteos': ['Elevação pélvica (hip thrust)','Cadeira abdutora','Agachamento sumô','Coice no cabo','Passada (afundo)'],
  'Cardio': ['Esteira','Bicicleta ergométrica','Corda','Elíptico','HIIT']
};

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/>',
  routines: '<rect x="4" y="5" width="16" height="3.2" rx="1"/><rect x="4" y="10.4" width="16" height="3.2" rx="1"/><rect x="4" y="15.8" width="16" height="3.2" rx="1"/>',
  history: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.6"/><path d="M9 2.5h6"/>',
  progress: '<path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M4 19h16"/>'
};

function svgIcon(name){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function showToast(msg, duration){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.classList.remove('show'), duration || 1800);
}

async function api(path, options){
  const res = await fetch(API_BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if(!res.ok){
    const body = await res.json().catch(()=>({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadData(){
  try{
    const [routines, history, bodyweight, measurements, exercisePhotos, settings] = await Promise.all([
      api('/api/routines'),
      api('/api/history'),
      api('/api/bodyweight'),
      api('/api/measurements'),
      api('/api/exercise-photos'),
      api('/api/settings')
    ]);
    data.routines = routines || [];
    data.history = history || [];
    data.bodyweight = bodyweight || [];
    data.measurements = measurements || [];
    data.exercisePhotos = exercisePhotos || {};
    data.settings = settings || { weeklyGoal: 4 };
  }catch(e){
    showToast('Sem conexão com o backend — confira a API_BASE_URL');
  }
  try{
    const active = await api('/api/active');
    if(active) activeWorkout = active;
  }catch(e){ /* ignore, keep no active workout */ }
}

async function saveActive(){
  try{
    await api('/api/active', { method:'PUT', body: JSON.stringify(activeWorkout || null) });
  }catch(e){ /* non critical, keep working locally */ }
}

// ---------- date helpers ----------
function fmtDate(iso){
  const d = new Date(iso);
  const dias = ['dom','seg','ter','qua','qui','sex','sáb'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]}`;
}
function isSameDay(a,b){
  const da = new Date(a), db = new Date(b);
  return da.getFullYear()===db.getFullYear() && da.getMonth()===db.getMonth() && da.getDate()===db.getDate();
}
function startOfWeek(){
  const d = new Date();
  const day = d.getDay();
  const diff = (day===0? -6 : 1) - day;
  d.setDate(d.getDate()+diff);
  d.setHours(0,0,0,0);
  return d;
}
function weeklyCount(){
  const sow = startOfWeek();
  return data.history.filter(h => new Date(h.date) >= sow).length;
}
function workoutVolume(exercises){
  let v = 0;
  exercises.forEach(ex => (ex.sets||[]).forEach(s=>{
    const w = parseFloat(s.weight)||0, r = parseFloat(s.reps)||0;
    v += w*r;
  }));
  return Math.round(v);
}
function weeklyVolume(){
  const sow = startOfWeek();
  return Math.round(data.history.filter(h => new Date(h.date) >= sow)
    .reduce((sum,h)=> sum + (h.volume!=null ? h.volume : workoutVolume(h.exercises)), 0));
}
function fmtDuration(totalSec){
  totalSec = Math.max(0, Math.round(totalSec||0));
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function fmtDurationShort(totalSec){
  if(!totalSec) return null;
  const m = Math.round(totalSec/60);
  if(m<60) return `${m}min`;
  const h = Math.floor(m/60), mm = m%60;
  return `${h}h${mm? ' '+mm+'min':''}`;
}
function lastTimeSets(name){
  const sorted = [...data.history].sort((a,b)=> new Date(b.date)-new Date(a.date));
  for(const h of sorted){
    const ex = h.exercises.find(e => e.name.toLowerCase()===name.toLowerCase());
    if(ex && ex.sets && ex.sets.length) return ex.sets;
  }
  return null;
}
function lastTimeText(name){
  const sets = lastTimeSets(name);
  if(!sets) return null;
  return sets.map(s => `${s.weight||0}kg×${s.reps||0}`).join(', ');
}
function copyLastTime(exIdx){
  const ex = activeWorkout.exercises[exIdx];
  const last = lastTimeSets(ex.name);
  if(!last) return;
  ex.sets.forEach((s,i)=>{
    if(last[i]){
      s.weight = last[i].weight;
      s.reps = last[i].reps;
    }
  });
  saveActive();
  render();
  showToast('Preenchido com os valores da última vez 📋');
}
window.copyLastTime = copyLastTime;

function computeStreak(){
  if(data.history.length===0) return 0;
  const days = [...new Set(data.history.map(h => new Date(h.date).toDateString()))]
    .map(s => new Date(s)).sort((a,b)=>b-a);
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0,0,0,0);
  for(let i=0;i<days.length;i++){
    const diff = Math.round((cursor - days[i]) / 86400000);
    if(diff===0 || diff===1){
      streak++;
      cursor = new Date(days[i]);
    } else if(diff>1){
      break;
    }
  }
  return streak;
}

// ---------- SISTEMA DE INCENTIVO ----------
function xpForWorkout(h){
  const sets = h.exercises.reduce((a,e)=>a+e.sets.length,0);
  const vol = h.volume!=null ? h.volume : workoutVolume(h.exercises);
  return 20 + sets*4 + Math.round(vol/25);
}
function totalXP(){
  return data.history.reduce((sum,h)=> sum + xpForWorkout(h), 0);
}
function levelInfo(xp){
  let level = 1;
  let remaining = xp;
  let need = 150;
  while(remaining >= need){
    remaining -= need;
    level++;
    need += 60;
  }
  return { level, xpInLevel: remaining, xpNeeded: need };
}

function weeklyGoal(){
  return data.settings.weeklyGoal || 4;
}

async function updateWeeklyGoal(delta){
  const current = weeklyGoal();
  const next = Math.max(1, Math.min(14, current+delta));
  if(next===current) return;
  data.settings.weeklyGoal = next;
  render();
  try{
    await api('/api/settings', { method:'PUT', body: JSON.stringify({ weeklyGoal: next }) });
  }catch(e){
    showToast('Não consegui salvar a meta no servidor 😕');
  }
}
window.updateWeeklyGoal = updateWeeklyGoal;

const ACHIEVEMENTS = [
  { id:'first_workout', emoji:'🎉', title:'Primeiro treino', desc:'Complete seu primeiro treino', check: () => data.history.length>=1 },
  { id:'10_workouts', emoji:'🥉', title:'10 treinos', desc:'Complete 10 treinos no total', check: () => data.history.length>=10 },
  { id:'50_workouts', emoji:'🥈', title:'50 treinos', desc:'Complete 50 treinos no total', check: () => data.history.length>=50 },
  { id:'100_workouts', emoji:'🥇', title:'100 treinos', desc:'Complete 100 treinos no total', check: () => data.history.length>=100 },
  { id:'streak_7', emoji:'🔥', title:'Semana de fogo', desc:'7 dias seguidos treinando', check: () => computeStreak()>=7 },
  { id:'streak_30', emoji:'🌋', title:'Mês imparável', desc:'30 dias seguidos treinando', check: () => computeStreak()>=30 },
  { id:'pr_100', emoji:'💯', title:'Clube dos 100kg', desc:'Levante 100kg ou mais numa série', check: () => data.history.some(h=>h.exercises.some(e=>e.sets.some(s=>(parseFloat(s.weight)||0)>=100))) },
  { id:'volume_10k', emoji:'🏋️', title:'10 toneladas', desc:'Mais de 10.000kg de volume num treino só', check: () => data.history.some(h=> (h.volume!=null? h.volume : workoutVolume(h.exercises)) >= 10000) },
  { id:'consistent_month', emoji:'📅', title:'Mês consistente', desc:'12 treinos ou mais nos últimos 30 dias', check: () => { const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-30); return data.history.filter(h=>new Date(h.date)>=cutoff).length>=12; } },
  { id:'level_5', emoji:'⭐', title:'Nível 5', desc:'Alcance o nível 5', check: () => levelInfo(totalXP()).level>=5 },
  { id:'level_10', emoji:'🌟', title:'Nível 10', desc:'Alcance o nível 10', check: () => levelInfo(totalXP()).level>=10 },
  { id:'bodyweight_log', emoji:'⚖️', title:'Controle em dia', desc:'Registre seu peso corporal 5 vezes', check: () => data.bodyweight.length>=5 },
  { id:'measurements_log', emoji:'📏', title:'Bem medido', desc:'Registre suas medidas 3 vezes', check: () => data.measurements.length>=3 }
];

function unlockedAchievements(){
  return ACHIEVEMENTS.filter(a => a.check());
}

// ---------- SPOTIFY: PKCE AUTH ----------
function spotifyGenerateRandomString(length){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for(let i=0;i<length;i++) text += chars.charAt(Math.floor(Math.random()*chars.length));
  return text;
}
async function spotifySha256(plain){
  const data = new TextEncoder().encode(plain);
  return await window.crypto.subtle.digest('SHA-256', data);
}
function spotifyBase64UrlEncode(buffer){
  let str = '';
  const bytes = new Uint8Array(buffer);
  for(let i=0;i<bytes.byteLength;i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function connectSpotify(){
  const clientIdEl = document.getElementById('spotifyClientIdInput');
  const clientId = clientIdEl ? clientIdEl.value.trim() : '';
  if(!clientId){ showToast('Cola o Client ID do seu app Spotify primeiro'); return; }
  localStorage.setItem('spotify_client_id', clientId);
  const verifier = spotifyGenerateRandomString(64);
  localStorage.setItem('spotify_verifier', verifier);
  const hashed = await spotifySha256(verifier);
  const challenge = spotifyBase64UrlEncode(hashed);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    redirect_uri: SPOTIFY_REDIRECT_URI
  });
  window.location = 'https://accounts.spotify.com/authorize?' + params.toString();
}
window.connectSpotify = connectSpotify;

async function handleSpotifyRedirect(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if(!code) return;
  const verifier = localStorage.getItem('spotify_verifier');
  const clientId = localStorage.getItem('spotify_client_id');
  if(!verifier || !clientId) return;
  try{
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier
    });
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const tokenData = await res.json();
    if(tokenData.access_token){
      spotifyAccessToken = tokenData.access_token;
      spotifyTokenExpiry = Date.now() + tokenData.expires_in*1000;
      if(tokenData.refresh_token){
        data.settings.spotifyRefreshToken = tokenData.refresh_token;
        data.settings.spotifyClientId = clientId;
        await api('/api/settings', { method:'PUT', body: JSON.stringify({ spotifyRefreshToken: tokenData.refresh_token, spotifyClientId: clientId }) });
      }
      showToast('Spotify conectado! 🎧');
    }
  }catch(e){
    showToast('Não consegui conectar ao Spotify 😕');
  }
  window.history.replaceState({}, '', SPOTIFY_REDIRECT_URI);
}

function spotifyConnected(){
  return !!(data.settings && data.settings.spotifyRefreshToken);
}

async function disconnectSpotify(){
  data.settings.spotifyRefreshToken = undefined;
  spotifyAccessToken = null;
  try{
    await api('/api/settings', { method:'PUT', body: JSON.stringify({ spotifyRefreshToken: null }) });
  }catch(e){}
  modal = null;
  render();
  showToast('Spotify desconectado');
}
window.disconnectSpotify = disconnectSpotify;

async function refreshSpotifyToken(){
  const refreshToken = data.settings.spotifyRefreshToken;
  const clientId = data.settings.spotifyClientId || localStorage.getItem('spotify_client_id');
  if(!refreshToken || !clientId) return false;
  try{
    const body = new URLSearchParams({ grant_type:'refresh_token', refresh_token: refreshToken, client_id: clientId });
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method:'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body
    });
    const tokenData = await res.json();
    if(tokenData.access_token){
      spotifyAccessToken = tokenData.access_token;
      spotifyTokenExpiry = Date.now() + tokenData.expires_in*1000;
      if(tokenData.refresh_token){
        data.settings.spotifyRefreshToken = tokenData.refresh_token;
        api('/api/settings', { method:'PUT', body: JSON.stringify({ spotifyRefreshToken: tokenData.refresh_token }) }).catch(()=>{});
      }
      return true;
    }
  }catch(e){}
  return false;
}

async function ensureSpotifyToken(){
  if(spotifyAccessToken && Date.now() < spotifyTokenExpiry-5000) return true;
  return await refreshSpotifyToken();
}

async function spotifyFetch(path, options){
  const ok = await ensureSpotifyToken();
  if(!ok) return null;
  try{
    const res = await fetch('https://api.spotify.com/v1'+path, {
      ...(options||{}),
      headers: { 'Authorization': 'Bearer '+spotifyAccessToken, 'Content-Type':'application/json', ...((options&&options.headers)||{}) }
    });
    if(res.status===204) return {};
    if(!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }catch(e){
    return null;
  }
}

async function spotifyPlayPause(){
  const state = await spotifyFetch('/me/player');
  if(state && state.is_playing){
    await spotifyFetch('/me/player/pause', { method:'PUT' });
  } else {
    await spotifyFetch('/me/player/play', { method:'PUT' });
  }
  setTimeout(pollSpotify, 400);
}
window.spotifyPlayPause = spotifyPlayPause;

async function spotifyNext(){
  await spotifyFetch('/me/player/next', { method:'POST' });
  setTimeout(pollSpotify, 500);
}
window.spotifyNext = spotifyNext;

async function spotifyPrev(){
  await spotifyFetch('/me/player/previous', { method:'POST' });
  setTimeout(pollSpotify, 500);
}
window.spotifyPrev = spotifyPrev;

async function spotifyQueueTrack(uri, name){
  const result = await spotifyFetch('/me/player/queue?uri='+encodeURIComponent(uri), { method:'POST' });
  if(result!==null){
    showToast(`Adicionado à fila: ${name} 🎵`);
  } else {
    showToast('Não consegui adicionar — o Spotify precisa estar aberto e tocando em algum dispositivo');
  }
}
window.spotifyQueueTrack = spotifyQueueTrack;

async function spotifySearch(){
  const input = document.getElementById('spotifySearchInput');
  const resultsEl = document.getElementById('spotifySearchResults');
  if(!input || !resultsEl) return;
  const query = input.value.trim();
  if(!query){ resultsEl.innerHTML = ''; return; }
  resultsEl.innerHTML = `<div class="section-sub" style="margin:8px 0;">Buscando...</div>`;
  const result = await spotifyFetch('/search?type=track&limit=8&q='+encodeURIComponent(query));
  const tracks = result && result.tracks ? result.tracks.items : [];
  if(tracks.length===0){
    resultsEl.innerHTML = `<div class="section-sub" style="margin:8px 0;">Nada encontrado.</div>`;
    return;
  }
  resultsEl.innerHTML = tracks.map(t=>{
    const art = t.album && t.album.images && t.album.images.length ? t.album.images[t.album.images.length-1].url : '';
    const artistNames = t.artists.map(a=>a.name).join(', ');
    return `
      <div class="spotify-result">
        ${art ? `<img src="${art}" alt="">` : `<div class="spotify-art"></div>`}
        <div class="spotify-result-info">
          <div class="spotify-result-title">${escapeHtml(t.name)}</div>
          <div class="spotify-result-artist">${escapeHtml(artistNames)}</div>
        </div>
        <button class="rest-btn" onclick="spotifyQueueTrack('${t.uri}', '${escapeHtml(t.name).replace(/'/g,"\\'")}')">+ Fila</button>
      </div>
    `;
  }).join('');
}
window.spotifySearch = spotifySearch;

function openSpotifySearch(){
  modal = { type:'spotifySearch' };
  render();
}
window.openSpotifySearch = openSpotifySearch;

function openSpotifySetup(){
  modal = { type:'spotifySetup' };
  render();
}
window.openSpotifySetup = openSpotifySetup;

async function pollSpotify(){
  if(!activeWorkout || !spotifyConnected()){
    clearInterval(spotifyPollId);
    renderSpotifyBar(null);
    return;
  }
  const track = await spotifyFetch('/me/player/currently-playing');
  renderSpotifyBar(track);
}

function startSpotifyPolling(){
  clearInterval(spotifyPollId);
  if(!spotifyConnected()){ renderSpotifyBar(null); return; }
  pollSpotify();
  spotifyPollId = setInterval(pollSpotify, 6000);
}

function stopSpotifyPolling(){
  clearInterval(spotifyPollId);
  renderSpotifyBar(null);
}

function renderSpotifyBar(track){
  const el = document.getElementById('spotifyMiniPlayer');
  if(!el) return;
  if(!track || !track.item){
    el.classList.remove('show');
    el.innerHTML = '';
    return;
  }
  const t = track.item;
  const images = t.album && t.album.images ? t.album.images : [];
  const art = images.length ? images[images.length-1].url : '';
  el.classList.add('show');
  el.innerHTML = `
    ${art ? `<img class="spotify-art" src="${art}" alt="">` : `<div class="spotify-art"></div>`}
    <div class="spotify-info">
      <div class="spotify-track">${escapeHtml(t.name)}</div>
      <div class="spotify-artist">${escapeHtml(t.artists.map(a=>a.name).join(', '))}</div>
    </div>
    <button class="spotify-search-btn" type="button" onclick="openSpotifySearch()" title="Buscar música" aria-label="Buscar música">🔍</button>
    <div class="spotify-controls">
      <button class="spotify-btn" type="button" onclick="spotifyPrev()" aria-label="Música anterior">⏮</button>
      <button class="spotify-btn spotify-btn-play" type="button" onclick="spotifyPlayPause()" aria-label="${track.is_playing?'Pausar':'Reproduzir'}">${track.is_playing?'⏸':'▶️'}</button>
      <button class="spotify-btn" type="button" onclick="spotifyNext()" aria-label="Próxima música">⏭</button>
    </div>
  `;
}


// ---------- acessibilidade ----------
function getAccessibilityPrefs(){
  try{
    return { largeText:false, highContrast:false, noMotion:false, ...JSON.parse(localStorage.getItem('clarinha_a11y') || '{}') };
  }catch(e){ return { largeText:false, highContrast:false, noMotion:false }; }
}
function applyAccessibilityPrefs(){
  const p = getAccessibilityPrefs();
  document.body.classList.toggle('a11y-large-text', !!p.largeText);
  document.body.classList.toggle('a11y-high-contrast', !!p.highContrast);
  document.body.classList.toggle('a11y-no-motion', !!p.noMotion);
}
function setAccessibilityPref(key,value){
  const p = getAccessibilityPrefs(); p[key]=Boolean(value);
  localStorage.setItem('clarinha_a11y', JSON.stringify(p));
  applyAccessibilityPrefs();
  showToast('Preferência atualizada');
}
function openAccessibilitySettings(){ modal={type:'accessibility'}; render(); }
window.openAccessibilitySettings=openAccessibilitySettings;
window.setAccessibilityPref=setAccessibilityPref;

function setupGlobalAccessibility(){
  applyAccessibilityPrefs();
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && modal){ e.preventDefault(); closeModal(); }
  });
}

// ---------- rendering ----------
function render(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <div class="brand">
        <div class="brand-mark">🌸</div>
        <div class="brand-name">Clarinha's<span>Personal</span></div>
      </div>
      <div class="header-actions">
        <div class="streak-badge" aria-label="Sequência atual: ${computeStreak()} ${computeStreak()===1?'dia':'dias'}">🔥 ${computeStreak()} ${computeStreak()===1?'dia':'dias'}</div>
        <button class="icon-btn bloom-header-btn" type="button" onclick="openBloomHub()" aria-label="Abrir área Coco da Malásia" title="Área Coco da Malásia">🌸</button><button class="icon-btn" type="button" onclick="toggleThemeV5()" aria-label="Alternar tema claro ou escuro" title="Alternar tema">◐</button><button class="icon-btn" type="button" onclick="openAccessibilitySettings()" aria-label="Abrir preferências de acessibilidade" title="Acessibilidade">Aa</button>
      </div>
    </div>
    <main id="screen" class="screen" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Navegação principal">
      ${tabBtn('home','Início')}
      ${tabBtn('routines','Rotinas')}
      ${tabBtn('history','Histórico')}
      ${tabBtn('progress','Progresso')}
    </nav>
  `;
  renderScreen();
  if(activeWorkout) renderActiveOverlay();
  if(modal) renderModal();
  if(modal && modal.type==='warmupCalc') recalcWarmup();
}

function tabBtn(key,label){
  const active = currentTab===key;
  return `<button type="button" class="tab ${active?'active':''}" onclick="setTab('${key}')" aria-current="${active?'page':'false'}" aria-label="${label}">
    ${svgIcon(key)}<span>${label}</span>
  </button>`;
}
function setTab(t){ currentTab = t; render(); requestAnimationFrame(()=>document.getElementById('screen')?.focus({preventScroll:true})); }
window.setTab = setTab;

function renderScreen(){
  const el = document.getElementById('screen');
  if(currentTab==='home') el.innerHTML = homeScreen();
  else if(currentTab==='routines') el.innerHTML = routinesScreen();
  else if(currentTab==='history') el.innerHTML = historyScreen();
  else if(currentTab==='progress') el.innerHTML = progressScreen();
}

function greeting(){
  const h = new Date().getHours();
  if(h<12) return 'Bom dia, Clarinha! ☀️';
  if(h<18) return 'Boa tarde, Clarinha! 💪';
  return 'Boa noite, Clarinha! 🌙';
}


function mascotMessage(){
  const streak = computeStreak();
  const done = weeklyCount();
  const goal = weeklyGoal();
  if(done >= goal) return 'Meta semanal concluída! Hoje é dia de comemorar — e alongar. ✨';
  if(streak >= 7) return `${streak} dias de sequência! Você está construindo um hábito de verdade. 🔥`;
  if(streak >= 3) return 'Olha essa sequência crescendo! Só mais um passo hoje. 💪';
  if(data.history.length === 0) return 'Oi! Eu sou a Marie. Vamos registrar nosso primeiro treino juntas? 🌸';
  return 'Treino pequeno também conta. O importante é aparecer e continuar. 🐾';
}

function homeScreen(){
  const recent = [...data.history].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,3);
  const lvl = levelInfo(totalXP());
  const goal = weeklyGoal();
  const done = weeklyCount();
  const goalPct = Math.min(100, Math.round((done/goal)*100));
  return `
    <div class="section-title">${greeting()}</div>
    <div class="section-sub">Bora manter o ritmo hoje?</div>

    <section class="mascot-hero" aria-label="Mensagem motivacional da Marie">
      <div class="mascot-glow"></div>
      <img class="mascot-img" src="assets/images/mascote-clarinha.svg" alt="Marie, mascote usando roupa de treino">
      <div class="mascot-copy">
        <div class="mascot-name"><span class="mascot-status"></span>Marie</div>
        <div class="mascot-bubble">${mascotMessage()}</div>
        <div class="mascot-mini-goal">${weeklyCount()}/${weeklyGoal()} treinos na semana</div>
      </div>
    </section>

    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div style="font-weight:900; color:var(--primary-dark);">⭐ Nível ${lvl.level}</div>
        <div class="li-sub" style="margin:0;">${lvl.xpInLevel}/${lvl.xpNeeded} XP</div>
      </div>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${Math.round((lvl.xpInLevel/lvl.xpNeeded)*100)}%;"></div></div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div style="font-weight:900; color:var(--primary-dark);">🎯 Meta semanal</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="icon-btn" style="width:26px; height:26px; font-size:14px;" onclick="updateWeeklyGoal(-1)">−</button>
          <div class="li-sub" style="margin:0;">${done}/${goal} treinos</div>
          <button class="icon-btn" style="width:26px; height:26px; font-size:14px;" onclick="updateWeeklyGoal(1)">+</button>
        </div>
      </div>
      <div class="xp-bar"><div class="xp-bar-fill ${done>=goal?'goal-done':''}" style="width:${goalPct}%;"></div></div>
      ${done>=goal ? `<div class="li-sub" style="margin-top:6px; color:var(--success);">Meta batida essa semana! 🎉</div>` : ''}
    </div>

    <div class="stats-row">
      <div class="stat-box"><div class="stat-num">${weeklyCount()}</div><div class="stat-label">Essa semana</div></div>
      <div class="stat-box"><div class="stat-num">${data.history.length}</div><div class="stat-label">Total treinos</div></div>
      <div class="stat-box"><div class="stat-num stat-num-sm">${weeklyVolume().toLocaleString('pt-BR')}kg</div><div class="stat-label">Volume semana</div></div>
    </div>
    <button class="btn btn-primary" onclick="openStartPicker()">🏋️ Começar treino</button>
    <div style="height:10px"></div>
    <div class="btn-block-row">
      <button class="btn btn-secondary" onclick="openWarmupCalc()" style="width:100%;">🔥 Calculadora de aquecimento</button>
    </div>
    <div style="height:10px"></div>
    <div class="btn-block-row">
      <button class="btn btn-secondary" onclick="openSpotifySetup()" style="width:100%;">${spotifyConnected()?'🎧 Spotify conectado ✓':'🎧 Conectar Spotify'}</button>
    </div>
    <div style="height:20px"></div>
    <div class="section-title" style="font-size:16px; margin-bottom:8px;">Últimos treinos</div>
    <div class="card">
      ${recent.length===0 ? emptyState('📓','Nenhum treino ainda. Bora começar o primeiro?') :
        recent.map(h => `
          <div class="list-item" onclick="viewHistoryDetail('${h.id}')">
            <div>
              <div class="li-title">${escapeHtml(h.name)}</div>
              <div class="li-sub">${fmtDate(h.date)} · ${h.exercises.length} exercícios</div>
            </div>
            <div class="chev">›</div>
          </div>
        `).join('')}
    </div>
  `;
}

function emptyState(emoji,text){
  return `<div class="empty-state"><span class="emoji">${emoji}</span>${text}</div>`;
}

function escapeHtml(s){
  const d = document.createElement('div'); d.innerText = s; return d.innerHTML;
}

// ---------- ROUTINES ----------
function routinesScreen(){
  return `
    <div class="section-title">Suas rotinas</div>
    <div class="section-sub">Monta um treino padrão pra não perder tempo pensando</div>
    <button class="btn btn-secondary" onclick="openRoutineEditor()">+ Nova rotina</button>
    <div style="height:16px"></div>
    ${data.routines.length===0 ? `<div class="card">${emptyState('🗂️','Você ainda não tem rotinas salvas.')}</div>` :
      data.routines.map(r => `
        <div class="card routine-card" style="margin-bottom:10px;">
          <div style="display:flex; gap:10px; align-items:center; flex:1;" onclick="viewRoutine('${r.id}')">
            <div class="routine-dot"></div>
            <div>
              <div class="routine-name">${escapeHtml(r.name)}</div>
              <div class="routine-meta">${r.exercises.length} exercício${r.exercises.length===1?'':'s'}</div>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" style="width:auto;" onclick="startWorkout('${r.id}')">Iniciar</button>
        </div>
      `).join('')}
  `;
}

function viewRoutine(id){
  const r = data.routines.find(x=>x.id===id);
  if(!r) return;
  modal = { type:'routineView', routine: r };
  render();
}

function openRoutineEditor(existing){
  modal = { type:'routineEdit', name: existing? existing.name : '', exercises: existing? [...existing.exercises] : [], editId: existing? existing.id : null };
  render();
}

function addExerciseToEditor(){
  const input = document.getElementById('newExerciseInput');
  const name = input.value.trim();
  if(!name) return;
  modal.exercises.push({ name });
  input.value = '';
  render();
  setTimeout(()=> document.getElementById('newExerciseInput')?.focus(), 30);
}
window.addExerciseToEditor = addExerciseToEditor;

function removeExerciseFromEditor(idx){
  modal.exercises.splice(idx,1);
  render();
}
window.removeExerciseFromEditor = removeExerciseFromEditor;

async function saveRoutine(){
  const nameInput = document.getElementById('routineNameInput');
  const name = nameInput.value.trim();
  if(!name){ showToast('Dá um nome pra rotina 🙂'); return; }
  if(modal.exercises.length===0){ showToast('Adiciona pelo menos 1 exercício'); return; }
  try{
    if(modal.editId){
      const updated = await api(`/api/routines/${modal.editId}`, { method:'PUT', body: JSON.stringify({name, exercises: modal.exercises}) });
      const r = data.routines.find(x=>x.id===modal.editId);
      r.name = updated.name; r.exercises = updated.exercises;
    } else {
      const created = await api('/api/routines', { method:'POST', body: JSON.stringify({name, exercises: modal.exercises}) });
      data.routines.push(created);
    }
    modal = null;
    currentTab = 'routines';
    render();
    showToast('Rotina salva! ✨');
  }catch(e){
    showToast('Não consegui salvar no servidor 😕');
  }
}
window.saveRoutine = saveRoutine;

async function deleteRoutine(id){
  try{
    await api(`/api/routines/${id}`, { method:'DELETE' });
    data.routines = data.routines.filter(r=>r.id!==id);
    modal = null;
    render();
    showToast('Rotina removida');
  }catch(e){
    showToast('Não consegui remover no servidor 😕');
  }
}
window.deleteRoutine = deleteRoutine;

// ---------- START WORKOUT ----------
function openStartPicker(){
  modal = { type:'startPicker' };
  render();
}
window.openStartPicker = openStartPicker;

function startWorkout(routineId){
  const r = routineId ? data.routines.find(x=>x.id===routineId) : null;
  activeWorkout = {
    routineId: r ? r.id : null,
    name: r ? r.name : 'Treino livre',
    note: '',
    exercises: r ? r.exercises.map(e => ({ name: e.name, note:'', supersetGroup:null, sets: [{ weight:'', reps:'', done:false, type:'normal', rpe:'' }] })) : [],
    startedAt: new Date().toISOString()
  };
  sessionPRs = new Set();
  modal = null;
  saveActive();
  render();
}
window.startWorkout = startWorkout;

function updateWorkoutNote(val){
  activeWorkout.note = val;
}
window.updateWorkoutNote = updateWorkoutNote;

function updateExerciseNote(exIdx, val){
  activeWorkout.exercises[exIdx].note = val;
}
window.updateExerciseNote = updateExerciseNote;

function cycleSuperset(exIdx){
  const ex = activeWorkout.exercises[exIdx];
  const idx = ex.supersetGroup ? SUPERSET_LETTERS.indexOf(ex.supersetGroup) : -1;
  ex.supersetGroup = (idx+1 >= SUPERSET_LETTERS.length) ? null : SUPERSET_LETTERS[idx+1];
  saveActive();
  render();
}
window.cycleSuperset = cycleSuperset;

function addExerciseToActive(){
  openExercisePicker('active');
}
window.addExerciseToActive = addExerciseToActive;

// ---------- EXERCISE LIBRARY PICKER ----------
function openExercisePicker(target){
  const prev = target==='routine' ? { name: modal.name, exercises: modal.exercises, editId: modal.editId } : null;
  modal = { type:'exercisePicker', target, group:null, prev };
  render();
}
window.openExercisePicker = openExercisePicker;

function pickLibraryGroup(g){
  modal.group = g;
  render();
}
window.pickLibraryGroup = pickLibraryGroup;

function backToLibraryGroups(){
  modal.group = null;
  render();
}
window.backToLibraryGroups = backToLibraryGroups;

function pickLibraryExercise(encodedName){
  const name = decodeURIComponent(encodedName || '').trim();
  if(!name){ showToast('Escreve ou escolhe um exercício'); return; }
  if(modal.target==='routine'){
    modal.prev.exercises.push({ name });
    modal = { type:'routineEdit', name: modal.prev.name, exercises: modal.prev.exercises, editId: modal.prev.editId };
  } else {
    activeWorkout.exercises.push({ name, note:'', supersetGroup:null, sets:[{weight:'',reps:'',done:false,type:'normal',rpe:''}] });
    saveActive();
    modal = null;
  }
  render();
}
window.pickLibraryExercise = pickLibraryExercise;

function pickCustomExercise(){
  const input = document.getElementById('customExerciseInput');
  pickLibraryExercise(encodeURIComponent(input ? input.value : ''));
}
window.pickCustomExercise = pickCustomExercise;

function closeExercisePicker(){
  if(modal.target==='routine' && modal.prev){
    modal = { type:'routineEdit', name: modal.prev.name, exercises: modal.prev.exercises, editId: modal.prev.editId };
  } else {
    modal = null;
  }
  render();
}
window.closeExercisePicker = closeExercisePicker;

// ---------- EXERCISE PHOTOS ----------
// Arquivos locais usam nomes simples, sem espaços e sem acentos.
// Isso evita erros no GitHub Pages, Windows e celulares.
const LOCAL_EXERCISE_PHOTOS = Object.freeze({
  "supino reto com barra": "supino-reto-com-barra.webp",
  "supino com barra": "supino-reto-com-barra.webp",
  "supino reto com halteres": "supino-reto-com-halteres.webp",
  "supino com halteres": "supino-reto-com-halteres.webp",
  "supino inclinado com halteres": "supino-inclinado-com-halteres.webp",
  "crucifixo com halteres": "crucifixo-com-halteres.webp",
  "crossover no cabo": "crossover-no-cabo.webp",
  "peck deck": "peck-deck.webp",
  "flexao de braco": "flexao-de-braco.webp",
  "puxada frontal": "puxada-frontal.webp",
  "remada baixa cabo": "remada-baixa-cabo.webp",
  "remada curvada com barra": "remada-curvada-com-barra.webp",
  "remada unilateral com halter": "remada-unilateral.webp",
  "remada unilateral": "remada-unilateral.webp",
  "barra fixa pull up": "barra-fixa.webp",
  "barra fixa": "barra-fixa.webp",
  "pulldown": "pulldown.webp",
  "levantamento terra": "levantamento-terra.webp",
  "agachamento livre": "agachamento-livre.webp",
  "agachamento no smith": "agachamento-smith.webp",
  "agachamento smith": "agachamento-smith.webp",
  "leg press": "leg-press.webp",
  "cadeira extensora": "cadeira-extensora.webp",
  "cadeira flexora": "cadeira-flexora.webp",
  "afundo com halteres": "afundo-com-halteres.webp",
  "stiff com barra": "stiff-com-barra.webp",
  "panturrilha em pe": "panturrilha-em-pe.webp",
  "desenvolvimento com halteres": "desenvolvimento-com-halteres.webp",
  "desenvolvimento militar com barra": "desenvolvimento-com-barra-militar.webp",
  "desenvolvimento com barra militar": "desenvolvimento-com-barra-militar.webp",
  "elevacao lateral": "elevacao-lateral.webp",
  "elevacao frontal": "elevacao-frontal.webp",
  "remada alta": "remada-alta.webp",
  "crucifixo inverso": "crucifixo-inverso.webp",
  "rosca direta com barra": "rosca-direta-com-barra.webp",
  "rosca alternada com halteres": "rosca-alternada-com-halteres.webp",
  "rosca martelo": "rosca-martelo.webp",
  "rosca scott": "rosca-scott.webp",
  "rosca concentrada": "rosca-concentrada.webp",
  "triceps corda no cabo": "triceps-corda-no-cabo.webp",
  "triceps testa com barra": "triceps-testa-com-barra.webp",
  "triceps frances": "triceps-franca.webp",
  "mergulho no banco": "mergulho-no-banco.webp",
  "triceps coice com halter": "triceps-coice.webp",
  "triceps coice": "triceps-coice.webp",
  "abdominal infra": "abdominal-infra.webp",
  "prancha": "praancha.webp",
  "elevacao de pernas": "elevacao-de-pernas.webp",
  "abdominal obliquo": "abdominal-obliquo.webp",
  "abdominal na polia": "abdominal-na-polia.webp",
  "elevacao pelvica hip thrust": "elevacao-pelvica.webp",
  "elevacao pelvica": "elevacao-pelvica.webp",
  "cadeira abdutora": "cadeira-abdutora.webp",
  "agachamento sumo": "agachamento-sumo.webp",
  "coice no cabo": "coice-na-polia.webp",
  "coice na polia": "coice-na-polia.webp",
  "passada afundo": "passada-afundo.webp",
  "passada": "passada-afundo.webp",
  "esteira": "esteira.webp",
  "bicicleta ergometrica": "bicicleta-ergonomica.webp",
  "bicicleta ergonomica": "bicicleta-ergonomica.webp",
  "corda": "corda.webp",
  "eliptico": "eliptico.webp"
});

function normalizeExerciseName(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function customExercisePhoto(name){
  if(data.exercisePhotos[name]) return data.exercisePhotos[name];
  const wanted = normalizeExerciseName(name);
  const matchingKey = Object.keys(data.exercisePhotos || {}).find(
    key => normalizeExerciseName(key) === wanted
  );
  return matchingKey ? data.exercisePhotos[matchingKey] : '';
}

function exercisePhotoUrl(name){
  const custom = customExercisePhoto(name);
  if(custom) return custom;
  const filename = LOCAL_EXERCISE_PHOTOS[normalizeExerciseName(name)];
  return filename ? `assets/images/exercises/${filename}` : '';
}

function hasCustomExercisePhoto(name){
  return Boolean(customExercisePhoto(name));
}

function hasExercisePhoto(name){
  return Boolean(exercisePhotoUrl(name));
}

function exercisePhotoMarkup(name, sizeClass='ex-photo-thumb-sm', interactive=true){
  const safeName = escapeHtml(name);
  const encoded = encodeURIComponent(name);
  const url = exercisePhotoUrl(name);
  const click = interactive ? `onclick="triggerPhotoUpload('${encoded}')"` : '';
  const keyboard = interactive ? `role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();triggerPhotoUpload('${encoded}')}"` : '';
  if(!url){
    return `<div class="ex-photo-thumb ${sizeClass} is-placeholder" ${click} ${keyboard} aria-label="Adicionar foto para ${safeName}"><span aria-hidden="true">📷</span></div>`;
  }
  return `<div class="ex-photo-thumb ${sizeClass} has-photo" ${click} ${keyboard} aria-label="Foto de ${safeName}">
    <img src="${escapeHtml(url)}" alt="Demonstração do exercício ${safeName}" loading="lazy" decoding="async" onerror="this.parentElement.classList.remove('has-photo');this.parentElement.classList.add('is-placeholder');this.remove();this.parentElement.insertAdjacentHTML('beforeend','<span aria-hidden=&quot;true&quot;>📷</span>')">
  </div>`;
}

function triggerPhotoUpload(encodedName){
  const input = document.getElementById('photoUploadInput');
  if(!input) return;
  input.dataset.targetName = decodeURIComponent(encodedName);
  input.click();
}
window.triggerPhotoUpload = triggerPhotoUpload;

function resizeImageToDataUrl(file, maxSize, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > h){ if(w > maxSize){ h = Math.round(h*maxSize/w); w = maxSize; } }
        else if(h > maxSize){ w = Math.round(w*maxSize/h); h = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,w,h);
        const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        resolve(canvas.toDataURL(supportsWebP ? 'image/webp' : 'image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePhotoFileSelected(inputEl){
  const file = inputEl.files && inputEl.files[0];
  const name = inputEl.dataset.targetName;
  inputEl.value = '';
  if(!file || !name) return;
  if(!file.type.startsWith('image/')){
    showToast('Escolha um arquivo de imagem');
    return;
  }
  try{
    const dataUrl = await resizeImageToDataUrl(file, 420, 0.82);
    await api('/api/exercise-photos', { method:'PUT', body: JSON.stringify({ name, photo: dataUrl }) });
    data.exercisePhotos[name] = dataUrl;
    render();
    showToast('Foto salva! 📸');
  }catch(e){
    console.error(e);
    showToast('Não consegui salvar a foto 😕');
  }
}
window.handlePhotoFileSelected = handlePhotoFileSelected;

async function deleteExercisePhoto(encodedName){
  const name = decodeURIComponent(encodedName);
  if(!hasCustomExercisePhoto(name)){
    showToast('Essa é a imagem padrão do exercício');
    return;
  }
  try{
    const wanted = normalizeExerciseName(name);
    const matchingKey = Object.keys(data.exercisePhotos || {}).find(
      key => normalizeExerciseName(key) === wanted
    ) || name;
    await api('/api/exercise-photos', { method:'DELETE', body: JSON.stringify({ name: matchingKey }) });
    delete data.exercisePhotos[matchingKey];
    render();
    showToast('Foto personalizada removida');
  }catch(e){
    console.error(e);
    showToast('Não consegui apagar a foto 😕');
  }
}
window.deleteExercisePhoto = deleteExercisePhoto;

function addSet(exIdx){
  const ex = activeWorkout.exercises[exIdx];
  const last = ex.sets[ex.sets.length-1];
  ex.sets.push({ weight: last? last.weight:'', reps: last? last.reps:'', done:false, type: last? (last.type||'normal') : 'normal', rpe:'' });
  saveActive();
  render();
}
window.addSet = addSet;

function removeSet(exIdx,setIdx){
  activeWorkout.exercises[exIdx].sets.splice(setIdx,1);
  saveActive();
  render();
}
window.removeSet = removeSet;

function updateSetField(exIdx,setIdx,field,value){
  activeWorkout.exercises[exIdx].sets[setIdx][field] = value;
}
window.updateSetField = updateSetField;

function cycleSetType(exIdx,setIdx){
  const s = activeWorkout.exercises[exIdx].sets[setIdx];
  const cur = SET_TYPES.indexOf(s.type||'normal');
  s.type = SET_TYPES[(cur+1)%SET_TYPES.length];
  saveActive();
  render();
}
window.cycleSetType = cycleSetType;

function setTypeLabel(type, idx){
  if(type==='warmup') return 'W';
  if(type==='drop') return 'D';
  if(type==='failure') return 'F';
  return idx+1;
}
function setTypeClass(type){
  if(type==='warmup') return 'set-type-warmup';
  if(type==='drop') return 'set-type-drop';
  if(type==='failure') return 'set-type-failure';
  return '';
}
function estimate1RM(weight, reps){
  if(!weight || !reps) return 0;
  return weight * (1 + reps/30);
}

function toggleSetDone(exIdx,setIdx){
  const s = activeWorkout.exercises[exIdx].sets[setIdx];
  s.done = !s.done;
  saveActive();
  render();
  if(s.done){
    celebrateIfPR(exIdx, s);
    startRestTimer(restDefaultSeconds);
  }
}
window.toggleSetDone = toggleSetDone;

function historicalPR(name){
  let best = 0;
  data.history.forEach(h=>{
    const ex = h.exercises.find(e=>e.name===name);
    if(ex) ex.sets.forEach(st=>{
      if((st.type||'normal')==='warmup') return;
      const w = parseFloat(st.weight)||0;
      if(w>best) best = w;
    });
  });
  return best;
}

function celebrateIfPR(exIdx, s){
  if((s.type||'normal')==='warmup') return;
  const w = parseFloat(s.weight)||0;
  if(w<=0) return;
  const name = activeWorkout.exercises[exIdx].name;
  if(sessionPRs.has(name)) return;
  const pr = historicalPR(name);
  if(w > pr){
    sessionPRs.add(name);
    setTimeout(()=> showToast(`🎉 Novo recorde em ${name}: ${w}kg!`, 3200), 250);
  }
}

// ---------- REST TIMER ----------
let notifAsked = false;
let alarmTimeoutId = null;

function maybeAskNotificationPermission(){
  if(notifAsked) return;
  notifAsked = true;
  try{
    if('Notification' in window && Notification.permission==='default'){
      Notification.requestPermission().catch(()=>{});
    }
  }catch(e){}
}

function startRestTimer(seconds){
  maybeAskNotificationPermission();
  if(restTimer) clearInterval(restTimer.tickId);
  dismissRestAlarm();
  restDefaultSeconds = seconds;
  restTimer = { total: seconds, remaining: seconds, tickId: null };
  renderRestBar();
  restTimer.tickId = setInterval(()=>{
    if(!restTimer) return;
    restTimer.remaining--;
    if(restTimer.remaining<=0){
      clearInterval(restTimer.tickId);
      restTimer = null;
      try{ navigator.vibrate && navigator.vibrate([300,150,300,150,300]); }catch(e){}
      playAlarm();
      showRestAlarm();
      if(document.hidden) sendRestNotification();
      return;
    }
    renderRestBar();
  },1000);
}
window.startRestTimer = startRestTimer;

function adjustRestTimer(delta){
  if(!restTimer) return;
  restTimer.remaining = Math.max(0, restTimer.remaining + delta);
  restTimer.total = Math.max(restTimer.total, restTimer.remaining);
  renderRestBar();
}
window.adjustRestTimer = adjustRestTimer;

function skipRestTimer(){
  if(restTimer) clearInterval(restTimer.tickId);
  restTimer = null;
  renderRestBar();
}
window.skipRestTimer = skipRestTimer;

function showRestAlarm(){
  const el = document.getElementById('restTimerBar');
  if(!el) return;
  el.classList.add('show','alarm');
  el.innerHTML = `
    <div class="rest-bar-content" style="justify-content:center; gap:12px;">
      <div class="rest-bar-time">⏰ Descanso acabou! Bora 💪</div>
      <button class="rest-btn rest-btn-skip" onclick="dismissRestAlarm()">OK</button>
    </div>
  `;
  clearTimeout(alarmTimeoutId);
  alarmTimeoutId = setTimeout(dismissRestAlarm, 8000);
}

function dismissRestAlarm(){
  clearTimeout(alarmTimeoutId);
  const el = document.getElementById('restTimerBar');
  if(el){ el.classList.remove('show','alarm'); el.innerHTML=''; }
}
window.dismissRestAlarm = dismissRestAlarm;

function playAlarm(){
  try{
    const Ctx = window.AudioContext||window.webkitAudioContext;
    const ctx = new Ctx();
    const freqs = [880,660,880];
    freqs.forEach((f,i)=>{
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.18;
      const start = ctx.currentTime + i*0.3;
      o.start(start);
      o.stop(start+0.24);
    });
    setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 1300);
  }catch(e){ /* audio indisponível, tudo bem */ }
}

function sendRestNotification(){
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('Descanso acabou! 💪', { body:'Bora pra próxima série.', tag:'clarinha-rest' });
    }
  }catch(e){ /* notificação indisponível, tudo bem */ }
}

function renderRestBar(){
  const el = document.getElementById('restTimerBar');
  if(!el) return;
  if(el.classList.contains('alarm')) return;
  if(!restTimer){
    el.classList.remove('show');
    el.innerHTML = '';
    return;
  }
  const pct = Math.max(0, Math.min(100, (restTimer.remaining/restTimer.total)*100));
  el.classList.add('show');
  el.innerHTML = `
    <div class="rest-bar-fill" style="width:${pct}%;"></div>
    <div class="rest-bar-content">
      <div class="rest-bar-time">⏱️ ${fmtDuration(restTimer.remaining)}</div>
      <div class="rest-bar-actions">
        <button class="rest-btn" onclick="adjustRestTimer(-15)">−15s</button>
        <button class="rest-btn" onclick="adjustRestTimer(15)">+15s</button>
        <button class="rest-btn rest-btn-skip" onclick="skipRestTimer()">Pular</button>
      </div>
    </div>
  `;
}

function confirmCancelWorkout(){
  modal = { type:'confirmCancel' };
  render();
}
window.confirmCancelWorkout = confirmCancelWorkout;

function cancelWorkoutConfirmed(){
  activeWorkout = null;
  saveActive();
  modal = null;
  if(restTimer){ clearInterval(restTimer.tickId); restTimer = null; }
  dismissRestAlarm();
  clearInterval(durationTickId);
  stopSpotifyPolling();
  render();
}
window.cancelWorkoutConfirmed = cancelWorkoutConfirmed;

async function finishWorkout(){
  const cleaned = activeWorkout.exercises
    .map(ex => ({
      name: ex.name,
      note: ex.note || undefined,
      supersetGroup: ex.supersetGroup || undefined,
      sets: ex.sets.filter(s => s.weight!=='' || s.reps!=='')
    }))
    .filter(ex => ex.sets.length>0);
  if(cleaned.length===0){
    showToast('Registra pelo menos uma série antes de terminar 💛');
    return;
  }
  const durationSeconds = Math.round((Date.now() - new Date(activeWorkout.startedAt).getTime())/1000);
  const volume = workoutVolume(cleaned);
  const payload = { name: activeWorkout.name, date: new Date().toISOString(), exercises: cleaned, durationSeconds, volume, note: activeWorkout.note || undefined };
  const levelBefore = levelInfo(totalXP()).level;
  const unlockedBefore = new Set(unlockedAchievements().map(a=>a.id));
  try{
    const created = await api('/api/history', { method:'POST', body: JSON.stringify(payload) });
    data.history.push(created);
    activeWorkout = null;
    if(restTimer){ clearInterval(restTimer.tickId); restTimer = null; }
    dismissRestAlarm();
    clearInterval(durationTickId);
    stopSpotifyPolling();
    await saveActive();
    currentTab = 'home';
    render();
    showToast('Treino salvo! Arrasou 🌸');
    const levelAfter = levelInfo(totalXP()).level;
    const newAchievements = unlockedAchievements().filter(a => !unlockedBefore.has(a.id));
    let delay = 2000;
    if(levelAfter > levelBefore){
      setTimeout(()=> showToast(`⭐ Subiu pro nível ${levelAfter}!`, 3000), delay);
      delay += 2600;
    }
    newAchievements.forEach(a=>{
      setTimeout(()=> showToast(`🏆 Conquista desbloqueada: ${a.title}!`, 3000), delay);
      delay += 2600;
    });
  }catch(e){
    showToast('Não consegui salvar no servidor 😕');
  }
}
window.finishWorkout = finishWorkout;

function renderActiveOverlay(){
  const div = document.createElement('div');
  div.className = 'overlay';
  div.id = 'activeOverlay';
  div.innerHTML = `
    <div class="overlay-header">
      <button class="icon-btn" onclick="confirmCancelWorkout()">✕</button>
      <div class="overlay-title">${escapeHtml(activeWorkout.name)}</div>
      <button class="icon-btn" onclick="openWarmupCalc()" title="Calculadora de aquecimento">🔥</button>
    </div>
    <div class="overlay-stats">
      <div><div class="ov-stat" id="liveDuration">0:00</div><div class="ov-stat-label">Duração</div></div>
      <div><div class="ov-stat">${workoutVolume(activeWorkout.exercises).toLocaleString('pt-BR')}kg</div><div class="ov-stat-label">Volume total</div></div>
    </div>
    <div style="padding:8px 20px 0;">
      <textarea class="workout-note-input" rows="1" placeholder="Notas do treino (opcional)"
        oninput="updateWorkoutNote(this.value)" onblur="saveActive()">${escapeHtml(activeWorkout.note||'')}</textarea>
    </div>
    <div style="padding-top:14px;">
      ${activeWorkout.exercises.map((ex,exIdx)=>{
        const linked = exIdx>0 && ex.supersetGroup && activeWorkout.exercises[exIdx-1].supersetGroup===ex.supersetGroup;
        const borderStyle = ex.supersetGroup ? `border-left:4px solid ${SUPERSET_COLORS[ex.supersetGroup]};` : '';
        const marginStyle = linked ? 'margin-top:-6px;' : '';
        return `
        <div class="ex-block" style="${borderStyle}${marginStyle}">
          <div class="ex-block-header">
            <div style="display:flex; align-items:center; gap:10px; min-width:0;">
              ${exercisePhotoMarkup(ex.name, 'ex-photo-thumb-sm', true)}
              <div style="min-width:0;">
                <div class="ex-block-name">${escapeHtml(ex.name)}</div>
                ${lastTimeText(ex.name) ? `<div class="ex-last-time ex-last-time-tap" onclick="copyLastTime(${exIdx})">📋 Última vez: ${escapeHtml(lastTimeText(ex.name))}</div>` : ''}
              </div>
            </div>
            <button class="superset-tag ${ex.supersetGroup?'active':''}" onclick="cycleSuperset(${exIdx})">${ex.supersetGroup ? '🔗 Superset '+ex.supersetGroup : '🔗 Superset'}</button>
          </div>
          <div class="set-cols-label"><div></div><div>Kg</div><div>Reps</div><div>RPE</div><div></div></div>
          ${ex.sets.map((s,setIdx)=>`
            <div class="set-row">
              <div class="set-num ${setTypeClass(s.type)}" onclick="cycleSetType(${exIdx},${setIdx})">${setTypeLabel(s.type,setIdx)}</div>
              <input class="set-input" type="number" inputmode="decimal" placeholder="0" value="${s.weight}"
                oninput="updateSetField(${exIdx},${setIdx},'weight',this.value)" onblur="saveActive()">
              <input class="set-input" type="number" inputmode="numeric" placeholder="0" value="${s.reps}"
                oninput="updateSetField(${exIdx},${setIdx},'reps',this.value)" onblur="saveActive()">
              <input class="set-input set-rpe-input" type="number" inputmode="numeric" min="1" max="10" placeholder="-" value="${s.rpe||''}"
                oninput="updateSetField(${exIdx},${setIdx},'rpe',this.value)" onblur="saveActive()">
              <div class="set-check ${s.done?'done':''}" onclick="toggleSetDone(${exIdx},${setIdx})">✓</div>
            </div>
          `).join('')}
          <div class="add-set-link" onclick="addSet(${exIdx})">+ Adicionar série</div>
          <input class="set-input ex-note-input" placeholder="Nota do exercício (opcional)" value="${escapeHtml(ex.note||'')}"
            oninput="updateExerciseNote(${exIdx}, this.value)" onblur="saveActive()">
        </div>
      `;}).join('')}
      <div style="padding:0 20px 10px;">
        <button class="btn btn-secondary" onclick="addExerciseToActive()">+ Adicionar exercício</button>
      </div>
    </div>
    <div class="finish-bar">
      <button class="btn btn-primary" onclick="finishWorkout()">Finalizar treino ✅</button>
    </div>
  `;
  document.getElementById('app').appendChild(div);
  startDurationTick();
  renderRestBar();
  startSpotifyPolling();
}

function startDurationTick(){
  clearInterval(durationTickId);
  const tick = ()=>{
    const el = document.getElementById('liveDuration');
    if(!el || !activeWorkout){ clearInterval(durationTickId); return; }
    el.textContent = fmtDuration((Date.now() - new Date(activeWorkout.startedAt).getTime())/1000);
  };
  tick();
  durationTickId = setInterval(tick, 1000);
}

// ---------- HISTORY ----------
function historyScreen(){
  const sorted = [...data.history].sort((a,b)=> new Date(b.date)-new Date(a.date));
  return `
    <div class="section-title">Histórico</div>
    <div class="section-sub">Tudo que você já treinou até aqui</div>
    ${calendarWidget()}
    <div class="card">
      ${sorted.length===0 ? emptyState('📭','Sem treinos registrados ainda.') :
        sorted.map(h => `
          <div class="list-item" onclick="viewHistoryDetail('${h.id}')">
            <div>
              <div class="li-title">${escapeHtml(h.name)}</div>
              <div class="li-sub">${fmtDate(h.date)} · ${h.exercises.length} exercícios · ${totalSets(h)} séries${fmtDurationShort(h.durationSeconds) ? ' · '+fmtDurationShort(h.durationSeconds) : ''}</div>
            </div>
            <div class="chev">›</div>
          </div>
        `).join('')}
    </div>
  `;
}
function totalSets(h){ return h.exercises.reduce((a,e)=>a+e.sets.length,0); }

function viewHistoryDetail(id){
  const h = data.history.find(x=>x.id===id);
  if(!h) return;
  modal = { type:'historyDetail', workout: h };
  render();
}
window.viewHistoryDetail = viewHistoryDetail;

async function deleteHistoryEntry(id){
  try{
    await api(`/api/history/${id}`, { method:'DELETE' });
    data.history = data.history.filter(h=>h.id!==id);
    modal = null;
    render();
    showToast('Treino apagado');
  }catch(e){
    showToast('Não consegui apagar no servidor 😕');
  }
}
window.deleteHistoryEntry = deleteHistoryEntry;

async function duplicateAsRoutine(id){
  const h = data.history.find(x=>x.id===id);
  if(!h) return;
  const exercises = h.exercises.map(e => ({ name: e.name }));
  try{
    const created = await api('/api/routines', { method:'POST', body: JSON.stringify({ name: h.name+' (rotina)', exercises }) });
    data.routines.push(created);
    modal = null;
    currentTab = 'routines';
    render();
    showToast('Rotina criada a partir do treino! ✨');
  }catch(e){
    showToast('Não consegui salvar no servidor 😕');
  }
}
window.duplicateAsRoutine = duplicateAsRoutine;

// ---------- CALENDAR ----------
function workoutDatesSet(){
  return new Set(data.history.map(h => new Date(h.date).toDateString()));
}
function shiftCalendarMonth(delta){
  calendarCursor.setMonth(calendarCursor.getMonth()+delta);
  render();
}
window.shiftCalendarMonth = shiftCalendarMonth;

function viewCalendarDay(y,m,d){
  const dateStr = new Date(y,m,d).toDateString();
  const entries = data.history.filter(h => new Date(h.date).toDateString()===dateStr);
  if(entries.length===1){
    viewHistoryDetail(entries[0].id);
  } else if(entries.length>1){
    modal = { type:'dayList', entries, dateLabel: fmtDate(new Date(y,m,d).toISOString()) };
    render();
  }
}
window.viewCalendarDay = viewCalendarDay;

function calendarWidget(){
  const y = calendarCursor.getFullYear(), m = calendarCursor.getMonth();
  const first = new Date(y,m,1);
  const startDow = (first.getDay()+6)%7;
  const daysInMonth = new Date(y,m+1,0).getDate();
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const trained = workoutDatesSet();
  const todayStr = new Date().toDateString();
  let cells = '';
  for(let i=0;i<startDow;i++) cells += `<div class="cal-cell empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateObj = new Date(y,m,d);
    const isTrained = trained.has(dateObj.toDateString());
    const isToday = dateObj.toDateString()===todayStr;
    cells += `<div class="cal-cell ${isTrained?'trained':''} ${isToday?'today':''}" onclick="viewCalendarDay(${y},${m},${d})">${d}</div>`;
  }
  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="cal-header">
        <button class="icon-btn" style="width:30px;height:30px;font-size:14px;" onclick="shiftCalendarMonth(-1)">‹</button>
        <div class="cal-title">${monthNames[m]} ${y}</div>
        <button class="icon-btn" style="width:30px;height:30px;font-size:14px;" onclick="shiftCalendarMonth(1)">›</button>
      </div>
      <div class="cal-grid cal-dow">
        ${['S','T','Q','Q','S','S','D'].map(d=>`<div class="cal-dow-cell">${d}</div>`).join('')}
      </div>
      <div class="cal-grid">${cells}</div>
    </div>
  `;
}

// ---------- PROGRESS ----------
function allExerciseNames(){
  const set = new Set();
  data.history.forEach(h => h.exercises.forEach(e => set.add(e.name)));
  return [...set].sort((a,b)=>a.localeCompare(b));
}

function progressScreen(){
  const names = allExerciseNames();
  if(!progressExercise) progressExercise = '__bw__';

  const pillRow = `
    <div class="pill-row">
      <div class="pill ${progressExercise==='__bw__'?'active':''}" onclick="setProgressExercise('${encodeURIComponent('__bw__')}')">⚖️ Peso corporal</div>
      <div class="pill ${progressExercise==='__meas__'?'active':''}" onclick="setProgressExercise('${encodeURIComponent('__meas__')}')">📏 Medidas</div>
      <div class="pill ${progressExercise==='__achv__'?'active':''}" onclick="setProgressExercise('${encodeURIComponent('__achv__')}')">🏆 Conquistas</div>
      ${names.map(n => `<div class="pill ${n===progressExercise?'active':''}" onclick="setProgressExercise('${encodeURIComponent(n)}')">${escapeHtml(n)}</div>`).join('')}
    </div>
  `;

  if(progressExercise==='__bw__'){
    return `
      <div class="section-title">Progresso</div>
      <div class="section-sub">Peso corporal, medidas e evolução nos exercícios</div>
      ${pillRow}
      ${bodyweightSection()}
    `;
  }

  if(progressExercise==='__meas__'){
    return `
      <div class="section-title">Progresso</div>
      <div class="section-sub">Peso corporal, medidas e evolução nos exercícios</div>
      ${pillRow}
      ${measurementsSection()}
    `;
  }

  if(progressExercise==='__achv__'){
    return `
      <div class="section-title">Progresso</div>
      <div class="section-sub">Peso corporal, medidas e evolução nos exercícios</div>
      ${pillRow}
      ${achievementsSection()}
    `;
  }

  if(names.length===0 || !names.includes(progressExercise)){
    return `
      <div class="section-title">Progresso</div>
      <div class="section-sub">Peso corporal, medidas e evolução nos exercícios</div>
      ${pillRow}
      <div class="card">${emptyState('📈','Registra treinos com esse exercício pra ver sua evolução aqui.')}</div>
    `;
  }

  const sessions = data.history
    .filter(h => h.exercises.some(e => e.name===progressExercise))
    .sort((a,b)=> new Date(a.date)-new Date(b.date))
    .map(h => {
      const ex = h.exercises.find(e=>e.name===progressExercise);
      let best = {weight:0,reps:0};
      ex.sets.forEach(s=>{
        if((s.type||'normal')==='warmup') return;
        const w = parseFloat(s.weight)||0;
        if(w > best.weight) best = {weight:w, reps: parseFloat(s.reps)||0};
      });
      return { date: h.date, best };
    });

  const allSets = [];
  data.history.forEach(h=>{
    const ex = h.exercises.find(e=>e.name===progressExercise);
    if(ex) ex.sets.forEach(s => allSets.push(s));
  });
  const nonWarmupSets = allSets.filter(s => (s.type||'normal')!=='warmup');

  const pr = sessions.reduce((m,s)=> Math.max(m,s.best.weight), 0);
  const best1RM = Math.round(nonWarmupSets.reduce((m,s)=>{
    const w = parseFloat(s.weight)||0, r = parseFloat(s.reps)||0;
    return Math.max(m, estimate1RM(w,r));
  },0));
  const last8 = sessions.slice(-8);
  const maxW = Math.max(...last8.map(s=>s.best.weight), 1);

  function bestOfType(t){
    const filtered = allSets.filter(s => (s.type||'normal')===t);
    return filtered.reduce((best,s)=>{
      const w = parseFloat(s.weight)||0;
      return (!best || w>best.weight) ? { weight:w, reps: parseFloat(s.reps)||0 } : best;
    }, null);
  }
  const bestFailure = bestOfType('failure');
  const bestDrop = bestOfType('drop');

  return `
    <div class="section-title">Progresso</div>
    <div class="section-sub">Escolhe um exercício pra ver sua evolução</div>
    ${pillRow}
    <div class="card">
      <div class="stats-row" style="margin-bottom:6px;">
        <div class="stat-box"><div class="stat-num">${pr}kg</div><div class="stat-label">Recorde (PR)</div></div>
        <div class="stat-box"><div class="stat-num stat-num-sm">${best1RM}kg</div><div class="stat-label">1RM estimado</div></div>
        <div class="stat-box"><div class="stat-num">${sessions.length}</div><div class="stat-label">Sessões</div></div>
      </div>
      <div class="bar-chart">
        ${last8.map(s => `
          <div class="bar-col">
            <div class="bar-val">${s.best.weight||'-'}</div>
            <div class="bar" style="height:${Math.max((s.best.weight/maxW)*100,4)}%;"></div>
            <div class="bar-date">${fmtDate(s.date).split(',')[0]}</div>
          </div>
        `).join('')}
      </div>
      ${(bestFailure||bestDrop) ? `
        <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);">
          <label style="margin-top:0;">Recordes por tipo de série</label>
          ${bestFailure ? `<div class="li-sub" style="padding:2px 0;"><b class="set-type-failure">F</b> Falha: <b style="color:var(--text);">${bestFailure.weight}kg</b> × ${bestFailure.reps}</div>` : ''}
          ${bestDrop ? `<div class="li-sub" style="padding:2px 0;"><b class="set-type-drop">D</b> Drop set: <b style="color:var(--text);">${bestDrop.weight}kg</b> × ${bestDrop.reps}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}
function setProgressExercise(n){
  progressExercise = decodeURIComponent(n);
  render();
}
window.setProgressExercise = setProgressExercise;

function achievementsSection(){
  const unlocked = new Set(unlockedAchievements().map(a=>a.id));
  return `
    <div class="card">
      <label style="margin-top:0;">${unlocked.size}/${ACHIEVEMENTS.length} conquistadas</label>
      <div class="achv-grid">
        ${ACHIEVEMENTS.map(a => `
          <div class="achv-card ${unlocked.has(a.id)?'unlocked':''}">
            <div class="achv-emoji">${unlocked.has(a.id) ? a.emoji : '🔒'}</div>
            <div class="achv-title">${a.title}</div>
            <div class="achv-desc">${a.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function bodyweightSection(){
  const sorted = [...data.bodyweight].sort((a,b)=> new Date(a.date)-new Date(b.date));
  const last8 = sorted.slice(-8);
  const maxW = Math.max(...last8.map(b=>parseFloat(b.weight)||0), 1);
  const current = sorted.length ? sorted[sorted.length-1].weight : null;
  return `
    <div class="card" style="margin-bottom:12px;">
      <label style="margin-top:0;">Registrar peso de hoje</label>
      <div style="display:flex; gap:8px;">
        <input id="bwInput" type="number" inputmode="decimal" placeholder="Ex: 62.5" step="0.1">
        <button class="btn btn-primary btn-sm" style="width:auto; white-space:nowrap;" onclick="addBodyweight()">Salvar</button>
      </div>
    </div>
    <div class="card">
      <div class="stats-row" style="margin-bottom:6px;">
        <div class="stat-box"><div class="stat-num">${current!=null? current+'kg' : '-'}</div><div class="stat-label">Atual</div></div>
        <div class="stat-box"><div class="stat-num">${sorted.length}</div><div class="stat-label">Registros</div></div>
      </div>
      ${last8.length ? `
        <div class="bar-chart">
          ${last8.map(b => `
            <div class="bar-col">
              <div class="bar-val">${b.weight}</div>
              <div class="bar" style="height:${Math.max((parseFloat(b.weight)/maxW)*100,4)}%;"></div>
              <div class="bar-date">${fmtDate(b.date).split(',')[0]}</div>
            </div>
          `).join('')}
        </div>
      ` : emptyState('⚖️','Registra seu peso pra acompanhar aqui.')}
    </div>
    ${sorted.length ? `
      <div class="card" style="margin-top:12px;">
        ${[...sorted].reverse().map(b => `
          <div class="list-item">
            <div>
              <div class="li-title">${b.weight}kg</div>
              <div class="li-sub">${fmtDate(b.date)}</div>
            </div>
            <div class="btn-danger-ghost" style="padding:6px 10px; font-size:12px;" onclick="deleteBodyweight('${b.id}')">Excluir</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

function setMeasurementField(f){
  measurementField = f;
  render();
}
window.setMeasurementField = setMeasurementField;

function measurementsSection(){
  const sorted = [...data.measurements].sort((a,b)=> new Date(a.date)-new Date(b.date));
  const fieldsWithData = Object.keys(MEASUREMENT_FIELDS).filter(f => sorted.some(m => m.values && m.values[f]!=null));
  if(!MEASUREMENT_FIELDS[measurementField]) measurementField = 'arm';
  const chartData = sorted.filter(m => m.values && m.values[measurementField]!=null).slice(-8);
  const maxV = Math.max(...chartData.map(m=>parseFloat(m.values[measurementField])||0), 1);
  return `
    <div class="card" style="margin-bottom:12px;">
      <label style="margin-top:0;">Registrar medidas de hoje (cm)</label>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        ${Object.entries(MEASUREMENT_FIELDS).map(([k,label])=>`
          <div>
            <label style="margin:8px 0 4px; font-size:10.5px;">${label}</label>
            <input id="meas_${k}" type="number" inputmode="decimal" placeholder="-">
          </div>
        `).join('')}
      </div>
      <div style="height:10px"></div>
      <button class="btn btn-primary btn-sm" style="width:100%;" onclick="addMeasurement()">Salvar medidas</button>
    </div>
    ${fieldsWithData.length ? `
      <div class="pill-row">
        ${fieldsWithData.map(f=>`<div class="pill ${f===measurementField?'active':''}" onclick="setMeasurementField('${f}')">${MEASUREMENT_FIELDS[f]}</div>`).join('')}
      </div>
      <div class="card">
        <div class="bar-chart">
          ${chartData.map(m => `
            <div class="bar-col">
              <div class="bar-val">${m.values[measurementField]}</div>
              <div class="bar" style="height:${Math.max((parseFloat(m.values[measurementField])/maxV)*100,4)}%;"></div>
              <div class="bar-date">${fmtDate(m.date).split(',')[0]}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `<div class="card">${emptyState('📏','Registra suas medidas pra acompanhar aqui.')}</div>`}
    ${sorted.length ? `
      <div class="card" style="margin-top:12px;">
        ${[...sorted].reverse().map(m => `
          <div class="list-item">
            <div>
              <div class="li-title">${fmtDate(m.date)}</div>
              <div class="li-sub">${Object.entries(MEASUREMENT_FIELDS).filter(([k])=> m.values && m.values[k]!=null).map(([k,label])=>`${label} ${m.values[k]}cm`).join(' · ')}</div>
            </div>
            <div class="btn-danger-ghost" style="padding:6px 10px; font-size:12px;" onclick="deleteMeasurement('${m.id}')">Excluir</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

async function addMeasurement(){
  const values = {};
  Object.keys(MEASUREMENT_FIELDS).forEach(k=>{
    const el = document.getElementById('meas_'+k);
    const v = el ? parseFloat(el.value) : NaN;
    if(!isNaN(v) && v>0) values[k] = v;
  });
  if(Object.keys(values).length===0){ showToast('Preenche pelo menos uma medida'); return; }
  try{
    const created = await api('/api/measurements', { method:'POST', body: JSON.stringify({ date: new Date().toISOString(), values }) });
    data.measurements.push(created);
    render();
    showToast('Medidas registradas! 📏');
  }catch(e){
    showToast('Não consegui salvar no servidor 😕');
  }
}
window.addMeasurement = addMeasurement;

async function deleteMeasurement(id){
  try{
    await api(`/api/measurements/${id}`, { method:'DELETE' });
    data.measurements = data.measurements.filter(m=>m.id!==id);
    render();
    showToast('Registro apagado');
  }catch(e){
    showToast('Não consegui apagar no servidor 😕');
  }
}
window.deleteMeasurement = deleteMeasurement;

// ---------- WARM-UP CALCULATOR ----------
function openWarmupCalc(){
  modal = { type:'warmupCalc', weight: 60 };
  render();
}
window.openWarmupCalc = openWarmupCalc;

function calcWarmup(workWeight){
  const steps = [
    { pct:0.4, reps:10 },
    { pct:0.6, reps:5 },
    { pct:0.8, reps:3 }
  ];
  return steps.map(s => ({ weight: Math.round((workWeight*s.pct)/2.5)*2.5, reps: s.reps }));
}

function recalcWarmup(){
  const weightEl = document.getElementById('warmupWeight');
  const resultEl = document.getElementById('warmupResult');
  if(!weightEl || !resultEl) return;
  const workWeight = parseFloat(weightEl.value)||0;
  modal.weight = workWeight;
  if(workWeight<=0){
    resultEl.innerHTML = `<div class="section-sub" style="margin:0;">Digita o peso que você vai usar na série de trabalho.</div>`;
    return;
  }
  const steps = calcWarmup(workWeight);
  resultEl.innerHTML = `
    <label style="margin-top:0;">Séries de aquecimento sugeridas</label>
    ${steps.map((s,i)=>`
      <div class="li-sub" style="padding:6px 0; font-size:14px;">Série ${i+1}: <b style="color:var(--text);">${s.weight}kg</b> × ${s.reps} reps</div>
    `).join('')}
    <div class="li-sub" style="padding:6px 0; font-size:14px; border-top:1px solid var(--border); margin-top:4px; padding-top:10px;">Série de trabalho: <b style="color:var(--text);">${workWeight}kg</b></div>
  `;
}
window.recalcWarmup = recalcWarmup;

// ---------- BODYWEIGHT ----------
async function addBodyweight(){
  const input = document.getElementById('bwInput');
  const val = parseFloat(input ? input.value : '');
  if(!val || val<=0){ showToast('Digita um peso válido'); return; }
  try{
    const created = await api('/api/bodyweight', { method:'POST', body: JSON.stringify({ weight: val, date: new Date().toISOString() }) });
    data.bodyweight.push(created);
    render();
    showToast('Peso registrado! ⚖️');
  }catch(e){
    showToast('Não consegui salvar no servidor 😕');
  }
}
window.addBodyweight = addBodyweight;

async function deleteBodyweight(id){
  try{
    await api(`/api/bodyweight/${id}`, { method:'DELETE' });
    data.bodyweight = data.bodyweight.filter(b=>b.id!==id);
    render();
    showToast('Registro apagado');
  }catch(e){
    showToast('Não consegui apagar no servidor 😕');
  }
}
window.deleteBodyweight = deleteBodyweight;

// ---------- MODALS ----------
function closeModal(){ modal = null; render(); }
window.closeModal = closeModal;

function renderModal(){
  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.setAttribute('role','presentation');
  div.onclick = (e)=>{ if(e.target===div) closeModal(); };

  let inner = '';
  if(modal.type==='startPicker'){
    inner = `
      <h3>Começar treino</h3>
      <button class="btn btn-secondary" style="margin-bottom:10px;" onclick="startWorkout(null)">🆓 Treino livre</button>
      ${data.routines.length? data.routines.map(r=>`
        <div class="list-item" onclick="startWorkout('${r.id}')">
          <div>
            <div class="li-title">${escapeHtml(r.name)}</div>
            <div class="li-sub">${r.exercises.length} exercícios</div>
          </div>
          <div class="chev">›</div>
        </div>
      `).join('') : `<div style="color:var(--text-muted); font-size:13.5px; padding:8px 0;">Você ainda não tem rotinas salvas.</div>`}
      <div style="height:6px"></div>
      <button class="btn-ghost" onclick="closeModal()" style="width:100%;">Cancelar</button>
    `;
  } else if(modal.type==='routineEdit'){
    inner = `
      <h3>${modal.editId? 'Editar rotina':'Nova rotina'}</h3>
      <label>Nome da rotina</label>
      <input id="routineNameInput" placeholder="Ex: Treino de perna" value="${escapeHtml(modal.name)}">
      <label>Exercícios</label>
      <button class="btn btn-secondary btn-sm" style="width:100%; margin-bottom:8px;" onclick="openExercisePicker('routine')">📚 Escolher da biblioteca</button>
      <div style="display:flex; gap:8px;">
        <input id="newExerciseInput" placeholder="Ex: Agachamento" onkeydown="if(event.key==='Enter'){event.preventDefault();addExerciseToEditor();}">
        <button class="btn btn-primary btn-sm" style="width:auto; white-space:nowrap;" onclick="addExerciseToEditor()">+ Add</button>
      </div>
      <div class="exercise-tag-list">
        ${modal.exercises.map((e,idx)=>`
          <div class="exercise-tag"><span>${escapeHtml(e.name)}</span><span class="remove-x" onclick="removeExerciseFromEditor(${idx})">✕</span></div>
        `).join('')}
      </div>
      <div style="height:16px"></div>
      <button class="btn btn-primary" onclick="saveRoutine()">Salvar rotina</button>
      <div style="height:8px"></div>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Cancelar</button>
    `;
  } else if(modal.type==='routineView'){
    const r = modal.routine;
    inner = `
      <h3>${escapeHtml(r.name)}</h3>
      <div class="card" style="box-shadow:none;">
        ${r.exercises.map(e=>`<div class="list-item"><div style="margin-right:10px">${exercisePhotoMarkup(e.name, 'ex-photo-thumb-sm', false)}</div><div class="li-title">${escapeHtml(e.name)}</div></div>`).join('')}
      </div>
      <div style="height:14px"></div>
      <button class="btn btn-primary" onclick="startWorkout('${r.id}')">Iniciar esse treino</button>
      <div style="height:8px"></div>
      <div class="btn-block-row">
        <button class="btn btn-secondary" onclick="openRoutineEditor(data.routines.find(x=>x.id==='${r.id}'))">Editar</button>
        <button class="btn-danger-ghost" onclick="deleteRoutine('${r.id}')">Excluir</button>
      </div>
    `;
  } else if(modal.type==='historyDetail'){
    const h = modal.workout;
    inner = `
      <h3>${escapeHtml(h.name)}</h3>
      <div class="section-sub" style="margin-top:-10px;">${fmtDate(h.date)}</div>
      ${h.note ? `<div class="section-sub" style="margin-top:-8px;">📝 ${escapeHtml(h.note)}</div>` : ''}
      <div class="stats-row">
        <div class="stat-box"><div class="stat-num stat-num-sm">${fmtDurationShort(h.durationSeconds) || '-'}</div><div class="stat-label">Duração</div></div>
        <div class="stat-box"><div class="stat-num stat-num-sm">${(h.volume!=null? h.volume : workoutVolume(h.exercises)).toLocaleString('pt-BR')}kg</div><div class="stat-label">Volume</div></div>
      </div>
      ${h.exercises.map(e=>`
        <div style="margin-bottom:12px;">
          <div style="font-weight:800; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
            ${escapeHtml(e.name)}${e.supersetGroup? `<span class="superset-chip">🔗 ${e.supersetGroup}</span>`:''}
          </div>
          ${e.note ? `<div class="ex-last-time" style="margin-bottom:4px;">📝 ${escapeHtml(e.note)}</div>` : ''}
          ${e.sets.map((s,i)=>`<div style="font-size:13.5px; color:var(--text-muted); padding:3px 0;">${(s.type&&s.type!=='normal')?`<b class="${setTypeClass(s.type)}">${setTypeLabel(s.type,i)}</b> · `:`Série ${i+1}: `}<b style="color:var(--text);">${s.weight||0}kg</b> × <b style="color:var(--text);">${s.reps||0}</b> reps${s.rpe?` · RPE <b style="color:var(--text);">${s.rpe}</b>`:''}</div>`).join('')}
        </div>
      `).join('')}
      <button class="btn btn-secondary" style="width:100%;" onclick="duplicateAsRoutine('${h.id}')">📋 Salvar como rotina</button>
      <div style="height:8px"></div>
      <button class="btn-danger-ghost" style="width:100%;" onclick="deleteHistoryEntry('${h.id}')">Excluir treino</button>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Fechar</button>
    `;
  } else if(modal.type==='dayList'){
    inner = `
      <h3>${modal.dateLabel}</h3>
      ${modal.entries.map(h=>`
        <div class="list-item" onclick="viewHistoryDetail('${h.id}')">
          <div>
            <div class="li-title">${escapeHtml(h.name)}</div>
            <div class="li-sub">${h.exercises.length} exercícios · ${totalSets(h)} séries</div>
          </div>
          <div class="chev">›</div>
        </div>
      `).join('')}
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Fechar</button>
    `;
  } else if(modal.type==='exercisePicker'){
    if(!modal.group){
      inner = `
        <h3>Escolher exercício</h3>
        <div class="pill-row">
          ${Object.keys(EXERCISE_LIBRARY).map(g=>`<div class="pill" onclick="pickLibraryGroup('${g}')">${g}</div>`).join('')}
        </div>
        <label>Ou digite um nome personalizado</label>
        <div style="display:flex; gap:8px;">
          <input id="customExerciseInput" placeholder="Ex: Remada unilateral" onkeydown="if(event.key==='Enter'){event.preventDefault();pickCustomExercise();}">
          <button class="btn btn-primary btn-sm" style="width:auto; white-space:nowrap;" onclick="pickCustomExercise()">+ Add</button>
        </div>
        <div style="height:8px"></div>
        <button class="btn-ghost" style="width:100%;" onclick="closeExercisePicker()">Cancelar</button>
      `;
    } else {
      const list = EXERCISE_LIBRARY[modal.group] || [];
      inner = `
        <h3>${escapeHtml(modal.group)}</h3>
        <div class="card exercise-library-list" style="box-shadow:none; margin-bottom:10px;">
          ${list.map(n=>{
            const hasPhoto = hasExercisePhoto(n);
            return `
            <div class="list-item">
              <div style="position:relative;">
                ${exercisePhotoMarkup(n, 'ex-photo-thumb-sm', true)}
                ${hasCustomExercisePhoto(n) ? `<button class="photo-remove-btn" type="button" aria-label="Remover foto personalizada de ${escapeHtml(n)}" onclick="event.stopPropagation(); deleteExercisePhoto('${encodeURIComponent(n)}')">✕</button>` : ''}
              </div>
              <div class="li-title" style="flex:1; margin-left:10px;" onclick="pickLibraryExercise('${encodeURIComponent(n)}')">${escapeHtml(n)}</div>
              <div class="chev" onclick="pickLibraryExercise('${encodeURIComponent(n)}')">+</div>
            </div>
          `;}).join('')}
        </div>
        <button class="btn-ghost" style="width:100%;" onclick="backToLibraryGroups()">← Voltar aos grupos</button>
      `;
    }
  } else if(modal.type==='warmupCalc'){
    inner = `
      <h3>🔥 Calculadora de aquecimento</h3>
      <div class="section-sub" style="margin-top:-10px;">Séries antes de chegar no peso de trabalho</div>
      <label>Peso de trabalho (kg)</label>
      <input id="warmupWeight" type="number" inputmode="decimal" value="${modal.weight}" oninput="recalcWarmup()">
      <div id="warmupResult" style="margin-top:14px;"></div>
      <div style="height:6px"></div>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Fechar</button>
    `;
  } else if(modal.type==='spotifySetup'){
    const savedClientId = localStorage.getItem('spotify_client_id') || data.settings.spotifyClientId || '';
    inner = spotifyConnected() ? `
      <h3>🎧 Spotify</h3>
      <div class="section-sub" style="margin-top:-10px;">Conectado à sua conta ✅</div>
      <div class="section-sub" style="margin:0 0 14px;">O mini player aparece automaticamente durante o treino, controlando o que estiver tocando no seu Spotify.</div>
      <button class="btn-danger-ghost" style="width:100%;" onclick="disconnectSpotify()">Desconectar</button>
      <div style="height:8px"></div>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Fechar</button>
    ` : `
      <h3>🎧 Conectar Spotify</h3>
      <div class="section-sub" style="margin-top:-10px;">Precisa de uma conta Spotify Premium</div>
      <div class="section-sub" style="margin:0 0 12px;">
        1. Cria um app grátis em <b style="color:var(--text);">developer.spotify.com/dashboard</b><br>
        2. Nos ajustes do app, adiciona esse Redirect URI: <b style="color:var(--text);">${SPOTIFY_REDIRECT_URI}</b><br>
        3. Cola o Client ID aqui embaixo
      </div>
      <label style="margin-top:0;">Client ID</label>
      <input id="spotifyClientIdInput" placeholder="Client ID do seu app Spotify" value="${escapeHtml(savedClientId)}">
      <div style="height:10px"></div>
      <button class="btn btn-primary" style="width:100%;" onclick="connectSpotify()">Conectar com Spotify</button>
      <div style="height:8px"></div>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Cancelar</button>
    `;
  } else if(modal.type==='spotifySearch'){
    inner = `
      <h3>🔍 Buscar música</h3>
      <div class="section-sub" style="margin-top:-10px;">Adiciona direto na fila do seu Spotify</div>
      <input id="spotifySearchInput" placeholder="Nome da música ou artista" onkeydown="if(event.key==='Enter'){event.preventDefault();spotifySearch();}">
      <div style="height:8px"></div>
      <button class="btn btn-secondary btn-sm" style="width:100%;" onclick="spotifySearch()">Buscar</button>
      <div id="spotifySearchResults" style="margin-top:10px;"></div>
      <div style="height:8px"></div>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Fechar</button>
    `;
  } else if(modal.type==='accessibility'){
    const prefs = getAccessibilityPrefs();
    inner = `
      <h3>♿ Acessibilidade</h3>
      <div class="section-sub" style="margin-top:-8px;">Ajuste a interface para ficar mais confortável no seu celular.</div>
      <div class="a11y-option">
        <div class="a11y-option-copy"><div class="a11y-option-title">Texto maior</div><div class="a11y-option-desc">Aumenta textos, títulos e botões.</div></div>
        <label class="switch" aria-label="Ativar texto maior"><input type="checkbox" ${prefs.largeText?'checked':''} onchange="setAccessibilityPref('largeText',this.checked)"><span class="switch-ui"></span></label>
      </div>
      <div class="a11y-option">
        <div class="a11y-option-copy"><div class="a11y-option-title">Alto contraste</div><div class="a11y-option-desc">Deixa textos e bordas mais fáceis de enxergar.</div></div>
        <label class="switch" aria-label="Ativar alto contraste"><input type="checkbox" ${prefs.highContrast?'checked':''} onchange="setAccessibilityPref('highContrast',this.checked)"><span class="switch-ui"></span></label>
      </div>
      <div class="a11y-option">
        <div class="a11y-option-copy"><div class="a11y-option-title">Reduzir animações</div><div class="a11y-option-desc">Remove movimentos que podem causar desconforto.</div></div>
        <label class="switch" aria-label="Reduzir animações"><input type="checkbox" ${prefs.noMotion?'checked':''} onchange="setAccessibilityPref('noMotion',this.checked)"><span class="switch-ui"></span></label>
      </div>
      <div style="height:14px"></div>
      <button class="btn btn-primary" style="width:100%;" onclick="closeModal()">Concluir</button>
    `;
  } else if(modal.type==='confirmCancel'){
    inner = `
      <h3>Cancelar treino?</h3>
      <div class="section-sub" style="margin-top:-10px;">O que você registrou até agora vai se perder.</div>
      <button class="btn-danger-ghost" style="width:100%; background:var(--danger); color:#fff; border-radius:14px; padding:14px;" onclick="cancelWorkoutConfirmed()">Sim, cancelar treino</button>
      <div style="height:8px"></div>
      <button class="btn-ghost" style="width:100%;" onclick="closeModal()">Voltar ao treino</button>
    `;
  }

  div.innerHTML = `<div class="modal-sheet" role="dialog" aria-modal="true" aria-label="Janela de opções">${inner}</div>`;
  requestAnimationFrame(()=>div.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus());
  document.getElementById('app').appendChild(div);
}

// expose for inline handlers that reference data.routines
window.data = data;
window.openRoutineEditor = openRoutineEditor;
window.viewRoutine = viewRoutine;


// ---------- CLARINHA V5: PREMIUM MOBILE ----------
function themeV5(){return localStorage.getItem('clarinha_theme_v5')||'dark'}
function applyThemeV5(){document.documentElement.classList.toggle('theme-light',themeV5()==='light');const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=themeV5()==='light'?'#FFF8FB':'#E893AC'}
function toggleThemeV5(){localStorage.setItem('clarinha_theme_v5',themeV5()==='light'?'dark':'light');applyThemeV5();showToast(themeV5()==='light'?'Tema claro ativado ☀️':'Tema escuro ativado 🌙')}
window.toggleThemeV5=toggleThemeV5;
function todayWorkoutDoneV5(){return data.history.some(h=>isSameDay(h.date,new Date()))}
function dailyMissionV5(){const done=todayWorkoutDoneV5();if(done)return{icon:'✅',title:'Missão diária concluída',sub:'Você treinou hoje. A Marie está orgulhosa!',pct:100};const w=weeklyCount(),g=weeklyGoal();return{icon:'🎯',title:'Complete um treino hoje',sub:`Progresso semanal: ${w} de ${g} treinos`,pct:Math.min(90,Math.round(w/g*100))}}
function nextRoutineV5(){if(!data.routines.length)return null;return data.routines[data.history.length%data.routines.length]}
function estimatedMinutesV5(r){return r?Math.max(20,r.exercises.length*7):0}
function lastThirtyDaysV5(){const c=new Date();c.setDate(c.getDate()-30);return data.history.filter(h=>new Date(h.date)>=c)}
function premiumMascotTextV5(){if(todayWorkoutDoneV5())return'Treino de hoje concluído. Agora é recuperar, hidratar e aproveitar a vitória.';if(computeStreak()>=7)return`Sua sequência de ${computeStreak()} dias está linda. Vamos proteger esse fogo?`;if(weeklyCount()>=weeklyGoal())return'Meta semanal batida! O treino de hoje é um bônus para a sua evolução.';return'Seu próximo treino já está pronto. Um passo de cada vez — mas o passo é hoje.'}
function bloomHomeScreen(){
 const lvl=levelInfo(totalXP()),pct=Math.min(100,Math.round(lvl.xpInLevel/lvl.xpNeeded*100)),mission=dailyMissionV5(),next=nextRoutineV5(),achievements=ACHIEVEMENTS.slice(0,6),recent=[...data.history].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,2);
 return `
 <section class="v5-hero" aria-labelledby="v5-home-title"><div class="v5-hero-grid"><div><div class="v5-kicker">${greeting()}</div><h1 id="v5-home-title" class="v5-title">${next?escapeHtml(next.name):'Seu treino começa aqui'}</h1><div class="v5-copy">${premiumMascotTextV5()}</div></div><img class="v5-mascot" src="assets/images/mascote-clarinha.svg" alt="Marie, mascote da Clarinha, pronta para treinar"></div><div class="v5-primary-action"><button class="btn btn-primary" onclick="${next?`startWorkout('${next.id}')`:'openStartPicker()'}"><span class="v5-play">▶</span> ${next?`Começar · ${estimatedMinutesV5(next)} min`:'Escolher treino'}</button></div></section>
 <div class="v5-metrics" aria-label="Resumo da sua evolução"><div class="v5-metric"><strong>${computeStreak()}</strong><span>dias de sequência</span></div><div class="v5-metric"><strong>${weeklyCount()}/${weeklyGoal()}</strong><span>meta semanal</span></div><div class="v5-metric"><strong>${lastThirtyDaysV5().length}</strong><span>treinos em 30 dias</span></div></div>
 <section class="card v5-level" aria-label="Nível e experiência"><div class="v5-level-top"><div class="v5-level-badge"><span class="v5-level-icon">⭐</span><span>Nível ${lvl.level}<small style="display:block;color:var(--text-muted);font-weight:700">${totalXP().toLocaleString('pt-BR')} XP total</small></span></div><strong>${lvl.xpInLevel}/${lvl.xpNeeded}</strong></div><div class="v5-progress" aria-label="${pct}% do nível concluído"><i style="width:${pct}%"></i></div></section>
 <div class="v5-section-head"><h2>Missão de hoje</h2><button class="v5-link" onclick="setTab('history')">Ver histórico</button></div><section class="card v5-mission"><div class="v5-mission-icon">${mission.icon}</div><div><div class="v5-mission-title">${mission.title}</div><div class="v5-mission-sub">${mission.sub}</div></div><div class="v5-ring" style="--p:${mission.pct}"><span>${mission.pct}%</span></div></section>
 <div class="v5-section-head"><h2>Acesso rápido</h2></div><div class="v5-actions"><button class="v5-action-card" onclick="openWarmupCalc()"><span class="v5-action-emoji">🔥</span><b>Aquecimento</b><small>Calcule suas séries</small></button><button class="v5-action-card" onclick="openSpotifySetup()"><span class="v5-action-emoji">🎧</span><b>Spotify</b><small>${spotifyConnected()?'Conectado e pronto':'Conectar sua conta'}</small></button><button class="v5-action-card" onclick="setTab('progress')"><span class="v5-action-emoji">📈</span><b>Evolução</b><small>Peso e medidas</small></button><button class="v5-action-card" onclick="openAchievementsV5()"><span class="v5-action-emoji">🏆</span><b>Conquistas</b><small>${unlockedAchievements().length}/${ACHIEVEMENTS.length} liberadas</small></button></div>
 <div class="v5-section-head"><h2>Conquistas</h2><button class="v5-link" onclick="openAchievementsV5()">Ver todas</button></div><div class="v5-achievement-grid">${achievements.map(a=>`<button class="v5-achievement ${a.check()?'':'locked'}" onclick="openAchievementsV5()" aria-label="${escapeHtml(a.title)}: ${a.check()?'desbloqueada':'bloqueada'}"><span class="emoji">${a.emoji}</span><b>${escapeHtml(a.title)}</b></button>`).join('')}</div>
 <div class="v5-section-head"><h2>Atividade recente</h2></div><div class="card">${recent.length?recent.map(h=>`<button class="list-item" style="width:100%;border:0;background:transparent;color:inherit;text-align:left" onclick="viewHistoryDetail('${h.id}')"><div><div class="li-title">${escapeHtml(h.name)}</div><div class="li-sub">${fmtDate(h.date)} · ${fmtDurationShort(h.durationSeconds)||h.exercises.length+' exercícios'}</div></div><div class="chev">›</div></button>`).join(''):emptyState('🌱','Seu primeiro treino vai aparecer aqui.')}</div>`;
}
// ---------- COCO DA MALÁSIA: CAMADA OPCIONAL DE ENGAJAMENTO ----------
const BLOOM_ITEMS = [
  {id:'shoes_white',category:'wardrobe',slot:'shoes',name:'Tênis branco',emoji:'👟',price:0,rarity:'Comum'},
  {id:'shoes_pink',category:'wardrobe',slot:'shoes',name:'Tênis rosa',emoji:'👟',price:260,rarity:'Raro'},
  {id:'shoes_gold',category:'wardrobe',slot:'shoes',name:'Tênis dourado',emoji:'✨',price:950,rarity:'Lendário'},
  {id:'shirt_pink',category:'wardrobe',slot:'top',name:'Camiseta rosa',emoji:'👚',price:180,rarity:'Comum'},
  {id:'top_sport',category:'wardrobe',slot:'top',name:'Top esportivo',emoji:'🎽',price:330,rarity:'Raro'},
  {id:'jacket',category:'wardrobe',slot:'top',name:'Jaqueta Coco',emoji:'🧥',price:550,rarity:'Épico'},
  {id:'legging',category:'wardrobe',slot:'bottom',name:'Legging lilás',emoji:'👖',price:280,rarity:'Raro'},
  {id:'shorts',category:'wardrobe',slot:'bottom',name:'Short de treino',emoji:'🩳',price:190,rarity:'Comum'},
  {id:'hair_bun',category:'wardrobe',slot:'hair',name:'Coque de treino',emoji:'💇‍♀️',price:420,rarity:'Épico'},
  {id:'hair_ponytail',category:'wardrobe',slot:'hair',name:'Rabo de cavalo',emoji:'👱‍♀️',price:300,rarity:'Raro'},
  {id:'bottle',category:'wardrobe',slot:'accessory',name:'Garrafa Coco',emoji:'🧴',price:240,rarity:'Raro'},
  {id:'headband',category:'wardrobe',slot:'accessory',name:'Faixa esportiva',emoji:'🎀',price:320,rarity:'Raro'},
  {id:'watch',category:'wardrobe',slot:'accessory',name:'Relógio fitness',emoji:'⌚',price:470,rarity:'Épico'},
  {id:'crown',category:'wardrobe',slot:'accessory',name:'Coroa da constância',emoji:'👑',price:900,rarity:'Lendário'},
  {id:'plant',category:'house',room:'bedroom',name:'Planta feliz',emoji:'🪴',price:160,rarity:'Comum'},
  {id:'lamp',category:'house',room:'bedroom',name:'Luminária aconchegante',emoji:'💡',price:230,rarity:'Raro'},
  {id:'rug',category:'house',room:'living',name:'Tapete florido',emoji:'🧶',price:310,rarity:'Raro'},
  {id:'sofa',category:'house',room:'living',name:'Sofá confortável',emoji:'🛋️',price:620,rarity:'Épico'},
  {id:'mirror',category:'house',room:'gym',name:'Espelho de academia',emoji:'🪞',price:390,rarity:'Raro'},
  {id:'bike',category:'house',room:'gym',name:'Bicicleta ergométrica',emoji:'🚲',price:800,rarity:'Lendário'},
  {id:'flowers',category:'house',room:'garden',name:'Jardim de flores',emoji:'🌷',price:510,rarity:'Épico'},
  {id:'cat_bed',category:'house',room:'living',name:'Caminha do mascote',emoji:'🧺',price:270,rarity:'Raro'}
];
const COCO_SEASONS = [
  {id:'spring',name:'Primavera',emoji:'🌸',months:[8,9,10],dialogue:'A casa está com cheiro de flores. Bora florescer também?'},
  {id:'summer',name:'Verão',emoji:'☀️',months:[11,0,1],dialogue:'Água por perto e leveza no treino. Hoje está com cara de verão.'},
  {id:'autumn',name:'Outono',emoji:'🍂',months:[2,3,4],dialogue:'Um passo de cada vez, como folhas caindo sem pressa.'},
  {id:'winter',name:'Inverno',emoji:'🧣',months:[5,6,7],dialogue:'Está friozinho. Vamos aquecer com movimento?'}
];
function defaultBloomPrefs(){return{enabled:true,owned:['shoes_white'],equipped:{shoes:'shoes_white'},decor:[],pet:'cat',sounds:true,haptics:true,lastVisit:'',visits:0,claimed:[],hubTab:'marie'}}
function bloomPrefs(){try{return {...defaultBloomPrefs(),...JSON.parse(localStorage.getItem('clarinha_bloom')||'{}')}}catch(e){return defaultBloomPrefs()}}
function saveBloomPrefs(v,rerender=true){localStorage.setItem('clarinha_bloom',JSON.stringify(v));if(rerender)render()}
function bloomEnabled(){return bloomPrefs().enabled!==false}
function currentSeason(){const m=new Date().getMonth();return COCO_SEASONS.find(s=>s.months.includes(m))||COCO_SEASONS[0]}
function bloomCoinsEarned(){return data.history.reduce((sum,h)=>sum+40+Math.min(80,(h.exercises||[]).reduce((n,e)=>n+(e.sets||[]).filter(s=>s.done!==false).length*3,0)),0)+unlockedAchievements().length*35+bloomPrefs().visits*5}
function bloomSpent(){return bloomPrefs().owned.reduce((sum,id)=>sum+(BLOOM_ITEMS.find(i=>i.id===id)?.price||0),0)+bloomPrefs().decor.reduce((sum,id)=>sum+(BLOOM_ITEMS.find(i=>i.id===id)?.price||0),0)}
function bloomBalance(){return Math.max(0,bloomCoinsEarned()-bloomSpent())}
function friendshipPoints(){return data.history.length*12+computeStreak()*4+unlockedAchievements().length*20+bloomPrefs().visits*2}
function friendshipInfo(){const pts=friendshipPoints(),level=Math.max(1,Math.floor(Math.sqrt(pts/30))+1),start=(level-1)*(level-1)*30,next=level*level*30;return{level,pts,inLevel:pts-start,needed:next-start,pct:Math.min(100,Math.round((pts-start)/(next-start)*100))}}
function petInfo(){const pet=bloomPrefs().pet||'cat';return pet==='rabbit'?{emoji:'🐰',name:'Pipoca'}:pet==='hamster'?{emoji:'🐹',name:'Mimo'}:{emoji:'🐱',name:'Coco'}}
function petMood(){if(todayWorkoutDoneV5())return'brincando pela casa';if(computeStreak()>=3)return'animado com a nossa rotina';return'descansando pertinho da Marie'}
function marieMood(){if(todayWorkoutDoneV5())return{emoji:'🥳',name:'Comemorando'};if(computeStreak()>=7)return{emoji:'🤩',name:'Orgulhosa'};if(new Date().getHours()>=22)return{emoji:'😴',name:'Sonolenta'};if(!data.history.length)return{emoji:'😅',name:'Animada para começar'};if(weeklyCount()>=weeklyGoal())return{emoji:'😎',name:'Confiante'};return{emoji:'😊',name:'Feliz'}}
function marieDialogue(){const h=new Date().getHours(),season=currentSeason();if(todayWorkoutDoneV5())return'Nós conseguimos hoje. Agora é recuperar sem culpa.';if(!data.history.length)return'Eu sou a Marie. Vamos construir essa jornada juntas?';if(computeStreak()>=30)return`Trinta dias de consistência. Olha o quanto nós evoluímos.`;if(computeStreak()>=7)return`Olha o que nós construímos: ${computeStreak()} dias de consistência.`;if(weeklyCount()>=weeklyGoal())return'Nossa meta semanal já floresceu. O resto é bônus.';if(h<10)return'Bom dia! Um movimento leve já pode mudar o tom do nosso dia.';if(h>=22)return'Você não precisa provar nada hoje. Se treinar, vamos com calma.';return season.dialogue}
function bloomDailyMissions(){const today=data.history.filter(h=>isSameDay(h.date,new Date())),setsToday=today.reduce((n,h)=>n+(h.exercises||[]).reduce((a,e)=>a+(e.sets||[]).length,0),0);return[
{id:'workout',title:'Movimente-se hoje',desc:'Conclua um treino',done:todayWorkoutDoneV5(),reward:40},
{id:'sets',title:'Pequenos passos',desc:'Complete pelo menos 8 séries hoje',done:setsToday>=8,reward:25},
{id:'week',title:'Florescer na semana',desc:`Faça ${weeklyGoal()} treinos nesta semana`,done:weeklyCount()>=weeklyGoal(),reward:60},
{id:'streak',title:'Ritual de consistência',desc:'Alcance 3 dias de sequência',done:computeStreak()>=3,reward:75}
]}
function classicHomeScreen(){const recent=[...data.history].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3),next=nextRoutineV5();return`<div class="section-title">Painel de treino</div><div class="section-sub">Tudo o que você precisa para treinar e acompanhar sua evolução.</div><section class="card classic-dashboard"><div><b>${greeting()}</b><p>${next?'Seu próximo treino está pronto.':'Crie uma rotina para começar.'}</p></div><button class="btn btn-primary" onclick="${next?`startWorkout('${next.id}')`:'openStartPicker()'}">${next?'Começar '+escapeHtml(next.name):'Escolher treino'}</button></section><div class="v5-section-head"><h2>Atividade recente</h2></div><div class="card">${recent.length?recent.map(h=>`<button class="list-item" style="width:100%;border:0;background:transparent;color:inherit;text-align:left" onclick="viewHistoryDetail('${h.id}')"><div><div class="li-title">${escapeHtml(h.name)}</div><div class="li-sub">${fmtDate(h.date)}</div></div><div class="chev">›</div></button>`).join(''):emptyState('🏋️','Nenhum treino registrado ainda.')}</div>`}
function homeScreen(){return bloomEnabled()?bloomHomeScreen():classicHomeScreen()}
function toggleBloomMode(){const p=bloomPrefs();p.enabled=!p.enabled;saveBloomPrefs(p);showToast(p.enabled?'Modo Coco da Malásia ativado 🥥':'Modo clássico ativado')}
function cocoFeedback(){const p=bloomPrefs();if(p.haptics&&navigator.vibrate)navigator.vibrate(35);if(p.sounds){try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=660;g.gain.setValueAtTime(.06,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);o.start();o.stop(c.currentTime+.16)}catch(e){}}}
function buyBloomItem(id){const item=BLOOM_ITEMS.find(i=>i.id===id),p=bloomPrefs();if(!item)return;const list=item.category==='house'?p.decor:p.owned;if(list.includes(id))return;if(bloomBalance()<item.price){showToast('Moedas Coco insuficientes');return}list.push(id);if(item.category==='wardrobe')p.equipped[item.slot]=id;saveBloomPrefs(p);cocoFeedback();showToast(`${item.name} desbloqueado! ✨`);openBloomHub(item.category==='house'?'house':'shop')}
function equipBloomItem(id){const item=BLOOM_ITEMS.find(i=>i.id===id),p=bloomPrefs();if(!item||!p.owned.includes(id))return;p.equipped[item.slot]=id;saveBloomPrefs(p);cocoFeedback();showToast(`${item.name} equipado`);openBloomHub('wardrobe')}
function choosePet(pet){const p=bloomPrefs();p.pet=pet;saveBloomPrefs(p);cocoFeedback();openBloomHub('marie')}
function toggleCocoSetting(key){const p=bloomPrefs();p[key]=!p[key];saveBloomPrefs(p);openBloomHub('settings')}
function cocoMemories(){const out=[];if(data.history.length)out.push({emoji:'🌱',title:'Nosso primeiro treino',date:fmtDate([...data.history].sort((a,b)=>new Date(a.date)-new Date(b.date))[0].date)});if(data.history.length>=10)out.push({emoji:'💪',title:'10 treinos juntas',date:'Marco de consistência'});if(data.history.length>=50)out.push({emoji:'🌟',title:'50 treinos juntas',date:'Uma jornada de verdade'});if(computeStreak()>=7)out.push({emoji:'🔥',title:'Semana em movimento',date:`Sequência de ${computeStreak()} dias`});unlockedAchievements().slice(0,8).forEach(a=>out.push({emoji:a.emoji,title:a.title,date:'Conquista desbloqueada'}));return out}
function roomMarkup(room){const names={bedroom:'Quarto',living:'Sala',gym:'Academia',garden:'Jardim'},base={bedroom:'🛏️',living:'🏠',gym:'🏋️',garden:'🌿'},items=bloomPrefs().decor.map(id=>BLOOM_ITEMS.find(i=>i.id===id)).filter(i=>i&&i.room===room);return`<article class="coco-room"><div class="room-scene"><span>${base[room]}</span>${items.map(i=>`<span title="${i.name}">${i.emoji}</span>`).join('')}</div><b>${names[room]}</b><small>${items.length?items.map(i=>i.name).join(' · '):'Ainda esperando seu toque pessoal'}</small></article>`}
function registerCocoVisit(){const p=bloomPrefs(),today=new Date().toISOString().slice(0,10);if(p.lastVisit!==today){p.lastVisit=today;p.visits=(p.visits||0)+1;saveBloomPrefs(p,false)}}
function closeBloomHub(){document.getElementById('bloomHub')?.remove()}
function openBloomHub(tab='marie'){registerCocoVisit();closeBloomHub();const p=bloomPrefs(),m=marieMood(),missions=bloomDailyMissions(),friend=friendshipInfo(),pet=petInfo(),season=currentSeason();p.hubTab=tab;saveBloomPrefs(p,false);const tabs=[['marie','Marie'],['missions','Missões'],['wardrobe','Closet'],['shop','Loja'],['house','Casa'],['album','Álbum'],['settings','Ajustes']];let content='';
if(tab==='marie')content=`<section class="marie-profile coco-main"><img src="assets/images/mascote-clarinha.svg" alt="Marie"><div><span class="mood">${m.emoji} ${m.name} · ${season.emoji} ${season.name}</span><h3>Marie</h3><p>${marieDialogue()}</p><div class="marie-equipped">${Object.values(p.equipped).map(id=>BLOOM_ITEMS.find(i=>i.id===id)?.emoji||'').join(' ')||'🌸'} <span title="Mascote">${pet.emoji}</span></div></div></section><section class="coco-friend"><div><b>Amizade com Marie · nível ${friend.level}</b><small>${friend.pts} pontos de vínculo</small></div><span>${friend.pct}%</span><i><em style="width:${friend.pct}%"></em></i></section><section class="pet-card"><span>${pet.emoji}</span><div><b>${pet.name}</b><small>Está ${petMood()}.</small></div></section><div class="pet-picker"><button onclick="choosePet('cat')">🐱 Coco</button><button onclick="choosePet('rabbit')">🐰 Pipoca</button><button onclick="choosePet('hamster')">🐹 Mimo</button></div>`;
if(tab==='missions')content=`<div class="bloom-wallet"><span>🪙 Moedas Coco</span><strong>${bloomBalance().toLocaleString('pt-BR')}</strong></div><div class="bloom-missions">${missions.map(x=>`<div class="bloom-mission ${x.done?'done':''}"><span>${x.done?'✅':'🎯'}</span><div><b>${x.title}</b><small>${x.desc}</small></div><em>+${x.reward}</em></div>`).join('')}</div><section class="season-card"><span>${season.emoji}</span><div><b>Temporada ${season.name}</b><small>${season.dialogue}</small></div></section>`;
if(tab==='wardrobe')content=`<section class="coco-preview"><img src="assets/images/mascote-clarinha.svg" alt="Marie com itens equipados"><div>${Object.values(p.equipped).map(id=>`<span>${BLOOM_ITEMS.find(i=>i.id===id)?.emoji||''}</span>`).join('')}</div></section><div class="bloom-shop">${BLOOM_ITEMS.filter(i=>i.category==='wardrobe'&&p.owned.includes(i.id)).map(i=>{const eq=p.equipped[i.slot]===i.id;return`<article class="shop-item owned"><span class="shop-emoji">${i.emoji}</span><div><b>${i.name}</b><small>${i.rarity} · ${i.slot}</small></div><button onclick="equipBloomItem('${i.id}')">${eq?'Equipado':'Equipar'}</button></article>`}).join('')||emptyState('👗','Sua coleção começa com o primeiro item.')}</div>`;
if(tab==='shop')content=`<div class="bloom-wallet"><span>🪙 Moedas Coco</span><strong>${bloomBalance().toLocaleString('pt-BR')}</strong></div><div class="bloom-shop">${BLOOM_ITEMS.filter(i=>i.category==='wardrobe').map(i=>{const owned=p.owned.includes(i.id),eq=p.equipped[i.slot]===i.id;return`<article class="shop-item ${owned?'owned':''}"><span class="shop-emoji">${i.emoji}</span><div><b>${i.name}</b><small>${i.rarity}</small></div><button onclick="${owned?`equipBloomItem('${i.id}')`:`buyBloomItem('${i.id}')`}">${eq?'Equipado':owned?'Equipar':i.price+' 🪙'}</button></article>`}).join('')}</div>`;
if(tab==='house')content=`<div class="coco-rooms">${['bedroom','living','gym','garden'].map(roomMarkup).join('')}</div><h3>Decoração</h3><div class="bloom-shop">${BLOOM_ITEMS.filter(i=>i.category==='house').map(i=>{const owned=p.decor.includes(i.id);return`<article class="shop-item ${owned?'owned':''}"><span class="shop-emoji">${i.emoji}</span><div><b>${i.name}</b><small>${i.rarity} · ${i.room}</small></div><button ${owned?'disabled':''} onclick="buyBloomItem('${i.id}')">${owned?'Na casa':i.price+' 🪙'}</button></article>`}).join('')}</div>`;
if(tab==='album'){const memories=cocoMemories();content=`<div class="coco-album">${memories.length?memories.map(x=>`<article><span>${x.emoji}</span><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.date)}</small></article>`).join(''):emptyState('📖','Nossa primeira memória aparecerá depois do primeiro treino.')}</div>`}
if(tab==='settings')content=`<div class="bloom-mode-row"><div><b>Modo ${p.enabled?'Coco da Malásia':'Clássico'}</b><small>${p.enabled?'Marie e recompensas ativas':'Experiência direta de treino'}</small></div><button class="switch ${p.enabled?'on':''}" onclick="toggleBloomMode();closeBloomHub()"><i></i></button></div><div class="setting-line"><div><b>Sons delicados</b><small>Confirmações curtas ao desbloquear itens</small></div><button class="switch ${p.sounds?'on':''}" onclick="toggleCocoSetting('sounds')"><i></i></button></div><div class="setting-line"><div><b>Vibração tátil</b><small>Feedback em celulares compatíveis</small></div><button class="switch ${p.haptics?'on':''}" onclick="toggleCocoSetting('haptics')"><i></i></button></div><p class="bloom-note">A camada Coco da Malásia é opcional. Treinos, histórico, progresso e dados continuam funcionando normalmente no modo clássico.</p>`;
const w=document.createElement('div');w.id='bloomHub';w.className='v5-dialog-wrap';w.onclick=e=>{if(e.target===w)closeBloomHub()};w.innerHTML=`<section class="v5-dialog bloom-dialog" role="dialog" aria-modal="true" aria-labelledby="bloom-title"><div class="v5-dialog-head"><div><h2 id="bloom-title">Coco da Malásia 🥥</h2><div class="section-sub" style="margin:4px 0 0">O universo pessoal da Marie dentro da Clarinha Personal</div></div><button class="icon-btn" onclick="closeBloomHub()" aria-label="Fechar">✕</button></div><nav class="coco-tabs" aria-label="Áreas do modo Coco da Malásia">${tabs.map(([id,label])=>`<button class="${tab===id?'active':''}" onclick="openBloomHub('${id}')">${label}</button>`).join('')}</nav>${content}</section>`;document.body.appendChild(w);requestAnimationFrame(()=>w.querySelector('button')?.focus())}
window.openBloomHub=openBloomHub;window.closeBloomHub=closeBloomHub;window.toggleBloomMode=toggleBloomMode;window.buyBloomItem=buyBloomItem;window.equipBloomItem=equipBloomItem;window.choosePet=choosePet;window.toggleCocoSetting=toggleCocoSetting;

function closeV5Dialog(){document.getElementById('v5Dialog')?.remove()}
function openAchievementsV5(){closeV5Dialog();const w=document.createElement('div');w.id='v5Dialog';w.className='v5-dialog-wrap';w.onclick=e=>{if(e.target===w)closeV5Dialog()};w.innerHTML=`<section class="v5-dialog" role="dialog" aria-modal="true" aria-labelledby="v5-ach-title"><div class="v5-dialog-head"><div><h2 id="v5-ach-title">Suas conquistas</h2><div class="section-sub" style="margin:4px 0 0">${unlockedAchievements().length} de ${ACHIEVEMENTS.length} desbloqueadas</div></div><button class="icon-btn" onclick="closeV5Dialog()" aria-label="Fechar">✕</button></div><div class="v5-achievement-list">${ACHIEVEMENTS.map(a=>`<div class="v5-achievement-row ${a.check()?'':'locked'}"><span class="emoji">${a.emoji}</span><div><b>${escapeHtml(a.title)}</b><div class="li-sub">${escapeHtml(a.desc)}</div></div><span>${a.check()?'✅':'🔒'}</span></div>`).join('')}</div></section>`;document.body.appendChild(w);requestAnimationFrame(()=>w.querySelector('button')?.focus())}
window.openAchievementsV5=openAchievementsV5;window.closeV5Dialog=closeV5Dialog;applyThemeV5();

// ---------- INIT ----------
(async function init(){
  setupGlobalAccessibility();
  await loadData();
  window.data = data;
  await handleSpotifyRedirect();
  render();
})();
