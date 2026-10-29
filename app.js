const DEMO_TYPES = [
  { id: 'type-1', name: '主日講道' },
  { id: 'type-2', name: '查經分享' },
  { id: 'type-3', name: '信仰見證' }
];

const DEMO_MEDIA = [
  { id: 'demo-1', title: '在盼望中持守信仰', url: 'https://www.youtube.com/results?search_query=在盼望中持守信仰', type: '主日講道', description: '從聖經的信息重新看見盼望，學習在日常生活裡持守所信的道路。', createdAt: '2026-10-24', createdBy: '示範資料' },
  { id: 'demo-2', title: '約翰福音：光照在黑暗裡', url: 'https://www.youtube.com/results?search_query=約翰福音+光照在黑暗裡', type: '查經分享', description: '一起讀約翰福音開頭的經文，思想光、生命與真理之間的關係。', createdAt: '2026-10-20', createdBy: '示範資料' },
  { id: 'demo-3', title: '一段重新學會禱告的見證', url: 'https://www.youtube.com/results?search_query=重新學會禱告+信仰見證', type: '信仰見證', description: '在看似安靜的時候，如何重新回到禱告與信靠的起點。', createdAt: '2026-10-16', createdBy: '示範資料' },
  { id: 'demo-4', title: '聽見真理，也活出真理', url: 'https://www.youtube.com/results?search_query=聽見真理+活出真理+講道', type: '主日講道', description: '真理不只停留在理解，也邀請我們用選擇與行動回應。', createdAt: '2026-10-09', createdBy: '示範資料' }
];

