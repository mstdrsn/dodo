/* ===================== STORAGE & HELPERS ===================== */
const LS_TASKS  = 'tasks';
const LS_CATS   = 'categories';
const LS_RECENT = 'recentColors';
const LS_PRIOS  = 'priorities'; // ← YENİ: Öncelik tanımları

const activeList     = document.getElementById('activeList');
const doneList       = document.getElementById('doneList');
const activeCountBox = document.getElementById('activeCountBox');
const doneCountBox   = document.getElementById('doneCountBox');

const manageModalBtn = document.getElementById('manageCategoriesBtn');
const addTaskBtn     = document.getElementById('addTaskBtn');

const activeHeader  = document.getElementById('activeHeader');
const doneHeader    = document.getElementById('doneHeader');
const activeSection = document.getElementById('activeSection');
const doneSection   = document.getElementById('doneSection');

const activeSelectAll   = document.getElementById('activeSelectAll');
const activeClearSel    = document.getElementById('activeClearSel');
const activeCompleteBtn = document.getElementById('activeCompleteBtn');
const activeDeleteBtn   = document.getElementById('activeDeleteBtn');

const doneSelectAll     = document.getElementById('doneSelectAll');
const doneClearSel      = document.getElementById('doneClearSel');
const doneUncompleteBtn = document.getElementById('doneUncompleteBtn');
const doneDeleteBtn     = document.getElementById('doneDeleteBtn');

const selectedIds = new Set();
let manageModal, editModal;

/* YENİ: Subtasks & Comments modal state */
let subtasksModal, subtasksTaskIndex = null;
let commentsModal, commentsTaskIndex = null;

/* YENİ: Öncelik modal state */
let priorityModal;
let priorityMiniColor = '#0d6efd';

let focusTaskId = null;

/* ===================== CHIP SCROLL (Kategori butonu) ===================== */
let _chipsScrollSetup = false;
function setupCategoryChipsScroll(){
  const wrapper = document.getElementById('categoryDropdown');
  if (!wrapper) return;
  const chips = wrapper.querySelector('.chips');
  const btn   = wrapper.querySelector('button.dropdown-toggle');
  if (btn && !btn.hasAttribute('data-bs-auto-close')) {
    btn.setAttribute('data-bs-auto-close','outside'); // seçerken menü kapanmasın
  }
  const menu = wrapper.querySelector('.dropdown-menu');
  if (menu && !menu._noCloseInstalled) {
    ['click','mousedown'].forEach(ev => menu.addEventListener(ev, e => e.stopPropagation()));
    menu._noCloseInstalled = true;
  }
  if (!chips || _chipsScrollSetup) return;
  _chipsScrollSetup = true;

  function updateOverflow(){
    const overflowing = chips.scrollWidth > (chips.clientWidth + 1);
    wrapper.classList.toggle('is-overflowing', overflowing);
    const atEnd = Math.ceil(chips.scrollLeft + chips.clientWidth) >= chips.scrollWidth;
    wrapper.classList.toggle('at-end', overflowing && atEnd);
  }

  // Drag-to-scroll (dropdown açılmasın)
  let isDown = false, startX = 0, startScroll = 0, moved = false;
  chips.addEventListener('pointerdown', (e)=>{
    isDown = true; moved = false;
    startX = e.clientX; startScroll = chips.scrollLeft;
    chips.setPointerCapture(e.pointerId);
    chips.classList.add('dragging');
    e.stopPropagation();  // dropdown toggle'ı engelle
  });
  chips.addEventListener('pointermove', (e)=>{
    if(!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    chips.scrollLeft = startScroll - dx;
    updateOverflow();
    e.preventDefault();
    e.stopPropagation();
  });
  chips.addEventListener('pointerup', (e)=>{
    isDown = false;
    chips.releasePointerCapture(e.pointerId);
    chips.classList.remove('dragging');
    setTimeout(()=>{ moved = false; }, 0);
  });
  chips.addEventListener('click', (e)=>{
    if (moved) { e.preventDefault(); e.stopPropagation(); }
  });

  // Fare tekerleği ile yatay kaydırma (dikey delta’yı yataya çevir)
  chips.addEventListener('wheel', (e)=>{
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      chips.scrollLeft += e.deltaY;
      e.preventDefault();
    }
    updateOverflow();
  }, { passive: false });

  // Reflow durumlarında kontrol
  window.addEventListener('resize', updateOverflow);
  new MutationObserver(updateOverflow).observe(chips, { childList: true });
  chips.addEventListener('scroll', updateOverflow);

  // ilk durum
  updateOverflow();
}

/* ===================== LOCALSTORAGE HELPERS ===================== */
let addPriority = 'none'; // Üst form için seçilen öncelik anahtarı

function getTasks(){ return JSON.parse(localStorage.getItem(LS_TASKS)) || []; }
function saveTasks(tasks){ localStorage.setItem(LS_TASKS, JSON.stringify(tasks)); }

function getCategories(){ return JSON.parse(localStorage.getItem(LS_CATS)) || []; }
function saveCategories(cats){ localStorage.setItem(LS_CATS, JSON.stringify(cats)); }

function getPriorities(){ return JSON.parse(localStorage.getItem(LS_PRIOS)) || null; }
function savePriorities(prios){ localStorage.setItem(LS_PRIOS, JSON.stringify(prios)); }

function ensurePriorityDefaults(){
  let p = getPriorities();
  if(!p){
    p = [
      { key:'none',   name:'Yok',    color:'#ced4da' },
      { key:'low',    name:'Düşük',  color:'#28a745' },
      { key:'medium', name:'Orta',   color:'#ffc107' },
      { key:'high',   name:'Yüksek', color:'#dc3545' }
    ];
    savePriorities(p);
  }
}