const CONFIG_KEY = 'bible-truth-config';
const LEGACY_APPS_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycby7SL4pFi-SSnR2_i58V9tfBI6T1_K4bGIzpAq457UdbL_wu4cBjzqFs4LMzh-TUkmRyg/exec',
  'https://script.google.com/macros/s/AKfycbwb-JHphis9OXKiSVzK-Eo7wsveS0ZiOfsHF0Y6uP-RYtGyyEquEJm_4UzI2ED0YMIO2Q/exec'
];
const DEFAULT_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbywV6iqZ3yV5qlmpejFtsy6QmhdABj4yqLIqIf4LQyI-6knsrmPjOa5wNJYbf1Zg7Th0A/exec',
  googleClientId: '736171088462-ias9uqmm9j7crschd80ddj0je2mf8a2k.apps.googleusercontent.com'
};
// This separate public endpoint stores only YouTube share-target records.
const YOUTUBE_SHARE_API_URL = 'https://script.google.com/macros/s/AKfycbywcOy4bzGTVUpCd6pJi92rwbAHz5Sy5uHYfy9-p9QP23nfL-FaWTt5Fbns4iT2Gde4/exec';
const state = {
  media: [...DEMO_MEDIA],
  types: [...DEMO_TYPES],
  youtubeShareRecords: [],
  filteredMedia: [],
  config: loadConfig(),
  isLive: false,
  isAdmin: false,
  user: null,
  credential: null,
  modal: null,
  editingMediaId: null,
  editingTypeId: null,
  search: '',
  type: 'all',
  toastTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    if (LEGACY_APPS_SCRIPT_URLS.includes(saved.appsScriptUrl)) saved.appsScriptUrl = DEFAULT_CONFIG.appsScriptUrl;
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    appsScriptUrl: (state.config.appsScriptUrl || '').trim(),
    googleClientId: (state.config.googleClientId || '').trim()
  }));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatDate(value) {
  if (!value) return '尚未標記日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function timestampValue(value) {
  const raw = String(value || '').trim();
  const timestamp = Date.parse(raw.includes('T') ? raw : raw.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T'));
  if (Number.isFinite(timestamp)) return timestamp;
  const dateOnly = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return dateOnly ? Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : 0;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function setConnectionState(live) {
  const el = $('#connectionState');
  el.classList.toggle('connected', live);
  el.innerHTML = `<span class="status-dot"></span>${live ? '已連線 Google 試算表' : '示範資料'}`;
  $('#demoNotice').hidden = live;
}

function renderTypeOptions() {
  const options = [`<option value="all">全部類型</option>`, ...state.types.map((type) => `<option value="${escapeHtml(type.name)}">${escapeHtml(type.name)}</option>`)];
  const filter = $('#typeFilter');
  filter.innerHTML = options.join('');
  filter.value = state.types.some((type) => type.name === state.type) ? state.type : 'all';
  const mediaType = $('#mediaTypeInput');
  mediaType.innerHTML = state.types.length ? state.types.map((type) => `<option value="${escapeHtml(type.name)}">${escapeHtml(type.name)}</option>`).join('') : '<option value="">請先新增影音類型</option>';
  renderTypeManagement();
}

function renderTypeManagement() {
  const list = $('#typeList');
  if (!list) return;
  list.innerHTML = state.types.length ? state.types.map((type) => `<div class="type-row"><span>${escapeHtml(type.name)}</span><span class="type-row-actions"><button class="type-edit" type="button" data-edit-type="${escapeHtml(type.id)}" aria-label="修改影音類型：${escapeHtml(type.name)}">修改</button><button class="type-delete" type="button" data-delete-type="${escapeHtml(type.id)}" aria-label="刪除影音類型：${escapeHtml(type.name)}">刪除</button></span></div>`).join('') : '<p class="helper-text">目前沒有影音類型。</p>';
}

function renderMedia() {
  const query = state.search.trim().toLowerCase();
  state.filteredMedia = state.media.filter((item) => {
    const inType = state.type === 'all' || item.type === state.type;
    const haystack = `${item.title} ${item.description} ${item.type}`.toLowerCase();
    return inType && (!query || haystack.includes(query));
  }).sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
  $('#collectionCount').textContent = `${state.filteredMedia.length} 部影音`;
  const grid = $('#mediaGrid');
  if (!state.filteredMedia.length) {
    grid.innerHTML = `<div class="empty-state"><strong>還沒有符合條件的影音</strong><span>${state.media.length ? '換個搜尋字詞或清除影音類型篩選。' : '管理者登入後，可以把第一段影音收進來。'}</span></div>`;
    return;
  }
  grid.innerHTML = state.filteredMedia.map((item) => {
    const videoUrl = isHttpsUrl(item.url) ? escapeHtml(item.url) : '';
    const link = videoUrl ? `<a class="watch-link" href="${videoUrl}" target="_blank" rel="noopener noreferrer">開啟影音</a>` : '';
    const thumbnail = item.thumbnail || getYouTubeThumbnail(item.url);
    const thumbnailImage = `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(item.title)} 的縮圖" loading="lazy" onerror="this.closest('.media-thumb').hidden=true" />`;
    const thumbnailMarkup = thumbnail ? (videoUrl
      ? `<a class="media-thumb media-thumb-link" href="${videoUrl}" target="_blank" rel="noopener noreferrer" aria-label="開啟影音：${escapeHtml(item.title)}">${thumbnailImage}</a>`
      : `<div class="media-thumb">${thumbnailImage}</div>`) : '';
    const adminButtons = state.isAdmin ? `<button class="card-edit" type="button" data-edit-media="${escapeHtml(item.id)}" aria-label="修改影音：${escapeHtml(item.title)}">修改</button><button class="card-delete" type="button" data-delete-media="${escapeHtml(item.id)}" aria-label="刪除收藏：${escapeHtml(item.title)}">刪除</button>` : '';
    return `<article class="media-card">
      ${thumbnailMarkup}
      <div class="card-topline"><span class="type-tag">${escapeHtml(item.type || '未分類')}</span><span class="card-date">${formatDate(item.createdAt)}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || '這段影音尚未加上說明。')}</p>
      <div class="card-footer"><span class="card-source">${escapeHtml(item.createdBy || (state.isLive ? 'Google 試算表' : '示範資料'))}</span><div class="card-actions">${adminButtons}${link}</div></div>
    </article>`;
  }).join('');
}

function renderAdminState() {
  $$('.admin-only').forEach((element) => { element.hidden = !state.isAdmin; });
  $('#loginButton').hidden = state.isAdmin;
  $('#adminActions').hidden = !state.isAdmin;
  $('#adminName').textContent = state.user?.displayName || state.user?.email || '管理者';
}

function render() {
  renderTypeOptions();
  renderMedia();
  renderAdminState();
  setConnectionState(state.isLive);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function openModal(name) {
  state.modal = name;
  $('#modalBackdrop').hidden = false;
  $$('.modal').forEach((modal) => { modal.hidden = modal.id !== `${name}Modal`; });
  if (name === 'login') {
    $('#appsScriptUrlInput').value = state.config.appsScriptUrl || '';
    $('#googleClientIdInput').value = state.config.googleClientId || '';
    $('#loginMessage').textContent = state.config.appsScriptUrl && state.config.googleClientId ? '已設定連線，請使用 Google 帳號登入。' : '請先填入連線設定，或使用下方示範管理者模式預覽。';
    renderGoogleButton();
  }
}

function closeModal() {
  state.modal = null;
  $('#modalBackdrop').hidden = true;
  $$('.modal').forEach((modal) => { modal.hidden = true; });
}

function updateLoginMessage(message, tone = 'error') {
  const node = $('#loginMessage');
  node.textContent = message;
  node.style.color = tone === 'success' ? 'var(--sage-deep)' : 'var(--coral)';
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (document.querySelector('script[data-google-identity]')) return new Promise((resolve) => { document.querySelector('script[data-google-identity]').addEventListener('load', resolve, { once: true }); });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function renderGoogleButton() {
  const target = $('#googleSignInButton');
  target.innerHTML = '';
  if (!state.config.googleClientId) {
    target.innerHTML = '<p class="helper-text">尚未設定 Google OAuth Client ID，完成上方設定後即可顯示 Google 登入按鈕。</p>';
    return;
  }
  loadGoogleScript().then(() => {
    if (!window.google?.accounts?.id) throw new Error('Google 登入元件尚未就緒。');
    window.google.accounts.id.initialize({ client_id: state.config.googleClientId, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: true });
    window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 340, logo_alignment: 'left' });
  }).catch(() => {
    target.innerHTML = '<p class="helper-text">Google 登入元件載入失敗，請確認網路連線與 Client ID。</p>';
  });
}

window.handleGoogleCredential = async function handleGoogleCredential(response) {
  state.credential = response.credential;
  if (!state.config.appsScriptUrl) {
    updateLoginMessage('請先填入 Apps Script Web App URL。');
    return;
  }
  updateLoginMessage('正在向 Google 試算表確認管理者權限…', 'success');
  try {
    const result = await submitAndWait({ action: 'auth', credential: state.credential });
    if (!result?.ok || !result.result?.ok) throw new Error(result?.result?.error || result?.error || '登入驗證失敗。');
    state.user = result.result;
    state.isAdmin = Boolean(result.result.isAdmin);
    if (!state.isAdmin) {
      updateLoginMessage(`帳號 ${result.result.email || ''} 尚未被加入管理者名單。`);
      state.credential = null;
      return;
    }
    closeModal();
    render();
    showToast(`已登入：${state.user.displayName || state.user.email}`);
  } catch (error) {
    updateLoginMessage(error.message || '登入驗證失敗。');
    state.credential = null;
  }
};

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `__bibleTruth_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const query = new URLSearchParams({ ...params, callback: callbackName });
    const timer = setTimeout(() => { cleanup(); reject(new Error('連線逾時，請檢查 Apps Script 網址。')); }, 10000);
    const cleanup = () => { clearTimeout(timer); delete window[callbackName]; script.remove(); };
    window[callbackName] = (payload) => { cleanup(); resolve(payload); };
    script.src = `${state.config.appsScriptUrl.replace(/\/$/, '')}?${query.toString()}`;
    script.onerror = () => { cleanup(); reject(new Error('無法讀取 Google 試算表。')); };
    document.body.appendChild(script);
  });
}

function jsonpAt(endpoint, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `__youtubeShare_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const query = new URLSearchParams({ ...params, callback: callbackName });
    const timer = setTimeout(() => { cleanup(); reject(new Error('YouTube 收藏清單連線逾時。')); }, 10000);
    const cleanup = () => { clearTimeout(timer); delete window[callbackName]; script.remove(); };
    window[callbackName] = (payload) => { cleanup(); resolve(payload); };
    script.src = `${endpoint.replace(/\/$/, '')}?${query.toString()}`;
    script.onerror = () => { cleanup(); reject(new Error('無法讀取 YouTube 收藏清單。')); };
    document.body.appendChild(script);
  });
}

async function submitAndWait(payload, allowEndpointRecovery = true) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const body = { ...payload, requestId };
  await fetch(state.config.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const receipt = await jsonp({ action: 'status', requestId });
    if (receipt?.result?.error === '不支援的寫入操作' && allowEndpointRecovery && state.config.appsScriptUrl !== DEFAULT_CONFIG.appsScriptUrl) {
      state.config.appsScriptUrl = DEFAULT_CONFIG.appsScriptUrl;
      saveConfig();
      showToast('已切換到最新 Apps Script，正在重試…');
      return submitAndWait(payload, false);
    }
    if (receipt?.result?.ok === false || receipt?.result?.code) return receipt;
    if (receipt?.result || receipt?.ok === false) return receipt;
  }
  throw new Error('Google 試算表尚未回覆，請稍後重新整理確認。');
}

async function loadLiveData() {
  if (!state.config.appsScriptUrl) return;
  try {
    const result = await jsonp({ action: 'list' });
    if (!result?.ok) throw new Error(result?.error || '資料讀取失敗。');
    state.media = Array.isArray(result.media) ? result.media : [];
    state.types = Array.isArray(result.types) && result.types.length ? result.types : [...DEMO_TYPES];
    state.isLive = true;
    render();
  } catch (error) {
    state.isLive = false;
    render();
    showToast(error.message || '目前先使用示範資料。');
  }
}