function genId(prefix='t'){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function ensureTaskIds(){ const tasks=getTasks(); let upd=false; tasks.forEach(t=>{if(!t.id){t.id=genId('t');upd=true;}}); if(upd) saveTasks(tasks); }

const STATIC_COLORS = [
  {name:"Default", color:"#6c757d"},
  {name:"Orange",  color:"#fd7e14"},
  {name:"Yellow",  color:"#ffc107"},
  {name:"Green",   color:"#28a745"},
  {name:"Blue",    color:"#0d6efd"},
  {name:"Purple",  color:"#6f42c1"},
  {name:"Red",     color:"#dc3545"},
];
function getRecentColors(){ return JSON.parse(localStorage.getItem(LS_RECENT)) || []; }
function setRecentColors(a){ localStorage.setItem(LS_RECENT, JSON.stringify(a)); }
function pushRecentColor(hex){
  if(!/^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(hex||'')) return;
  hex=hex.toLowerCase();
  let arr=getRecentColors();
  arr=[hex, ...arr.filter(c=>c!==hex)];
  if(arr.length>6) arr=arr.slice(0,6);
  setRecentColors(arr);
}
function paletteColors(){ return [...STATIC_COLORS.map(x=>({color:x.color,name:x.name})), ...getRecentColors().map(c=>({color:c,name:null}))]; }

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function getDaysLeftNum(dateStr){
  if(!dateStr) return Number.POSITIVE_INFINITY;
  const today=startOfDay(new Date()); const target=startOfDay(new Date(dateStr));
  return Math.ceil((target - today)/(1000*60*60*24));
}
function daysLeftLabel(dateStr){ if(!dateStr) return ''; const diff=getDaysLeftNum(dateStr); if(diff===0) return 'Bugün'; return `${diff} gün`; }
function formatDate(s){ if(!s) return ''; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}

function canNotify(){ return 'Notification' in window; }
function ensureNotifyPermission(){
  if(!canNotify()) return Promise.resolve('denied');
  if(Notification.permission==='granted' || Notification.permission==='denied') return Promise.resolve(Notification.permission);
  return Notification.requestPermission();
}
function showToast(text){
  const el=document.createElement('div');
  el.className='toast align-items-center show';
  el.setAttribute('role','alert');
  el.innerHTML=`<div class="d-flex"><div class="toast-body">${text}</div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Kapat"></button></div>`;
  document.getElementById('toastArea').appendChild(el);
  setTimeout(()=>el.remove(), 5000);
}
function showNotification(title, body){
  if(canNotify() && Notification.permission==='granted'){ new Notification(title,{body}); }
  else { showToast(`${title} — ${body}`); }
}
function textColor(hex){
  if(!hex) return '#fff';
  let h=hex.replace('#',''); 
  if(h.length===3) h = [...h].map(c=>c+c).join('');
  const r=parseInt(h.substr(0,2),16), g=parseInt(h.substr(2,2),16), b=parseInt(h.substr(4,2),16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq >= 160 ? '#111827' : '#ffffff';
}
function categoryBadgeHTML(c){
  const bg = c.color || '#6c757d';
  const fg = textColor(bg);
  return `<span class="badge" style="background-color:${bg}; color:${fg}">${c.name}</span>`;
}
function priorityByKey(k){
  const defs = getPriorities() || [];
  return defs.find(p=>p.key===k) || defs[0] || {key:'none',name:'Yok',color:'#ced4da'};
}
function priorityBadge(key){
  const p = priorityByKey(key);
  const fg = textColor(p.color);
  return `<span class="badge" style="background-color:${p.color}; color:${fg}">${escapeHtml(p.name)}</span>`;
}
function slugify(s){
  const base = (s||'').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'').slice(0,24);
  return base || ('prio-'+Date.now().toString(36));
}

function syncTaskCategoryColors(){
  const cats = getCategories();
  const colorByName = new Map(cats.map(c => [c.name, c.color]));
  const tasks = getTasks();
  let changed = false;
  tasks.forEach(t => {
    if (Array.isArray(t.categories)) {
      t.categories.forEach(tc => {
        const newColor = colorByName.get(tc.name);
        if (newColor && tc.color !== newColor) {
          tc.color = newColor;
          changed = true;
        }
      });
    }
  });
  if (changed) saveTasks(tasks);
}

/* Hatırlatıcıları 30sn'de bir yokla */
setInterval(() => {
  const tasks=getTasks(); let changed=false; const now=Date.now();
  tasks.forEach(t=>{
    if(t.done) return;
    if(t.reminderAt && !t.reminderFired){
      const ts=Date.parse(t.reminderAt);
      if(!isNaN(ts) && ts<=now){ showNotification('Hatırlatıcı', (t.title||'Görev')+' zamanı geldi!'); t.reminderFired=true; changed=true; }
    }
  });
  if(changed) saveTasks(tasks);
}, 30000);

/* ===================== UI INIT ===================== */
let selectedCategories = [];
let miniSelectedColor  = "#0d6efd";

document.addEventListener('DOMContentLoaded', ()=>{
  manageModal   = new bootstrap.Modal(document.getElementById('manageModal'));
  editModal     = new bootstrap.Modal(document.getElementById('editModal'));
  subtasksModal = new bootstrap.Modal(document.getElementById('subtasksModal'));
  commentsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commentsModal'));

  // Header ikonlarını ilk yüklemede hizala
  ['active','done'].forEach(which => {
    const sec  = (which === 'active') ? activeSection : doneSection;
    const icon = document.getElementById(which === 'active' ? 'activeToggle' : 'doneToggle');
    const isVisible = (sec.style.display !== 'none'); // varsayılan: block
    icon.classList.remove('bi-caret-down-fill', 'bi-caret-right-fill');
    icon.classList.add(isVisible ? 'bi-caret-down-fill' : 'bi-caret-right-fill');
  });

  // taskDate tip dönüşümü
  const di = document.getElementById('taskDate');
  di.addEventListener('focus', ()=>{ di.type='date'; });
  di.addEventListener('blur', ()=>{ di.type = di.value==='' ? 'text' : 'date'; });

  // Yorum modalı hızlı ekleme
  document.getElementById('commentsModalAddBtn').addEventListener('click', addCommentFromModal);
  document.getElementById('commentsModalInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      addCommentFromModal();
    }
  });

  ensureTaskIds();
  if(getCategories().length===0){
    saveCategories([{name:'Genel',color:'#6c757d'},{name:'İş',color:'#0d6efd'},{name:'Kişisel',color:'#28a745'}]);
  }
  ensurePriorityDefaults(); // ← YENİ

  renderDropdown();
  setupCategoryChipsScroll();
  renderMiniPalette();
  renderCategoryManager();
  renderPriorityMenu();      // ← YENİ (öncelik menüsü dinamik)
  renderTasks();

  // Bootstrap öncelik dropdown seçimi
  const prioDD    = document.getElementById('priorityDropdown');
  const prioLabel = document.getElementById('prioritySelectedLabel');
  function updatePriorityLabel(){ prioLabel.innerHTML = 'Öncelik: ' + priorityBadge(addPriority); }

  // Menü içi tıklamalar
  const prioMenu = prioDD.querySelector('.dropdown-menu');
  prioMenu.addEventListener('click', (e)=>{
    // Yönet butonu
    const manageBtn = e.target.closest('.priorityManageBtn');
    if(manageBtn){
      e.preventDefault(); e.stopPropagation();
      ensurePriorityModal();
      renderPriorityManager();
      priorityModal.show();
      return;
    }
    // Bir öncelik seçimi
    const item = e.target.closest('.dropdown-item');
    if(item){
      e.preventDefault(); e.stopPropagation();
      addPriority = item.dataset.value || 'none';
      updatePriorityLabel();
    }
  });
  updatePriorityLabel();

  // Öncelik dropdown'u: popper'ı 'fixed' stratejisine zorla (kayma ihtimalini sıfırlar)
{
  const prioToggle = document.querySelector('#priorityDropdown > button.dropdown-toggle');
  if (prioToggle) {
    bootstrap.Dropdown.getOrCreateInstance(prioToggle, {
      autoClose: 'outside',
      display: 'static',
      popperConfig: (defaultConfig) => ({
        ...defaultConfig,
        strategy: 'fixed',
        modifiers: [
          ...(defaultConfig?.modifiers || []),
          { name: 'offset', options: { offset: [0, 8] } },
          // Yedek yerleşim: hep yukarıda kalsın
          { name: 'flip', options: { fallbackPlacements: ['top-start', 'top-end'] } },
        ]
      })
    });
  }
}

  document.querySelectorAll('#sortMenu [data-sort]').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.preventDefault(); sortTasks(el.dataset.sort); });
  });

  // Headerlarda aç/kapa
  activeHeader.addEventListener('click',()=>toggleSection('active'));
  doneHeader.addEventListener('click', ()=>toggleSection('done'));
  document.querySelectorAll('.header-right button').forEach(b=> b.addEventListener('click', e=>e.stopPropagation()));

  showToast('Kısayollar: N yeni, E düzenle, Space tamamla, Del sil, ↑/↓ gezin, Ctrl+A tümünü seç');
});

function toggleSection(which){
  const sec  = (which === 'active') ? activeSection : doneSection;
  const icon = document.getElementById(which === 'active' ? 'activeToggle' : 'doneToggle');

  const isVisible = (sec.style.display !== 'none');
  sec.style.display = isVisible ? 'none' : 'block';

  icon.classList.remove('bi-caret-down-fill', 'bi-caret-right-fill');
  icon.classList.add(isVisible ? 'bi-caret-right-fill' : 'bi-caret-down-fill');
}