function renderYoutubeShareRecords() {
  const grid = $('#youtubeShareGrid');
  if (!grid) return;
  const records = state.youtubeShareRecords;
  $('#youtubeShareCount').textContent = `${records.length} 部影片`;

  if (!records.length) {
    grid.innerHTML = '<div class="empty-state"><strong>還沒有 YouTube 分享收藏</strong><span>在 YouTube 點選「分享」，再選擇「聖經真理」即可加入影片。</span></div>';
    return;
  }

  grid.innerHTML = records.map((record) => {
    const safeUrl = isHttpsUrl(record.url) ? escapeHtml(record.url) : '';
    const title = escapeHtml(record.title || `YouTube 影片 ${record.videoId || ''}`);
    const description = escapeHtml(record.shareText || record.note || '從 YouTube 分享加入的影片。');
    const category = escapeHtml(record.category || 'YouTube 分享');
    const thumbnail = isHttpsUrl(record.thumbnailUrl) ? record.thumbnailUrl : getYouTubeThumbnail(record.url);
    const imageMarkup = thumbnail && safeUrl
      ? `<a class="media-thumb media-thumb-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="開啟影音：${title}"><img src="${escapeHtml(thumbnail)}" alt="${title} 的縮圖" loading="lazy" onerror="this.closest('.media-thumb').hidden=true" /></a>`
      : '';
    const link = safeUrl ? `<a class="watch-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">開啟影音</a>` : '';

    return `<article class="media-card">
      ${imageMarkup}
      <div class="card-topline"><span class="type-tag">${category}</span><span class="card-date">${formatDate(record.date)}</span></div>
      <h3>${title}</h3>
      <p>${description}</p>
      <div class="card-footer"><span class="card-source">YouTube 分享</span><div class="card-actions">${link}</div></div>
    </article>`;
  }).join('');
}

async function loadYoutubeShareCollection() {
  const grid = $('#youtubeShareGrid');
  if (!grid) return;
  $('#youtubeShareCount').textContent = '載入中…';
  grid.innerHTML = '<div class="empty-state"><strong>正在讀取 YouTube 收藏</strong><span>請稍候。</span></div>';
  try {
    const result = await jsonpAt(YOUTUBE_SHARE_API_URL, { action: 'list' });
    if (!result?.ok) throw new Error(result?.error || '讀取失敗');
    state.youtubeShareRecords = Array.isArray(result.records) ? result.records : [];
    renderYoutubeShareRecords();
  } catch (error) {
    $('#youtubeShareCount').textContent = '暫時無法載入';
    grid.innerHTML = `<div class="empty-state"><strong>分享收藏清單暫時無法讀取</strong><span>${escapeHtml(error.message || '請稍後再試。')}</span></div>`;
  }
}

async function saveConnectionSettings() {
  state.config.appsScriptUrl = $('#appsScriptUrlInput').value.trim();
  state.config.googleClientId = $('#googleClientIdInput').value.trim();
  saveConfig();
  if (state.config.appsScriptUrl && !state.config.appsScriptUrl.endsWith('/exec')) {
    updateLoginMessage('請使用以 /exec 結尾的正式 Apps Script Web App 網址。');
    return;
  }
  closeModal();
  if (state.config.appsScriptUrl) {
    showToast('正在讀取 Google 試算表…');
    await loadLiveData();
  } else {
    state.isLive = false;
    render();
  }
}

function enterDemoAdmin() {
  state.isLive = false;
  state.isAdmin = true;
  state.user = { displayName: '示範管理者', email: 'demo@local.preview' };
  state.credential = 'demo-credential';
  closeModal();
  render();
  showToast('已進入示範管理者模式；正式環境請使用 Google 登入。');
}

function logout() {
  state.isAdmin = false;
  state.user = null;
  state.credential = null;
  render();
  showToast('已登出管理者模式。');
}

function openMediaModal() {
  if (!state.isAdmin) return;
  renderTypeOptions();
  if (!state.types.length) {
    showToast('請先新增至少一個影音類型。');
    openModal('type');
    return;
  }
  state.editingMediaId = null;
  $('#mediaForm').reset();
  titleLookupRequest += 1;
  $('#mediaUrlStatus').textContent = '';
  $('#mediaThumbnailStatus').textContent = '';
  $('#mediaDescriptionStatus').textContent = '';
  $('#mediaForm [name="title"]').dataset.manual = 'false';
  $('#mediaForm [name="description"]').dataset.manual = 'false';
  $('#mediaTitle').textContent = '新增影音';
  $('#mediaSubmitButton').textContent = '儲存影音';
  openModal('media');
}

function openEditMediaModal(mediaId) {
  if (!state.isAdmin) return;
  const item = state.media.find((media) => String(media.id) === String(mediaId));
  if (!item) return;
  state.editingMediaId = item.id;
  renderTypeOptions();
  const form = $('#mediaForm');
  form.reset();
  form.elements.url.value = item.url || '';
  form.elements.title.value = item.title || '';
  form.elements.thumbnail.value = item.thumbnail || getYouTubeThumbnail(item.url);
  form.elements.type.value = item.type || '';
  form.elements.description.value = item.description || '';
  form.elements.title.dataset.manual = 'true';
  form.elements.description.dataset.manual = 'true';
  $('#mediaUrlStatus').textContent = '';
  $('#mediaThumbnailStatus').textContent = '';
  $('#mediaDescriptionStatus').textContent = '';
  $('#mediaTitle').textContent = '修改影音';
  $('#mediaSubmitButton').textContent = '更新影音';
  openModal('media');
}