/* ===================== ADD TASK ===================== */
addTaskBtn.addEventListener('click', ()=>{
  const title=(document.getElementById('taskTitle').value||'').trim();
  const desc =(document.getElementById('taskDesc').value||'').trim();
  const di   = document.getElementById('taskDate');
  const date = (di.type==='date') ? di.value : '';

  if(!title) return;
  let categories=[...selectedCategories]; if(categories.length===0) categories=[{name:'Genel',color:'#6c757d'}];

  const priority = addPriority || 'none';
  const task={ id:genId('t'), title, desc, date, categories, done:false, priority,
               subtasks:[], comments:[], reminderAt:null, reminderFired:false, order:Date.now() };
  const tasks=getTasks(); tasks.push(task); saveTasks(tasks);

  // sıfırla
  document.getElementById('taskTitle').value='';
  document.getElementById('taskDesc').value='';
  di.value=''; di.type='text';
  addPriority='none';
  document.getElementById('prioritySelectedLabel').innerHTML = 'Öncelik: ' + priorityBadge(addPriority);
  selectedCategories=[]; renderDropdown(); renderTasks();
});

/* ===================== RENDER LISTS ===================== */
// global drag durum ve placeholder
const dragState = { id:null, fromList:null, ghost:null };
const dropPlaceholder = document.createElement('li');
dropPlaceholder.className = 'drop-placeholder';

function renderTasks(){
  activeList.innerHTML=''; doneList.innerHTML='';
  const tasks=getTasks();

  tasks.forEach((task, index)=>{
    task.priority = task.priority || 'none';
    task.subtasks = Array.isArray(task.subtasks)?task.subtasks:[];
    task.comments = Array.isArray(task.comments)?task.comments:[];
    if(task.reminderAt===undefined) task.reminderAt=null;
    if(task.reminderFired===undefined) task.reminderFired=false;

    const li=document.createElement('li');
    li.className='taskItem';
    li.dataset.index=index; li.dataset.id=task.id;
    if(task.done) li.classList.add('done');
    if(task.id===focusTaskId) li.classList.add('focused');

    const cats=(Array.isArray(task.categories)&&task.categories.length>0)?task.categories:[{name:'Genel',color:'#6c757d'}];
    const badges = cats.map(categoryBadgeHTML).join(' ');

    // Alt görev rozeti + üç nokta (en az 1 alt görev varsa göster)
    const st= subtaskProgress(task);
    const stBadge= st.total>0 ? `<span class="badge text-bg-secondary">${st.done}/${st.total}</span>` : '';
    // Yorum sayacı rozeti (0 dahil)
    const cmCount = Array.isArray(task.comments) ? task.comments.length : 0;
    const cmBadge = `<button class="btn btn-link btn-sm p-0 ms-1 commentsBtn" type="button" title="Yorumları gör"><i class="bi bi-chat-right-dots-fill"></i> ${cmCount}</button>`;

    const bell= task.reminderAt ? `<i class="bi bi-bell-fill${task.reminderFired?'-slash':''}" title="Hatırlatıcı"></i>` : '';
    const expiredClass=(task.date && new Date(task.date)<new Date() && !task.done)?'text-danger':'';

    li.innerHTML=`
      <div class="sel-col">
        <button class="btn btn-sm expandBtn rounded-pill" type="button" title="Görevi aç/kapa">
          <i class="bi bi-arrows-expand"></i>
        </button>
        <input type="checkbox" class="form-check-input selectTask">
      </div>
      <div>
        <div class="d-flex align-items-center gap-2"><div class="title">${escapeHtml(task.title||'')}</div>${stBadge}${cmBadge}${bell}</div>
        <div class="desc">
        ${task.desc ? `<div class="mb-2">${escapeHtml(task.desc)}</div>` : ''}
        ${task.subtasks?.length ? renderSubtasksInline(task.subtasks) : ''}
        </div>
      </div>
      <div>${badges}</div>
      <div>${priorityBadge(task.priority)}</div>
      <div class="${expiredClass}">${task.date?formatDate(task.date):''}</div>
      <div>${task.done?'Tamamlandı':daysLeftLabel(task.date)}</div>
      <div class="d-flex flex-wrap gap-1">
        <button class="btn btn-outline-secondary btn-sm remindBtn rounded-pill" type="button" title="Hatırlatıcı"><i class="bi bi-bell-fill"></i></button>
        <button class="btn btn-success btn-sm completeBtn rounded-pill" type="button" title="Tamamla/Geri al"><i class="bi bi-check-circle-fill"></i></button>
        <button class="btn btn-danger btn-sm deleteBtn rounded-pill" type="button" title="Sil"><i class="bi bi-trash-fill"></i></button>
        <button class="btn btn-secondary btn-sm editBtn rounded-pill" type="button" title="Düzenle"><i class="bi bi-pencil-square"></i></button>
        <!-- sadece bu ikondan sürükle-bırak -->
        <button class="btn btn-outline-dark btn-sm dragHandle rounded-pill" type="button" title="Taşı" draggable="true">
          <i class="bi bi-arrows-move"></i>
        </button>
      </div>
    `;

    // Expand ikonu: açık/kapalı simgeyi ayarla + efektli geçiş
    const expandBtn = li.querySelector('.expandBtn');
    if (expandBtn) {
      const icon = expandBtn.querySelector('i');
      function applyExpandIcon() {
        icon.classList.remove('bi-arrows-expand', 'bi-arrows-collapse');
        icon.classList.add(li.classList.contains('open') ? 'bi-arrows-collapse' : 'bi-arrows-expand');
      }
      applyExpandIcon();

      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        expandBtn.classList.add('swapping');
        setTimeout(() => {
          li.classList.toggle('open');
          applyExpandIcon();
          expandBtn.classList.remove('swapping');
        }, 100);
      });
    }

    const cb=li.querySelector('.selectTask');
    cb.checked=selectedIds.has(task.id);
    cb.addEventListener('click', ev=>ev.stopPropagation());
    cb.addEventListener('change', e=>{
      if(e.target.checked) selectedIds.add(task.id); else selectedIds.delete(task.id);
      updateActionButtons(); focusTaskId=task.id; highlightFocus(task.id);
    });

    li.addEventListener('click', e=>{
      if(e.target.closest('.btn')) return;
      focusTaskId = task.id;
      highlightFocus(task.id);
    });

    li.querySelector('.completeBtn').addEventListener('click', ()=>{
      const t=getTasks(); t[index].done=!t[index].done; saveTasks(t); selectedIds.delete(t[index].id); renderTasks();
    });
    li.querySelector('.deleteBtn').addEventListener('click', ()=>{
      const t=getTasks(); const id=t[index].id; t.splice(index,1); saveTasks(t); selectedIds.delete(id); renderTasks();
    });
    li.querySelector('.editBtn').addEventListener('click', e=>{ e.stopPropagation(); openEditModal(task,index); });

    li.querySelector('.remindBtn').addEventListener('click', async ()=>{
      const t=getTasks(); const tgt=t[index];
      if(!tgt.reminderAt){
        if(tgt.date){
          const d=new Date(tgt.date); d.setHours(9,0,0,0); tgt.reminderAt=d.toISOString(); tgt.reminderFired=false;
          await ensureNotifyPermission(); saveTasks(t); showToast('Hatırlatıcı eklendi');
        } else {
          openEditModal(tgt,index); setTimeout(()=>document.getElementById('editReminder').focus(),200);
        }
      }else{
        tgt.reminderAt=null; tgt.reminderFired=false; saveTasks(t); showToast('Hatırlatıcı kaldırıldı');
      }
      renderTasks();
    });

    // Alt görev modal butonu
    const moreBtn = li.querySelector('.subtasksMoreBtn');
    if(moreBtn){
      moreBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openSubtasksModal(task, index); });
    }

    // Yorumlar butonu
    const commentsBtn = li.querySelector('.commentsBtn');
    if(commentsBtn){
      commentsBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openCommentsModal(task, index); });
    }

    // Drag sadece handle üzerinden
    const handle = li.querySelector('.dragHandle');
    handle.addEventListener('click', e=> e.stopPropagation());
    handle.addEventListener('dragstart', (e)=>{
      e.stopPropagation();
      // 1) Drag state
      dragState.id = task.id;
      dragState.fromList = task.done ? 'done' : 'active';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      li.classList.add('dragging');

      // 2) Tüm satırı hayalet olarak göster (setDragImage)
      const rect = li.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;   // Başlangıç tıklama ofsetini koru
      const offsetY = e.clientY - rect.top;

      const ghost = li.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.width = rect.width + 'px';   // aynı genişlik
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
      dragState.ghost = ghost;
    });
    handle.addEventListener('dragend', ()=>{
      li.classList.remove('dragging');
      if(dropPlaceholder.parentElement) dropPlaceholder.parentElement.removeChild(dropPlaceholder);
      if (dragState.ghost) { dragState.ghost.remove(); dragState.ghost = null; }
      dragState.id = null; dragState.fromList = null;
    });

    (task.done?doneList:activeList).appendChild(li);
  });

  // Liste seviyesinde canlı yerleştirme
  [activeList, doneList].forEach(container=>{
    container.addEventListener('dragover', (e)=>{
      if(!dragState.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const afterEl = getDragAfterElement(container, e.clientY);
      if(afterEl == null){ container.appendChild(dropPlaceholder); }
      else { container.insertBefore(dropPlaceholder, afterEl); }
    });

    container.addEventListener('drop', (e)=>{
      if(!dragState.id) return;
      e.preventDefault();

      const tasks = getTasks();
      const dragIdx = tasks.findIndex(t => t.id === dragState.id);
      if(dragIdx < 0){ cleanupPlaceholder(); return; }

      const draggedTask = tasks[dragIdx];

      // Mevcut iki dizi
      let activeArr = tasks.filter(t => !t.done);
      let doneArr   = tasks.filter(t =>  t.done);

      // Kaynak diziden çıkar
      let fromArr = draggedTask.done ? doneArr : activeArr;
      const oldPos = fromArr.findIndex(t => t.id === draggedTask.id);
      if(oldPos > -1) fromArr.splice(oldPos, 1);

      // Hedef diziyi belirle (container'a göre)
      const toDone = (container === doneList);

      // Liste değişiyorsa done durumunu çevir
      if (draggedTask.done !== toDone) {
        draggedTask.done = toDone;
      }

      // Hedef diziye placeholder konumuna yerleştir
      const targetArr = toDone ? doneArr : activeArr;
      const newPos = getPlaceholderIndex(container);
      const boundedPos = Math.max(0, Math.min(newPos, targetArr.length));
      targetArr.splice(boundedPos, 0, draggedTask);

      // Seçili ID'yi temizle
      selectedIds.delete(draggedTask.id);

      // Dizileri yeniden birleştir ve kaydet
      const newTasks = [...activeArr, ...doneArr];
      saveTasks(newTasks);

      cleanupPlaceholder();
      renderTasks();
    });
  });

  updateCounters(); updateActionButtons(); attachRowKeyFocusHandlers();
}

// Drag yardımcıları
function getDragAfterElement(container, y){
  const els = [...container.querySelectorAll('.taskItem:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  els.forEach(el=>{
    const rect = el.getBoundingClientRect();
    const offset = y - rect.top - rect.height/2;
    if(offset < 0 && offset > closest.offset){
      closest = { offset, element: el };
    }
  });
  return closest.element;
}
function getPlaceholderIndex(container){
  let idx = 0;
  let node = container.firstElementChild;
  while(node){
    if(node === dropPlaceholder) return idx;
    if(node.classList && node.classList.contains('taskItem')) idx++;
    node = node.nextElementSibling;
  }
  return idx;
}
function cleanupPlaceholder(){
  if(dropPlaceholder.parentElement) dropPlaceholder.parentElement.removeChild(dropPlaceholder);
  dragState.id = null; dragState.fromList = null;
}

/* ===================== BADGES / SUBTASKS INLİNE ===================== */
function subtaskProgress(task){ const total=task.subtasks?.length||0; const done=task.subtasks?.filter(s=>s.done).length||0; return {done,total}; }
function renderSubtasksInline(subs){
  const shown=subs.slice(0,3).map(s=>`<span class="badge text-bg-light me-1">${escapeHtml(s.text)}${s.done?' ✓':''}</span>`).join('');
  const extraCount = subs.length>3 ? (subs.length-3) : 0;
  const extra = extraCount ? `<span class="badge text-bg-secondary">+${extraCount}</span>` : '';
  const dots = subs.length >= 1
    ? `<button class="btn btn-link btn-sm p-0 ms-1 subtasksMoreBtn" type="button" title="Tüm alt görevleri göster"><i class="bi bi-three-dots"></i></button>`
    : '';
  return `<div class="mt-1">${shown}${extra}${dots}</div>`;
}

function updateCounters(){
  const tasks=getTasks();
  activeCountBox.textContent='Aktif: '+tasks.filter(t=>!t.done).length;
  doneCountBox.textContent  ='Tamamlanan: '+tasks.filter(t=>t.done).length;
}
function highlightFocus(id){
  document.querySelectorAll('.taskItem').forEach(li=>li.classList.remove('focused'));
  const el=document.querySelector(`.taskItem[data-id="${id}"]`);
  if(el) el.classList.add('focused');
}

/* ===================== CATEGORY UI ===================== */
const dropdown       = document.getElementById('categoryDropdown');
const chipsContainer = dropdown.querySelector('.chips');
const dropdownMenu   = dropdown.querySelector('.dropdown-menu');

function renderDropdown(){
  dropdownMenu.innerHTML=''; chipsContainer.innerHTML='';

  // Menü kapanmasın
  ['click','mousedown'].forEach(ev => dropdownMenu.addEventListener(ev, e => e.stopPropagation()));

  getCategories().forEach(cat=>{
    const item=document.createElement('div'); item.className='dropdown-item';
    item.innerHTML=`<div class="form-check">
      <input class="form-check-input" type="checkbox" id="cat-${cat.name}">
      <label class="form-check-label" for="cat-${cat.name}">${cat.name}</label>
    </div>`;
    const checked=selectedCategories.find(c=>c.name===cat.name);
    setTimeout(()=>{ item.querySelector('input').checked=!!checked; },0);
    item.addEventListener('click', e=>{
      e.preventDefault(); e.stopPropagation();
      if(e.target.tagName!=='INPUT') item.querySelector('input').checked=!item.querySelector('input').checked;
      toggleCategory(cat); renderDropdown();
    });
    dropdownMenu.appendChild(item);
  });

  selectedCategories.forEach(cat=>{
    const span=document.createElement('span'); span.textContent=cat.name; span.style.background=cat.color;
    const btn=document.createElement('button'); btn.type='button'; btn.textContent='×';
    btn.onclick=()=>{ selectedCategories=selectedCategories.filter(c=>c.name!==cat.name); renderDropdown(); };
    span.appendChild(btn); chipsContainer.appendChild(span);
  });
}
function toggleCategory(cat){
  const exists=selectedCategories.find(c=>c.name===cat.name);
  if(exists) selectedCategories=selectedCategories.filter(c=>c.name!==cat.name);
  else selectedCategories.push(cat);
}