function getYouTubeUrl(value) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtu.be') return `https://www.youtube.com/watch?v=${url.pathname.slice(1)}`;
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const videoId = url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
  } catch {
    return '';
  }
  return '';
}

function getYouTubeThumbnail(value) {
  const youtubeUrl = getYouTubeUrl(value);
  if (!youtubeUrl) return '';
  try {
    const videoId = new URL(youtubeUrl).searchParams.get('v');
    return videoId ? `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : '';
  } catch {
    return '';
  }
}

function updateVideoThumbnail() {
  const form = $('#mediaForm');
  const thumbnailInput = form.elements.thumbnail;
  const status = $('#mediaThumbnailStatus');
  const thumbnail = getYouTubeThumbnail(form.elements.url.value);
  thumbnailInput.value = thumbnail;
  status.textContent = thumbnail ? '已自動帶入 YouTube 影片縮圖網址。' : (form.elements.url.value.trim() ? '目前只會自動產生 YouTube 縮圖網址。' : '');
}

async function lookupVideoDescription() {
  const form = $('#mediaForm');
  const youtubeUrl = getYouTubeUrl(form.elements.url.value);
  const descriptionInput = form.elements.description;
  const status = $('#mediaDescriptionStatus');
  if (!youtubeUrl) {
    status.textContent = form.elements.url.value.trim() ? '目前只會自動讀取 YouTube 影片說明，其他影音可手動輸入。' : '';
    return;
  }
  if (!state.config.appsScriptUrl) {
    status.textContent = '尚未設定 Apps Script，請手動輸入影片說明。';
    return;
  }
  const request = ++descriptionLookupRequest;
  status.textContent = '正在讀取 YouTube 影片說明…';
  try {
    const result = await jsonp({ action: 'videoInfo', url: youtubeUrl });
    if (request !== descriptionLookupRequest) return;
    if (!result?.ok) throw new Error(result?.error || '找不到影片說明。');
    const description = String(result.description || '').trim();
    if (description && descriptionInput.dataset.manual !== 'true') {
      descriptionInput.dataset.filling = 'true';
      descriptionInput.value = description.slice(0, 300);
      descriptionInput.dataset.filling = 'false';
    }
    status.textContent = description ? '已自動帶入影片說明前 300 字，可再自行修改。' : '這部影片沒有公開說明，請手動輸入。';
  } catch (error) {
    if (request === descriptionLookupRequest) status.textContent = error.message || '無法取得影片說明，請手動輸入。';
  }
}

let titleLookupTimer;
let descriptionLookupTimer;
let titleLookupRequest = 0;
let descriptionLookupRequest = 0;

async function lookupVideoTitle() {
  const form = $('#mediaForm');
  const urlInput = form.elements.url;
  const titleInput = form.elements.title;
  const status = $('#mediaUrlStatus');
  const youtubeUrl = getYouTubeUrl(urlInput.value);
  if (!youtubeUrl) {
    status.textContent = urlInput.value.trim() ? '目前只會自動讀取 YouTube 影片標題，其他影音可手動輸入。' : '';
    return;
  }
  const request = ++titleLookupRequest;
  status.textContent = '正在讀取影片標題…';
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
    if (!response.ok) throw new Error('title lookup failed');
    const data = await response.json();
    if (request !== titleLookupRequest) return;
    if (!titleInput.value.trim() || titleInput.dataset.manual !== 'true') {
      titleInput.dataset.filling = 'true';
      titleInput.value = data.title || '';
      titleInput.dataset.filling = 'false';
    }
    status.textContent = data.title ? '已自動帶入 YouTube 影片標題，可再自行修改。' : '找不到影片標題，請手動輸入。';
  } catch {
    if (request === titleLookupRequest) status.textContent = '無法自動取得影片標題，請手動輸入。';
  }
}

function scheduleVideoTitleLookup() {
  clearTimeout(titleLookupTimer);
  titleLookupTimer = setTimeout(lookupVideoTitle, 450);
}

async function handleMediaSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const record = Object.fromEntries(form.entries());
  if (!isHttpsUrl(record.url)) { showToast('影音網址必須使用 https://。'); return; }
  if (!state.isLive) {
    if (state.editingMediaId) {
      state.media = state.media.map((item) => String(item.id) === String(state.editingMediaId) ? { ...item, ...record } : item);
    } else {
      state.media.unshift({ ...record, id: `local-${Date.now()}`, createdAt: new Date().toISOString(), createdBy: state.user?.displayName || '示範管理者' });
    }
    closeModal();
    render();
    showToast(state.editingMediaId ? '示範影音已更新。' : '已加入示範清單。');
    state.editingMediaId = null;
    return;
  }
  try {
    const action = state.editingMediaId ? 'updateMedia' : 'addMedia';
    const payload = state.editingMediaId ? { action, credential: state.credential, mediaId: state.editingMediaId, record } : { action, credential: state.credential, record };
    const receipt = await submitAndWait(payload);
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || (state.editingMediaId ? '影音更新失敗。' : '影音儲存失敗。'));
    closeModal();
    state.editingMediaId = null;
    await loadLiveData();
    showToast(action === 'updateMedia' ? '影音內容已更新。' : '影音已加入收藏清單。');
  } catch (error) { showToast(error.message || '影音儲存失敗。'); }
}

async function handleMediaDelete(mediaId, button) {
  if (!state.isAdmin) return;
  const item = state.media.find((media) => String(media.id) === String(mediaId));
  if (!item) return;
  if (!window.confirm(`確定刪除「${item.title}」嗎？\n刪除後無法復原。`)) return;

  button.disabled = true;
  button.textContent = '刪除中…';
  try {
    if (state.isLive) {
      const receipt = await submitAndWait({ action: 'deleteMedia', credential: state.credential, mediaId: item.id });
      if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '影音刪除失敗。');
    }
    state.media = state.media.filter((media) => String(media.id) !== String(mediaId));
    renderMedia();
    showToast(state.isLive ? '影音已從 Google 試算表刪除。' : '影音已從示範收藏清單移除。');
  } catch (error) {
    showToast(error.message || '影音刪除失敗。');
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = '刪除';
    }
  }
}

async function handleTypeDelete(typeId, button) {
  if (!state.isAdmin) return;
  const item = state.types.find((type) => String(type.id) === String(typeId));
  if (!item) return;
  if (!window.confirm(`確定刪除影音類型「${item.name}」嗎？\n若已有影音使用此類型，系統會拒絕刪除。`)) return;
  button.disabled = true;
  button.textContent = '刪除中…';
  try {
    if (state.isLive) {
      const receipt = await submitAndWait({ action: 'deleteType', credential: state.credential, typeId: item.id });
      if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '影音類型刪除失敗。');
    }
    state.types = state.types.filter((type) => String(type.id) !== String(typeId));
    if (state.type === item.name) state.type = 'all';
    render();
    showToast(state.isLive ? '影音類型已刪除。' : '示範影音類型已刪除。');
  } catch (error) {
    showToast(error.message || '影音類型刪除失敗。');
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = '刪除';
    }
  }
}

function openTypeModal() {
  if (!state.isAdmin) return;
  state.editingTypeId = null;
  $('#typeForm').reset();
  $('#typeTitle').textContent = '新增影音類型';
  $('#typeSubmitButton').textContent = '新增類型';
  openModal('type');
}

function openEditTypeModal(typeId) {
  if (!state.isAdmin) return;
  const item = state.types.find((type) => String(type.id) === String(typeId));
  if (!item) return;
  state.editingTypeId = item.id;
  $('#typeForm').reset();
  $('#typeForm').elements.name.value = item.name || '';
  $('#typeTitle').textContent = '修改影音類型';
  $('#typeSubmitButton').textContent = '更新類型';
  openModal('type');
}

async function handleTypeSubmit(event) {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get('name').trim();
  if (!name) return;
  if (!state.isLive) {
    if (state.editingTypeId) {
      const oldType = state.types.find((type) => String(type.id) === String(state.editingTypeId));
      state.types = state.types.map((type) => String(type.id) === String(state.editingTypeId) ? { ...type, name } : type);
      if (oldType) state.media = state.media.map((item) => item.type === oldType.name ? { ...item, type: name } : item);
    } else {
      state.types.push({ id: `local-type-${Date.now()}`, name });
    }
    closeModal();
    render();
    showToast(state.editingTypeId ? '示範影音類型已更新。' : '已新增示範影音類型。');
    state.editingTypeId = null;
    return;
  }
  try {
    const action = state.editingTypeId ? 'updateType' : 'addType';
    const payload = state.editingTypeId ? { action, credential: state.credential, typeId: state.editingTypeId, name } : { action, credential: state.credential, name };
    const receipt = await submitAndWait(payload);
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '影音類型儲存失敗。');
    closeModal();
    state.editingTypeId = null;
    await loadLiveData();
    showToast(action === 'updateType' ? '影音類型已更新。' : '影音類型已新增。');
  } catch (error) { showToast(error.message || '影音類型儲存失敗。'); }
}

function wireEvents() {
  $('#loginButton').addEventListener('click', () => openModal('login'));
  $('#openSettingsButton').addEventListener('click', () => openModal('login'));
  $('#logoutButton').addEventListener('click', logout);
  $('#addMediaButton').addEventListener('click', openMediaModal);
  $('#addTypeButton').addEventListener('click', openTypeModal);
  $('#saveSettingsButton').addEventListener('click', saveConnectionSettings);
  $('#demoAdminButton').addEventListener('click', enterDemoAdmin);
  $('#searchInput').addEventListener('input', (event) => { state.search = event.target.value; renderMedia(); });
  $('#typeFilter').addEventListener('change', (event) => { state.type = event.target.value; renderMedia(); });
  $('#youtubeShareRefresh').addEventListener('click', loadYoutubeShareCollection);
  $('#mediaGrid').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-media]');
    if (editButton) {
      openEditMediaModal(editButton.dataset.editMedia);
      return;
    }
    const button = event.target.closest('[data-delete-media]');
    if (button) handleMediaDelete(button.dataset.deleteMedia, button);
  });
  $('#typeList').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-type]');
    if (editButton) {
      openEditTypeModal(editButton.dataset.editType);
      return;
    }
    const button = event.target.closest('[data-delete-type]');
    if (button) handleTypeDelete(button.dataset.deleteType, button);
  });
  $('#mediaForm [name="url"]').addEventListener('input', () => { updateVideoThumbnail(); scheduleVideoTitleLookup(); clearTimeout(descriptionLookupTimer); descriptionLookupTimer = setTimeout(lookupVideoDescription, 450); });
  $('#mediaForm [name="url"]').addEventListener('blur', () => { lookupVideoTitle(); lookupVideoDescription(); });
  $('#mediaForm [name="title"]').addEventListener('input', (event) => {
    if (event.target.dataset.filling !== 'true') event.target.dataset.manual = 'true';
  });
  $('#mediaForm [name="description"]').addEventListener('input', (event) => {
    if (event.target.dataset.filling !== 'true') event.target.dataset.manual = 'true';
  });
  $('#mediaForm').addEventListener('submit', handleMediaSubmit);
  $('#typeForm').addEventListener('submit', handleTypeSubmit);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  $('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.modal) closeModal(); });
}

wireEvents();
render();
loadLiveData();
loadYoutubeShareCollection();