const categoryList   = document.getElementById('categoryList');
const miniPalette    = document.getElementById('miniPalette');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const newCategoryName= document.getElementById('newCategoryName');

manageModalBtn.addEventListener('click', ()=>{ renderCategoryManager(); manageModal.show(); });

function buildPaletteDots(container, currentColor, onPick){
  container.innerHTML='';
  paletteColors().forEach(c=>{
    const dot=document.createElement('div'); dot.className='color-option'; dot.style.background=c.color; if(c.color===currentColor) dot.classList.add('selected');
    dot.title=c.name?c.name:'Son renk';
    dot.addEventListener('click',()=>{
      container.querySelectorAll('.color-option').forEach(x=>x.classList.remove('selected'));
      dot.classList.add('selected');
      onPick(c.color);
    });
    container.appendChild(dot);
  });
  const custom=document.createElement('div'); custom.className='color-option custom'; custom.title='Özel renk seç'; custom.style.background='#fff';
  custom.addEventListener('click', ()=> pickCustomColor(currentColor, hex=> onPick(hex), custom) );
  container.appendChild(custom);
}

function renderCategoryManager(){
  categoryList.innerHTML=''; const cats=getCategories();
  cats.forEach((cat,i)=>{
    const wrap=document.createElement('div'); wrap.className='categoryItem';
    const badge=document.createElement('div'); badge.className='badge-edit'; badge.style.background=cat.color; badge.textContent=cat.name;
    wrap.appendChild(badge);

    const popup=document.createElement('div'); popup.className='cat-popup';
    popup.innerHTML=`<input type="text" value="${cat.name}">
      <div class="color-palette"></div>
      <div class="d-flex justify-content-between mt-2">
        <button class="btn btn-sm btn-outline-secondary pickColorBtn rounded-pill" type="button">Renk Seç</button>
        <button class="btn btn-sm btn-danger rounded-pill">Sil</button>
      </div>`;
    wrap.appendChild(popup);

    const pal=popup.querySelector('.color-palette');
    buildPaletteDots(pal, cat.color, hex=>{
      cat.color = hex;
      badge.style.background = hex;
      saveCategories(cats);
      syncTaskCategoryColors();
      renderDropdown();
      renderTasks();
    });

    const pickBtn=popup.querySelector('.pickColorBtn'); pickBtn.style.background=cat.color; pickBtn.style.color='#fff';
    pickBtn.addEventListener('click', e=>{
      e.stopPropagation();
      pickCustomColor(cat.color, hex=>{
        cat.color = hex;
        badge.style.background = hex;
        pickBtn.style.background = hex;
        saveCategories(cats);
        syncTaskCategoryColors();
        renderDropdown();
        renderTasks();
      }, pickBtn);
    });

    const nameInput=popup.querySelector('input');
    nameInput.addEventListener('input', ()=>{
      cat.name=nameInput.value.trim(); badge.textContent=cat.name||'';
      saveCategories(cats); renderDropdown(); renderTasks();
    });

    popup.querySelector('.btn-danger').addEventListener('click',()=>{
      cats.splice(i,1); saveCategories(cats); renderCategoryManager(); renderDropdown(); renderTasks();
    });

    badge.addEventListener('click',()=>{ popup.style.display=(popup.style.display==='block'?'none':'block'); });

    categoryList.appendChild(wrap);
  });
}

function renderMiniPalette(){
  miniPalette.innerHTML='';
  paletteColors().forEach(c=>{
    const d=document.createElement('div'); d.className='mini-dot'; d.style.background=c.color; if(c.color===miniSelectedColor) d.classList.add('selected');
    d.addEventListener('click',()=>{
      miniSelectedColor=c.color;
      miniPalette.querySelectorAll('.mini-dot').forEach(x=>x.classList.remove('selected'));
      d.classList.add('selected');
    });
    miniPalette.appendChild(d);
  });
  const customMini=document.createElement('div'); customMini.className='mini-dot custom'; customMini.title='Özel renk seç'; customMini.style.background='#fff';
  customMini.addEventListener('click', ()=> pickCustomColor(miniSelectedColor, hex=>{
    miniSelectedColor=hex;
    miniPalette.querySelectorAll('.mini-dot').forEach(x=>x.classList.remove('selected'));
    customMini.classList.add('selected');
  }, customMini) );
  miniPalette.appendChild(customMini);
}

addCategoryBtn.addEventListener('click', ()=>{
  const name=(newCategoryName.value||'').trim(); if(!name) return;
  const cats=getCategories(); const idx=cats.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());
  if(idx>-1) cats[idx].color=miniSelectedColor; else cats.push({name, color:miniSelectedColor});
  saveCategories(cats); newCategoryName.value='';
  renderMiniPalette(); renderCategoryManager(); renderDropdown(); renderTasks();
});

/* ===================== PRIORITY UI (YENİ) ===================== */
function renderPriorityMenu(){
  const prioDD   = document.getElementById('priorityDropdown');
  const prioToggle = prioDD.querySelector('[data-bs-toggle="dropdown"]');
  const menu     = prioDD.querySelector('.dropdown-menu');
  const defs     = getPriorities() || [];
  const items    = defs.map(p=>{
    const fg = textColor(p.color);
    return `<li><a class="dropdown-item d-flex align-items-center gap-2" href="#" data-value="${p.key}">
      <span class="badge" style="background-color:${p.color};color:${fg}">${escapeHtml(p.name)}</span>
      <small class="text-muted ms-auto">${p.key}</small>
    </a></li>`;
  }).join('');

  menu.innerHTML = `
    <li class="px-3 py-2 d-flex align-items-center justify-content-between">
      <small class="text-muted">Öncelik seç</small>
      <button type="button" class="btn btn-link p-0 priorityManageBtn" title="Öncelikleri Yönet">
        <i class="bi bi-pencil-square"></i>
      </button>
    </li>
    <li><hr class="dropdown-divider"></li>
    ${items}
  `;
  // Menü kapanmasın (yönetim ve seçimlerde)
  ['click','mousedown'].forEach(ev => menu.addEventListener(ev, e => {
    if(e.target.closest('.dropdown-item')) return; // seçimde biz kapatmayacağız yine de
    e.stopPropagation();
  }));
}

function ensurePriorityModal(){
  if(document.getElementById('priorityModal')){
    priorityModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('priorityModal'));
    return;
  }
  const html = `
  <div class="modal fade" id="priorityModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content rounded-4">
        <div class="modal-header">
          <h5 class="modal-title">Öncelikleri Yönet</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
        </div>
        <div class="modal-body">
          <div id="priorityList" class="categoryList"></div>
          <div class="newCatRow mt-3">
            <input type="text" id="newPriorityName" class="form-control rounded-pill" placeholder="Yeni öncelik adı">
            <div class="mini-palette" id="priorityMiniPalette"></div>
            <button class="btn btn-success rounded-pill" id="addPriorityBtn" type="button">Ekle</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal" type="button">Kapat</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  priorityModal = new bootstrap.Modal(document.getElementById('priorityModal'));

  // Mini palette init
  const ppm = document.getElementById('priorityMiniPalette');
  function renderPrioMini(){
    ppm.innerHTML='';
    paletteColors().forEach(c=>{
      const d=document.createElement('div'); d.className='mini-dot'; d.style.background=c.color; if(c.color===priorityMiniColor) d.classList.add('selected');
      d.addEventListener('click',()=>{
        priorityMiniColor=c.color;
        ppm.querySelectorAll('.mini-dot').forEach(x=>x.classList.remove('selected'));
        d.classList.add('selected');
      });
      ppm.appendChild(d);
    });
    const customMini=document.createElement('div'); customMini.className='mini-dot custom'; customMini.title='Özel renk seç'; customMini.style.background='#fff';
    customMini.addEventListener('click', ()=> pickCustomColor(priorityMiniColor, hex=>{
      priorityMiniColor=hex;
      ppm.querySelectorAll('.mini-dot').forEach(x=>x.classList.remove('selected'));
      customMini.classList.add('selected');
    }, customMini) );
    ppm.appendChild(customMini);
  }
  renderPrioMini();

  document.getElementById('addPriorityBtn').addEventListener('click', ()=>{
    const name=(document.getElementById('newPriorityName').value||'').trim();
    if(!name) return;
    const defs=getPriorities()||[];
    let key = slugify(name);
    if(defs.some(p=>p.key===key)) key = key+'-'+Math.random().toString(36).slice(2,5);
    defs.push({key,name, color:priorityMiniColor});
    savePriorities(defs);
    document.getElementById('newPriorityName').value='';
    renderPriorityManager();
    renderPriorityMenu();
    renderTasks();
  });
}

function renderPriorityManager(){
  const listEl = document.getElementById('priorityList');
  const defs   = getPriorities() || [];
  listEl.innerHTML = '';
  defs.forEach((p,i)=>{
    const wrap=document.createElement('div'); wrap.className='categoryItem';
    const badge=document.createElement('div'); badge.className='badge-edit'; badge.style.background=p.color; badge.textContent=p.name;
    badge.style.color = textColor(p.color);
    wrap.appendChild(badge);

    const popup=document.createElement('div'); popup.className='cat-popup';
    popup.innerHTML=`<input type="text" value="${p.name}">
      <div class="color-palette"></div>
      <div class="d-flex justify-content-between mt-2">
        <button class="btn btn-sm btn-outline-secondary pickColorBtn rounded-pill" type="button">Renk Seç</button>
        <button class="btn btn-sm btn-danger rounded-pill">Sil</button>
      </div>`;
    wrap.appendChild(popup);

    const pal=popup.querySelector('.color-palette');
    buildPaletteDots(pal, p.color, hex=>{
      p.color = hex;
      badge.style.background = hex;
      badge.style.color = textColor(hex);
      savePriorities(defs);
      renderPriorityMenu();
      renderTasks();
    });

    const pickBtn=popup.querySelector('.pickColorBtn'); pickBtn.style.background=p.color; pickBtn.style.color=textColor(p.color);
    pickBtn.addEventListener('click', e=>{
      e.stopPropagation();
      pickCustomColor(p.color, hex=>{
        p.color = hex;
        badge.style.background = hex;
        badge.style.color = textColor(hex);
        pickBtn.style.background = hex;
        pickBtn.style.color = textColor(hex);
        savePriorities(defs);
        renderPriorityMenu();
        renderTasks();
      }, pickBtn);
    });

    const nameInput=popup.querySelector('input');
    nameInput.addEventListener('input', ()=>{
      p.name=nameInput.value.trim();
      badge.textContent=p.name||'';
      savePriorities(defs);
      renderPriorityMenu();
      renderTasks();
    });

    const delBtn = popup.querySelector('.btn-danger');
    delBtn.addEventListener('click', ()=>{
      // 'none' silinemez güvenlik için
      if(p.key==='none'){ showToast('Varsayılan "Yok" önceliği silinemez.'); return; }
      defs.splice(i,1); savePriorities(defs);
      renderPriorityManager(); renderPriorityMenu(); renderTasks();
    });

    badge.addEventListener('click',()=>{ popup.style.display=(popup.style.display==='block'?'none':'block'); });

    listEl.appendChild(wrap);
  });
}

/* ===================== EDIT MODAL ===================== */
const editForm     = document.getElementById('editForm');
const editTitle    = document.getElementById('editTitle');
const editDesc     = document.getElementById('editDesc');
const editDate     = document.getElementById('editDate');
const editPriority = document.getElementById('editPriority');
const editReminder = document.getElementById('editReminder');

const editDropdown   = document.getElementById('editCategoryDropdown');
const editChips      = editDropdown.querySelector('.chips');
const editMenu       = editDropdown.querySelector('.dropdown-menu');

const subtaskList    = document.getElementById('subtaskList');
const subtaskProgressLbl= document.getElementById('subtaskProgress');
const newSubtaskText = document.getElementById('newSubtaskText');
const addSubtaskBtn  = document.getElementById('addSubtaskBtn');

const commentList    = document.getElementById('commentList');
const newCommentText = document.getElementById('newCommentText');
const addCommentBtn  = document.getElementById('addCommentBtn');

let editIndex = null, editSelectedCategories=[], editSubtasks=[], editComments=[];

function renderEditPriorityOptions(selectedVal){
  if(!editPriority) return;
  const defs = getPriorities() || [];
  editPriority.innerHTML = defs.map(p=>`<option value="${p.key}">${escapeHtml(p.name)}</option>`).join('');
  editPriority.value = selectedVal || editPriority.value || 'none';
}

function openEditModal(task, index){
  editIndex=index;
  editTitle.value=task.title||'';
  editDesc.value =task.desc||'';
  editDate.value =task.date||'';
  renderEditPriorityOptions(task.priority||'none');
  editReminder.value= task.reminderAt ? toLocalInputValue(new Date(task.reminderAt)) : '';

  editSelectedCategories=Array.isArray(task.categories)?[...task.categories]:[{name:'Genel',color:'#6c757d'}];
  editSubtasks=Array.isArray(task.subtasks)?JSON.parse(JSON.stringify(task.subtasks)):[];
  editComments=Array.isArray(task.comments)?JSON.parse(JSON.stringify(task.comments)):[];
  renderEditDropdown(); renderSubtasks(); renderComments();
  editModal.show();
}

editForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const tasks=getTasks(); const t=tasks[editIndex];
  t.title=(editTitle.value||'').trim();
  t.desc =(editDesc.value||'').trim();
  t.date =editDate.value||'';
  t.priority=editPriority.value||'none';
  t.categories=[...editSelectedCategories];
  t.subtasks=[...editSubtasks];
  t.comments=[...editComments];
  const rem= editReminder.value ? new Date(editReminder.value) : null;
  if(rem){ t.reminderAt=rem.toISOString(); t.reminderFired=false; await ensureNotifyPermission(); }
  else { t.reminderAt=null; t.reminderFired=false; }
  saveTasks(tasks); editModal.hide(); renderTasks();
});

function renderEditDropdown(){
  editMenu.innerHTML=''; editChips.innerHTML='';
  // Menü kapanmasın
  ['click','mousedown'].forEach(ev => editMenu.addEventListener(ev, e => e.stopPropagation()));

  getCategories().forEach(cat=>{
    const item=document.createElement('div'); item.className='dropdown-item';
    item.innerHTML=`<div class="form-check"><input class="form-check-input" type="checkbox" id="edit-cat-${cat.name}"><label class="form-check-label" for="edit-cat-${cat.name}">${cat.name}</label></div>`;
    const checked=editSelectedCategories.find(c=>c.name===cat.name); setTimeout(()=>{ item.querySelector('input').checked=!!checked; },0);
    item.addEventListener('click', e=>{
      e.preventDefault(); e.stopPropagation();
      if(e.target.tagName!=='INPUT') item.querySelector('input').checked=!item.querySelector('input').checked;
      toggleEditCat(cat); renderEditDropdown();
    });
    editMenu.appendChild(item);
  });
  editSelectedCategories.forEach(cat=>{
    const span=document.createElement('span'); span.textContent=cat.name; span.style.background=cat.color;
    const btn=document.createElement('button'); btn.type='button'; btn.textContent='×';
    btn.onclick=()=>{ editSelectedCategories=editSelectedCategories.filter(c=>c.name!==cat.name); renderEditDropdown(); };
    span.appendChild(btn); editChips.appendChild(span);
  });
}
function toggleEditCat(cat){
  const exists=editSelectedCategories.find(c=>c.name===cat.name);
  if(exists) editSelectedCategories=editSelectedCategories.filter(c=>c.name!==cat.name);
  else editSelectedCategories.push(cat);
}

addSubtaskBtn.addEventListener('click', ()=>{
  const text=(newSubtaskText.value||'').trim(); if(!text) return;
  editSubtasks.push({id:genId('s'), text, done:false}); newSubtaskText.value=''; renderSubtasks();
});
function renderSubtasks(){
  subtaskList.innerHTML=''; editSubtasks.forEach((s,idx)=>{
    const row=document.createElement('div'); row.className='subtask-item';
    row.innerHTML=`<input class="form-check-input me-2 st-toggle" type="checkbox" ${s.done?'checked':''}>
      <span class="flex-grow-1 ${s.done?'text-decoration-line-through text-muted':''}">${escapeHtml(s.text)}</span>
      <button class="btn btn-sm btn-outline-secondary me-1 st-edit rounded-pill"><i class="bi bi-pencil-square"></i></button>
      <button class="btn btn-sm btn-outline-danger st-del rounded-pill"><i class="bi bi-x-lg"></i></button>`;
    row.querySelector('.st-toggle').addEventListener('change', e=>{ editSubtasks[idx].done=e.target.checked; renderSubtasks(); });
    row.querySelector('.st-edit').addEventListener('click', ()=>{ const val=prompt('Alt görev düzenle:', editSubtasks[idx].text); if(val!==null){ editSubtasks[idx].text=val.trim(); renderSubtasks(); } });
    row.querySelector('.st-del').addEventListener('click', ()=>{ editSubtasks.splice(idx,1); renderSubtasks(); });
    subtaskList.appendChild(row);
  });
  const total=editSubtasks.length, done=editSubtasks.filter(x=>x.done).length, pct= total?Math.round(done/total*100):0;
  subtaskProgressLbl.textContent= total? `${done}/${total} tamamlandı (%${pct})` : '';
}

addCommentBtn.addEventListener('click', ()=>{
  const txt=(newCommentText.value||'').trim(); if(!txt) return;
  editComments.push({id:genId('c'), text:txt, ts:Date.now()}); newCommentText.value=''; renderComments();
});
function renderComments(){
  commentList.innerHTML=''; editComments.slice().reverse().forEach(c=>{
    const item=document.createElement('div'); item.className='list-group-item d-flex justify-content-between align-items-start';
    item.innerHTML=`<div class="me-2"><div>${escapeHtml(c.text)}</div><small class="text-muted">${new Date(c.ts).toLocaleString()}</small></div>
                    <button class="btn btn-sm btn-outline-danger rounded-pill"><i class="bi bi-trash-fill"></i></button>`;
    item.querySelector('button').addEventListener('click', ()=>{ editComments=editComments.filter(x=>x.id!==c.id); renderComments(); });
    commentList.appendChild(item);
  });
}

/* ===================== COLOR PICKER ===================== */
let _pickerPopover=null, _lastPointer={x:window.innerWidth/2,y:window.innerHeight/2}, _pickerTrigger=null, _lastPickedColor=null;
document.addEventListener('pointerdown', e=>{ _lastPointer={x:e.clientX,y:e.clientY}; }, true);
window.addEventListener('click', e=>{ if(_pickerPopover && !_pickerPopover.contains(e.target) && !e.target.classList.contains('color-option') && !e.target.classList.contains('mini-dot')) closePickerPopover(); }, true);
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closePickerPopover(); }, true);

function closePickerPopover(){
  if(_pickerPopover){
    _pickerPopover.remove(); _pickerPopover=null;
    if(_lastPickedColor){
      pushRecentColor(_lastPickedColor);
      if(_pickerTrigger){ _pickerTrigger.style.background=_lastPickedColor; _pickerTrigger.style.color='#fff'; }
      renderMiniPalette(); renderCategoryManager();
      if(document.getElementById('priorityModal')) renderPriorityManager();
    }
    _pickerTrigger=null; _lastPickedColor=null;
  }
}
function pickCustomColor(startHex, onPick, triggerEl){
  closePickerPopover();
  const valid=/^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(startHex||''); const init=(valid?startHex:'#0d6efd').toLowerCase();
  _pickerTrigger=triggerEl||null; _lastPickedColor=null;
  const container=document.querySelector('.modal.show')||document.body;
  const pop=document.createElement('div'); pop.className='picker-popover'; pop.style.left=_lastPointer.x+'px'; pop.style.top=_lastPointer.y+'px';
  pop.innerHTML=`<div class="picker-row"><input type="color" value="${init}"><input type="text" value="${init}" maxlength="7" /></div>`;
  container.appendChild(pop); _pickerPopover=pop;
  const colorInput=pop.querySelector('input[type="color"]'); const hexInput=pop.querySelector('input[type="text"]');
  const apply=hex=>{ _lastPickedColor=hex; onPick(hex); };
  colorInput.addEventListener('input', e=>{ const v=e.target.value.toLowerCase(); hexInput.value=v; apply(v); });
  hexInput.addEventListener('input', e=>{
    let v=e.target.value.trim(); if(!v.startsWith('#')) v='#'+v;
    if(/^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(v)){ colorInput.value=v; apply(v.toLowerCase()); }
  });
  setTimeout(()=>hexInput.focus(),0);
}

/* ===================== BULK / SORT / SHORTCUTS ===================== */
function selectedCountIn(which){
  const tasks=getTasks(); const ids=tasks.filter(t=>which==='active'?!t.done:t.done).map(t=>t.id);
  let c=0; ids.forEach(id=>{ if(selectedIds.has(id)) c++; }); return c;
}
function updateActionButtons(){
  const actHas=selectedCountIn('active')>0; activeCompleteBtn.disabled=!actHas; activeDeleteBtn.disabled=!actHas;
  const doneHas=selectedCountIn('done')>0; doneUncompleteBtn.disabled=!doneHas; doneDeleteBtn.disabled=!doneHas;
}
function selectAll(which){ const tasks=getTasks(); tasks.forEach(t=>{ if((which==='active'&&!t.done)||(which==='done'&&t.done)) selectedIds.add(t.id); }); renderTasks(); }
function clearSelection(which){ const tasks=getTasks(); tasks.forEach(t=>{ if((which==='active'&&!t.done)||(which==='done'&&t.done)) selectedIds.delete(t.id); }); renderTasks(); }

activeSelectAll.addEventListener('click', ()=>selectAll('active'));
activeClearSel.addEventListener('click', ()=>clearSelection('active'));
doneSelectAll.addEventListener('click', ()=>selectAll('done'));
doneClearSel.addEventListener('click', ()=>clearSelection('done'));

activeCompleteBtn.addEventListener('click', ()=>{ const tasks=getTasks(); tasks.forEach(t=>{ if(selectedIds.has(t.id)&&!t.done) t.done=true; }); saveTasks(tasks); renderTasks(); });
activeDeleteBtn.addEventListener('click', ()=>{ const tasks=getTasks().filter(t=>!(selectedIds.has(t.id)&&!t.done)); saveTasks(tasks); renderTasks(); });
doneUncompleteBtn.addEventListener('click', ()=>{ const tasks=getTasks(); tasks.forEach(t=>{ if(selectedIds.has(t.id)&&t.done) t.done=false; }); saveTasks(tasks); renderTasks(); });
doneDeleteBtn.addEventListener('click', ()=>{ const tasks=getTasks().filter(t=>!(selectedIds.has(t.id)&&t.done)); saveTasks(tasks); renderTasks(); });

function dateValue(t){ return t.date ? new Date(t.date).getTime() : Number.POSITIVE_INFINITY; }
function leftValue(t){ return getDaysLeftNum(t.date); }
function sortTasks(type){
  const tasks=getTasks(); const active=tasks.filter(t=>!t.done), done=tasks.filter(t=>t.done);
  const cmp={ 'date-asc':(a,b)=>dateValue(a)-dateValue(b), 'date-desc':(a,b)=>dateValue(b)-dateValue(a),
              'left-asc':(a,b)=>leftValue(a)-leftValue(b), 'left-desc':(a,b)=>leftValue(b)-leftValue(a) }[type] || ((a,b)=>dateValue(a)-dateValue(b));
  active.sort(cmp); done.sort(cmp); saveTasks([...active,...done]); renderTasks();
}

function visibleTaskIds(){ const ids=[]; document.querySelectorAll('#activeList .taskItem, #doneList .taskItem').forEach(li=>ids.push(li.dataset.id)); return ids; }
function attachRowKeyFocusHandlers(){ if(!focusTaskId){ const first=document.querySelector('.taskItem'); if(first){ focusTaskId=first.dataset.id; highlightFocus(focusTaskId); } } else { highlightFocus(focusTaskId); } }
document.addEventListener('keydown', e=>{
  const inModal=document.querySelector('.modal.show'); if(inModal){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='enter'){ e.preventDefault(); document.getElementById('saveEditBtn').click(); }
    return;
  }
  if(e.target.matches('input, textarea')) return;
  const ids=visibleTaskIds(); const idx=ids.indexOf(focusTaskId);
  if(e.key==='ArrowDown'){ e.preventDefault(); const next=ids[Math.min(idx+1, ids.length-1)]||ids[0]; focusTaskId=next; highlightFocus(next); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); const prev=ids[Math.max(idx-1,0)]||ids[0]; focusTaskId=prev; highlightFocus(prev); }
  else if(e.key.toLowerCase()==='n'){ e.preventDefault(); document.getElementById('taskTitle').focus(); }
  else if(e.key.toLowerCase()==='e'){ e.preventDefault(); const tasks=getTasks(); let targetId=[...selectedIds][0]||focusTaskId||(ids[0]||null); if(!targetId) return; const index=tasks.findIndex(t=>t.id===targetId); if(index>-1) openEditModal(tasks[index], index); }
  else if(e.key===' '){
    e.preventDefault(); const tasks=getTasks();
    if(selectedIds.size>0){ tasks.forEach(t=>{ if(selectedIds.has(t.id)) t.done=!t.done; }); }
    else if(focusTaskId){ const i=tasks.findIndex(t=>t.id===focusTaskId); if(i>-1) tasks[i].done=!tasks[i].done; }
    saveTasks(tasks); renderTasks();
  }
  else if(e.key==='Delete' || e.key==='Backspace'){
    e.preventDefault(); const tasks=getTasks(); let result=tasks;
    if(selectedIds.size>0){ result=tasks.filter(t=>!selectedIds.has(t.id)); selectedIds.clear(); }
    else if(focusTaskId){ result=tasks.filter(t=>t.id!==focusTaskId); focusTaskId=null; }
    saveTasks(result); renderTasks();
  }
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){ e.preventDefault(); selectAll('active'); selectAll('done'); }
});

function toLocalInputValue(d){ const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

/* ===================== Subtasks Modal ===================== */
function openSubtasksModal(task, index){
  subtasksTaskIndex = index;
  document.getElementById('subtasksModalTitle').textContent = task.title || 'Görev';
  renderSubtasksModalList();
  subtasksModal.show();
}
function renderSubtasksModalList(){
  const listEl = document.getElementById('subtasksModalList');
  const txtEl  = document.getElementById('subtasksModalProgressText');
  const barEl  = document.getElementById('subtasksModalProgressBar');

  const tasks = getTasks();
  const t = tasks[subtasksTaskIndex];
  const subs = Array.isArray(t.subtasks) ? [...t.subtasks] : [];

  const undone = subs.filter(s=>!s.done);
  const done   = subs.filter(s=> s.done);
  const ordered = [...undone, ...done];

  listEl.innerHTML = '';
  ordered.forEach((s)=>{
    const item = document.createElement('label');
    item.className = 'list-group-item d-flex align-items-center';
    if(s.done) item.classList.add('done-line');

    item.innerHTML = `
      <input class="form-check-input me-3 subtask-check" type="checkbox" ${s.done?'checked':''}>
      <span class="flex-grow-1">${escapeHtml(s.text||'')}</span>
    `;

    const input = item.querySelector('.subtask-check');
    input.addEventListener('change', ()=>{
      const realIdx = t.subtasks.findIndex(x=>x.id===s.id);
      if(realIdx>-1){
        t.subtasks[realIdx].done = input.checked;
        saveTasks(tasks);
        renderSubtasksModalList();
        renderTasks();
      }
    });

    listEl.appendChild(item);
  });

  const total = subs.length;
  const doneCount = subs.filter(x=>x.done).length;
  const pct = total ? Math.round(doneCount/total*100) : 0;
  txtEl.textContent = total ? `${doneCount}/${total} tamamlandı (%${pct})` : 'Alt görev yok';
  barEl.style.width = pct + '%';
  barEl.setAttribute('aria-valuenow', String(pct));
}

/* ===================== Comments Modal ===================== */
function openCommentsModal(task, index){
  commentsTaskIndex = index;
  document.getElementById('commentsModalTitle').textContent = task.title || 'Görev';
  renderCommentsModalList();
  commentsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commentsModal'));
  commentsModal.show();
}
function renderCommentsModalList(){
  const listEl = document.getElementById('commentsModalList');
  const tasks = getTasks();
  const t = tasks[commentsTaskIndex];
  const comments = Array.isArray(t.comments) ? [...t.comments] : [];

  comments.sort((a,b)=> (b.ts||0) - (a.ts||0));

  listEl.innerHTML = '';
  comments.forEach(c=>{
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-start';
    item.innerHTML = `
      <div class="me-2">
        <div>${escapeHtml(c.text||'')}</div>
        <small class="text-muted">${c.ts ? new Date(c.ts).toLocaleString() : ''}</small>
      </div>
    `;
    listEl.appendChild(item);
  });

  if(comments.length === 0){
    const empty = document.createElement('div');
    empty.className = 'list-group-item text-muted';
    empty.textContent = 'Henüz yorum yok.';
    listEl.appendChild(empty);
  }
}
function addCommentFromModal(){
  const input = document.getElementById('commentsModalInput');
  const text = (input.value || '').trim();
  if(!text || commentsTaskIndex === null) return;

  const tasks = getTasks();
  const t = tasks[commentsTaskIndex];
  if(!Array.isArray(t.comments)) t.comments = [];

  t.comments.push({ id: genId('c'), text, ts: Date.now() });
  saveTasks(tasks);

  input.value = '';
  renderCommentsModalList();
  renderTasks(); // başlıktaki yorum sayacı güncellensin
}