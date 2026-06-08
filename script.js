// script.js
const STORAGE_KEY = 'ondemand_app_data';

let state = {
  activeTab: 'tasks',
  courses: [],
  tasks: [],
  showAddCourse: false,
  courseNameInput: '',
  courseDescInput: '',
  activeCourseId: null,
  editingCourseId: null,
  editCourseDesc: ''
};

// Generate UUID-like short ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Load from local storage
let storageCrashed = false;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.courses = parsed.courses || [];
      state.tasks = (parsed.tasks || []).map(t => ({
        ...t,
        lectureName: t.lectureName || '無題の講義',
        isSelfDeadline: t.isSelfDeadline !== undefined ? t.isSelfDeadline : (t.deadlineType === 'self')
      }));
    }
  } catch(e) {
    console.error('Failed to access localStorage:', e);
    storageCrashed = true;
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      courses: state.courses,
      tasks: state.tasks
    }));
  } catch (e) {
    console.error('Failed to set localStorage:', e);
    if (!storageCrashed) {
      alert("プレビュー環境の制限等によりデータが保存できませんでした。新しいタブで開くことをお勧めします。");
      storageCrashed = true;
    }
  }
}

// Actions
function setActiveTab(tab) {
  state.activeTab = tab;
  render();
}

function addCourse() {
  if (!state.courseNameInput.trim()) return;
  state.courses.push({
    id: generateId(),
    name: state.courseNameInput,
    description: state.courseDescInput
  });
  state.courseNameInput = '';
  state.courseDescInput = '';
  state.showAddCourse = false;
  saveData();
  render();
}

function deleteCourse(id) {
  if (confirm('この科目を削除しますか？関連するタスクもすべて削除されます。')) {
    state.courses = state.courses.filter(c => c.id !== id);
    state.tasks = state.tasks.filter(t => t.courseId !== id);
    saveData();
    render();
  }
}

function toggleTaskCompletion(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveData();
    render();
  }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveData();
  render();
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ courses: state.courses, tasks: state.tasks }));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "ondemand_backup.json");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function importData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.courses && parsed.tasks) {
      state.courses = parsed.courses;
      state.tasks = parsed.tasks;
      saveData();
      render();
      alert("データのインポートに成功しました");
    } else {
      alert("無効なデータ形式です");
    }
  } catch(e) {
    alert("データの読み込みに失敗しました");
  }
}

function formatTaskDate(isoString) {
  const d = new Date(isoString);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return `${m}/${day} (${w})`;
  }
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${m}/${day} (${w}) ${h}:${min}`;
}

const typeLabels = {
  delivery: '配信日',
  watch: '視聴期限',
  assignment: '課題期限'
};

function isPastButNotToday(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return false;
  return d < now;
}

function isTodayDate(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

// Rendering UI
function render() {
  renderNav();
  
  const appEl = document.getElementById('app');
  let html = '';

  if (state.activeTab === 'tasks') {
    html = renderTasksTab();
  } else if (state.activeTab === 'courses') {
    html = renderCoursesTab();
  } else if (state.activeTab === 'settings') {
    html = renderSettingsTab();
  } else {
    state.activeTab = 'tasks';
    html = renderTasksTab();
  }

  appEl.innerHTML = html;
  
  // Create icons after innerHTML
  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderNav() {
  const mobileNav = document.getElementById('mobile-nav');
  const desktopNav = document.getElementById('desktop-nav');

  const tabs = [
    { id: 'tasks', label: 'タスク', icon: 'clock' },
    { id: 'courses', label: '科目管理', icon: 'book-open' },
    { id: 'settings', label: '設定', icon: 'settings' }
  ];

  mobileNav.innerHTML = tabs.map(t => {
    const active = state.activeTab === t.id;
    return `
      <button onclick="setActiveTab('${t.id}')" class="flex flex-col items-center gap-1 p-2 w-full transition-colors rounded-xl ${active ? 'text-blue-600' : 'text-slate-500 hover:bg-slate-50'}">
        <i data-lucide="${t.icon}" class="w-6 h-6"></i>
        <span class="text-[10px] font-bold">${t.label}</span>
      </button>
    `;
  }).join('');

  desktopNav.innerHTML = `
    <div class="px-6 pb-6 text-white text-lg font-bold flex items-center gap-2 border-b border-slate-800">
      <i data-lucide="book-open" class="w-6 h-6 text-blue-400"></i>
      <span class="leading-tight">オンデマンド<br/>受講管理</span>
    </div>
    <div class="flex-1 py-4 flex flex-col gap-2 px-4">
      ${tabs.map(t => {
        const active = state.activeTab === t.id;
        const classes = active ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
        return `
        <button onclick="setActiveTab('${t.id}')" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-left ${classes}">
          <i data-lucide="${t.icon}" class="w-5 h-5"></i>
          ${t.id === 'tasks' ? 'タスク (Home)' : t.id === 'courses' ? '科目管理' : '設定とデータ'}
        </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderTasksTab() {
  const grouped = state.courses.map(course => {
    const courseTasks = state.tasks.filter(t => t.courseId === course.id);
    const map = {};
    courseTasks.forEach(t => {
      if (!map[t.lectureName]) map[t.lectureName] = [];
      map[t.lectureName].push(t);
    });
    const lectures = Object.entries(map).map(([name, tasks]) => {
      const order = { delivery: 0, watch: 1, assignment: 2 };
      tasks.sort((a,b) => order[a.type] - order[b.type]);
      return { name, tasks };
    });

    lectures.sort((a,b) => {
      const ea = Math.min(...a.tasks.map(t => new Date(t.date).getTime()));
      const eb = Math.min(...b.tasks.map(t => new Date(t.date).getTime()));
      return ea - eb;
    });

    return { course, lectures };
  }).filter(c => c.lectures.length > 0);

  if (grouped.length === 0) {
    return `
      <div class="flex flex-col gap-4 space-y-2 animate-in fade-in">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="clock" class="w-5 h-5"></i> 講義スケジュール
        </h2>
        <div class="text-center p-8 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
          表示するタスクがありません。科目管理からタスクを追加してください。
        </div>
      </div>
    `;
  }

  const coursesHtml = grouped.map(({course, lectures}) => `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="bg-blue-50/50 border-b border-slate-200 px-4 py-3">
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
           <i data-lucide="book-open" class="w-4 h-4 text-blue-600"></i> ${course.name}
        </h3>
      </div>
      <div class="p-4 flex flex-col gap-4">
        ${lectures.map(lec => `
          <div class="flex flex-col gap-2">
            <h4 class="font-bold text-slate-700 text-sm ml-1">${lec.name}</h4>
            <div class="grid grid-cols-1 gap-2 pl-4 border-l-2 border-slate-100">
              ${lec.tasks.map(task => {
                const isOverdue = !task.completed && task.type !== 'delivery' && isPastButNotToday(task.date);
                const isTodayTask = !task.completed && task.type !== 'delivery' && isTodayDate(task.date);
                
                let checkBtn = '';
                if (task.type !== 'delivery') {
                  const checkColor = task.completed ? "text-slate-400" : isOverdue ? "text-red-500 hover:text-red-600" : "text-blue-600 hover:text-blue-700";
                  const icon = task.completed ? "check-circle" : "circle";
                  checkBtn = `<button onclick="toggleTaskCompletion('${task.id}')" class="transition-colors ${checkColor}"><i data-lucide="${icon}" class="w-5 h-5"></i></button>`;
                } else {
                  checkBtn = `<div class="w-2 h-2 rounded-full bg-slate-300"></div>`;
                }

                const badgeColors = task.type === 'assignment' ? "bg-red-100 text-red-700" :
                                   task.type === 'watch' ? "bg-amber-100 text-amber-700" :
                                   "bg-slate-100 text-slate-700";

                const dateColor = isOverdue && !task.completed ? "text-red-600" :
                                  isTodayTask ? "text-amber-600" : "text-slate-700";

                return `
                <div class="flex items-center gap-3">
                  <div class="flex items-center justify-center w-6 shrink-0">${checkBtn}</div>
                  <div class="flex-1 flex flex-wrap items-center gap-2 text-sm ${task.completed ? 'opacity-50 line-through' : ''}">
                    <span class="font-medium text-xs px-2 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                    <span class="font-bold tabular-nums ${dateColor}">${formatTaskDate(task.date)}</span>
                    ${task.isSelfDeadline ? `<span class="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded shrink-0">自主期限</span>` : ''}
                  </div>
                  <button onclick="deleteTask('${task.id}')" class="text-slate-300 hover:text-red-500 p-1 shrink-0 transition-colors">
                    <i data-lucide="x" class="w-4 h-4"></i>
                  </button>
                </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  return `
    <div class="flex flex-col gap-4 space-y-2 animate-in fade-in">
      <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
        <i data-lucide="clock" class="w-5 h-5"></i> 講義スケジュール
      </h2>
      <div class="flex flex-col gap-6">${coursesHtml}</div>
    </div>
  `;
}

function renderCoursesTab() {
  let addCourseHtml = '';
  if (state.showAddCourse) {
    addCourseHtml = `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 animate-in slide-in-from-top-2">
        <h3 class="font-bold text-slate-700">新規科目の追加</h3>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">科目名</label>
          <input type="text" id="cname" value="${state.courseNameInput}" oninput="state.courseNameInput=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 情報学基礎" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">科目説明 (任意)</label>
          <textarea id="cdesc" oninput="state.courseDescInput=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20" placeholder="例: 第1クォーター 月曜2限">${state.courseDescInput}</textarea>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <button onclick="state.showAddCourse=false;render()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
          <button onclick="addCourse()" class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存する</button>
        </div>
      </div>
    `;
  }

  const listHtml = state.courses.map(course => {
    let descHtml = '';
    if (state.editingCourseId === course.id) {
      descHtml = `
        <div class="mt-2 flex flex-col gap-2 relative z-10 w-full" onclick="event.stopPropagation()">
           <textarea oninput="state.editCourseDesc=this.value" class="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16">${state.editCourseDesc}</textarea>
           <div class="flex gap-2 justify-end">
              <button onclick="state.editingCourseId=null;render()" class="text-xs text-slate-500 hover:text-slate-700 font-medium">キャンセル</button>
              <button onclick="saveCourseDesc('${course.id}')" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold px-3 py-1.5 rounded-md transition-colors">保存する</button>
           </div>
        </div>
      `;
    } else {
      const descText = course.description ? course.description.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '<span class="text-slate-300 italic text-xs">説明なし (クリックで追加)</span>';
      descHtml = `
        <div class="mt-1 group cursor-pointer w-full" onclick="state.editingCourseId='${course.id}'; state.editCourseDesc='${course.description}'; render()">
          <p class="text-sm text-slate-500 whitespace-pre-wrap transition-colors group-hover:text-slate-600">${descText}</p>
        </div>
      `;
    }

    return `
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
        <div class="flex justify-between items-start">
          <div class="flex-1 w-full max-w-[calc(100%-2rem)] pr-2">
            <h3 class="text-lg font-bold text-slate-800 whitespace-normal break-words">${course.name}</h3>
            ${descHtml}
          </div>
          <button onclick="deleteCourse('${course.id}')" class="text-slate-300 hover:bg-red-50 hover:text-red-500 p-1.5 rounded-lg transition-colors shrink-0" aria-label="科目削除">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>
        
        <button onclick="openScheduleAdder('${course.id}')" class="mt-5 border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 font-bold py-2.5 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm">
          <i data-lucide="plus" class="w-4 h-4"></i> スケジュールを追加
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="flex flex-col gap-4 animate-in fade-in">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="book-open" class="w-5 h-5"></i> 登録科目
        </h2>
        <button onclick="state.showAddCourse=true;render()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors">
          <i data-lucide="plus" class="w-4 h-4"></i> 科目を追加
        </button>
      </div>

      ${addCourseHtml}

      ${state.courses.length === 0 && !state.showAddCourse ? `
        <div class="text-center p-8 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
          まだ登録されている科目がありません。
        </div>
      ` : ''}

      <div class="grid grid-cols-1 gap-4">
        ${listHtml}
      </div>
    </div>
  `;
}

function saveCourseDesc(id) {
  const c = state.courses.find(c => c.id === id);
  if (c) {
    c.description = state.editCourseDesc;
    saveData();
  }
  state.editingCourseId = null;
  render();
}

function renderSettingsTab() {
  return `
    <div class="flex flex-col gap-4 animate-in fade-in">
      <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
        <i data-lucide="settings" class="w-5 h-5"></i> 設定・その他
      </h2>
      
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div>
          <h3 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
             <i data-lucide="bell" class="w-4 h-4"></i> 通知設定
          </h3>
          <div class="text-sm text-slate-600 mb-3 leading-relaxed">
             端末のプッシュ通知を許可すると、アプリを開いていなくても期限が近づいた際にリマインドを受け取ることができます。<br/><span class="text-xs text-slate-400">※ブラウザやOSの仕様により、アプリを開いている間のみ機能する場合があります。</span>
          </div>
          <button onclick="requestNotification()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors">
            通知の許可をリクエスト
          </button>
        </div>

        <hr class="border-slate-100" />

        <div>
          <h3 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
             <i data-lucide="alert-circle" class="w-4 h-4"></i> データ管理
          </h3>
          <div class="text-sm text-slate-600 mb-3 leading-relaxed">
             データはログイン不要でブラウザに自動保存されます。機種変更の際などはデータをエクスポートして新しい端末でインポートしてください。
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="exportData()" class="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              <i data-lucide="download" class="w-4 h-4"></i> エクスポート
            </button>
            <label class="flex-1 min-w-[120px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <i data-lucide="upload" class="w-4 h-4"></i> インポート
              <input type="file" accept=".json" class="hidden" onchange="handleImport(event)" />
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    if (ev.target.result) importData(ev.target.result);
  };
  reader.readAsText(file);
  e.target.value = '';
}

function requestNotification() {
  if ("Notification" in window) {
    Notification.requestPermission().then(r => {
       alert(r === 'granted' ? '通知が許可されました。' : '通知が拒否されました。設定から変更してください。');
    });
  } else {
    alert('ご利用のブラウザは通知をサポートしていません。');
  }
}

// ------ SCHEDULE ADDER MODAL ------
let adderConfig = null;

function openScheduleAdder(courseId) {
  const existing = state.tasks.filter(t => t.courseId === courseId).map(t => t.lectureName);
  let max = 0;
  existing.forEach(name => {
    const m = name.match(/第(\d+)回/);
    if (m) {
       const n = parseInt(m[1], 10);
       if (n > max) max = n;
    }
  });

  adderConfig = {
    courseId,
    startNum: max + 1,
    add_mode: 'calendar', // 'calendar' or 'rows'
    calendarDates: [],
    calDeliveryCheck: false,
    calDeliveryTime: '00:00',
    calWatchCheck: true,
    calWatchTime: '23:59',
    calAssignCheck: false,
    calAssignTime: '23:59',
    rows: [
      { id: generateId(), deliveryDate: '', deliveryTime: '', watchDate: '', watchTime: '23:59', assignDate: '', assignTime: '23:59' }
    ],
    isSelfDeadline: false
  };
  
  renderModal();
}

function closeScheduleAdder() {
  adderConfig = null;
  renderModal();
}

function addAdderRow() {
  adderConfig.rows.push({ id: generateId(), deliveryDate: '', deliveryTime: '', watchDate: '', watchTime: '23:59', assignDate: '', assignTime: '23:59' });
  renderModal();
}

function removeAdderRow(id) {
  adderConfig.rows = adderConfig.rows.filter(r => r.id !== id);
  renderModal();
}

function updateRow(id, field, value) {
  const r = adderConfig.rows.find(r => r.id === id);
  if (r) r[field] = value;
}

function switchAdderMode(mode) {
  adderConfig.add_mode = mode;
  renderModal();
}

function updateCalField(field, value) {
  adderConfig[field] = value;
  // Some fields might need re-render if they affect UI state
  if (field.includes('Check')) renderModal();
}

function saveAdderTasks() {
  const newTasks = [];
  
  if (adderConfig.add_mode === 'rows') {
    adderConfig.rows.forEach((r, idx) => {
      const lectureName = `第${adderConfig.startNum + idx}回`;
      if (r.deliveryDate) {
        newTasks.push({
          id: generateId(), courseId: adderConfig.courseId, lectureName, type: 'delivery', 
          date: `${r.deliveryDate}T${r.deliveryTime || '00:00'}:00`, isSelfDeadline: false, completed: false
        });
      }
      if (r.watchDate) {
        newTasks.push({
          id: generateId(), courseId: adderConfig.courseId, lectureName, type: 'watch', 
          date: `${r.watchDate}T${r.watchTime || '23:59'}:00`, isSelfDeadline: adderConfig.isSelfDeadline, completed: false
        });
      }
      if (r.assignDate) {
        newTasks.push({
          id: generateId(), courseId: adderConfig.courseId, lectureName, type: 'assignment', 
          date: `${r.assignDate}T${r.assignTime || '23:59'}:00`, isSelfDeadline: adderConfig.isSelfDeadline, completed: false
        });
      }
    });
  } else {
    // Calendar mode
    if (adderConfig.calendarDates.length === 0) {
      alert("カレンダーで日付を1つ以上選択してください");
      return;
    }
    
    // Sort dates chronologically
    const sortedDates = [...adderConfig.calendarDates].sort((a,b) => new Date(a) - new Date(b));
    
    sortedDates.forEach((dateStr, idx) => {
      const lectureName = `第${adderConfig.startNum + idx}回`;
      if (adderConfig.calDeliveryCheck) {
        newTasks.push({
          id: generateId(), courseId: adderConfig.courseId, lectureName, type: 'delivery', 
          date: `${dateStr}T${adderConfig.calDeliveryTime || '00:00'}:00`, isSelfDeadline: false, completed: false
        });
      }
      if (adderConfig.calWatchCheck) {
        newTasks.push({
          id: generateId(), courseId: adderConfig.courseId, lectureName, type: 'watch', 
          date: `${dateStr}T${adderConfig.calWatchTime || '23:59'}:00`, isSelfDeadline: adderConfig.isSelfDeadline, completed: false
        });
      }
      if (adderConfig.calAssignCheck) {
        newTasks.push({
          id: generateId(), courseId: adderConfig.courseId, lectureName, type: 'assignment', 
          date: `${dateStr}T${adderConfig.calAssignTime || '23:59'}:00`, isSelfDeadline: adderConfig.isSelfDeadline, completed: false
        });
      }
    });
  }

  if (newTasks.length === 0 && adderConfig.add_mode === 'rows') {
    alert("日付を1つ以上設定してください");
    return;
  }
  if (newTasks.length === 0 && adderConfig.add_mode === 'calendar') {
     alert("作成するタスクの種類（視聴期限など）を選択してください");
     return;
  }

  state.tasks.push(...newTasks);
  saveData();
  closeScheduleAdder();
  render();
}

function renderModal() {
  const root = document.getElementById('modal-root');
  if (!adderConfig) {
    root.innerHTML = '';
    return;
  }

  let contentHtml = '';

  if (adderConfig.add_mode === 'rows') {
    const rowsHtml = adderConfig.rows.map((row, idx) => `
      <div class="bg-white border text-sm border-slate-200 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
        <div class="absolute top-0 right-0 bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-bl-xl text-xs">
          第${adderConfig.startNum + idx}回
        </div>
        ${idx > 0 ? `
          <button onclick="removeAdderRow('${row.id}')" class="absolute top-2 right-14 text-slate-400 hover:text-red-500">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : ''}
        <div class="grid grid-cols-[1fr_1fr] md:grid-cols-3 gap-3 w-full mt-4 md:mt-2">
          <div class="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-100 pb-2 md:pb-0 md:pr-3">
            <label class="text-xs font-bold text-slate-600">配信日</label>
            <input type="date" value="${row.deliveryDate}" onchange="updateRow('${row.id}', 'deliveryDate', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-xs" />
            <input type="time" value="${row.deliveryTime}" onchange="updateRow('${row.id}', 'deliveryTime', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-xs" />
          </div>
          <div class="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-100 pb-2 md:pb-0 md:px-3">
            <label class="text-xs font-bold text-slate-600">視聴期限</label>
            <input type="date" value="${row.watchDate}" onchange="updateRow('${row.id}', 'watchDate', this.value)" class="w-full bg-amber-50 border border-amber-200 rounded px-2 py-1 outline-none text-xs" />
            <input type="time" value="${row.watchTime}" onchange="updateRow('${row.id}', 'watchTime', this.value)" class="w-full bg-amber-50 border border-amber-200 rounded px-2 py-1 outline-none text-xs" />
          </div>
          <div class="flex flex-col gap-1 md:pl-3 col-span-2 md:col-span-1">
            <label class="text-xs font-bold text-slate-600">課題提出</label>
            <input type="date" value="${row.assignDate}" onchange="updateRow('${row.id}', 'assignDate', this.value)" class="w-full bg-red-50 border border-red-200 rounded px-2 py-1 outline-none text-xs" />
            <input type="time" value="${row.assignTime}" onchange="updateRow('${row.id}', 'assignTime', this.value)" class="w-full bg-red-50 border border-red-200 rounded px-2 py-1 outline-none text-xs" />
          </div>
        </div>
      </div>
    `).join('');
    
    contentHtml = `
      <div class="p-6 overflow-y-auto bg-slate-50/30 flex flex-col gap-3">
         ${rowsHtml}
         <button onclick="addAdderRow()" class="mt-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-slate-300 rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors">
            <i data-lucide="plus" class="w-4 h-4"></i> 次の講義を追加
         </button>
      </div>
    `;
  } else {
    // Calendar mode HTML
    contentHtml = `
      <div class="flex flex-col md:flex-row p-6 overflow-y-auto bg-slate-50/30 gap-6">
        <div class="flex flex-col gap-2 relative z-10 w-full md:w-auto">
          <p class="text-sm font-bold text-slate-700 flex items-center gap-1.5"><i data-lucide="calendar" class="w-4 h-4"></i> 日付を複数選択</p>
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flatpickr-wrapper">
             <input type="text" id="multi-calendar" class="hidden" />
          </div>
          <p class="text-[11px] text-slate-500 mt-1">※選択した順番に関わらず、日付順に第${adderConfig.startNum}回〜が割り当てられます。</p>
        </div>
        
        <div class="flex-1 flex flex-col gap-4">
           <p class="text-sm font-bold text-slate-700 mt-2 md:mt-0 flex items-center gap-1.5"><i data-lucide="settings-2" class="w-4 h-4"></i> 一括設定 (選択した全日に適用)</p>
           
           <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4">
             <!-- Delivery -->
             <div class="flex items-center gap-3">
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${adderConfig.calDeliveryCheck ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}">
                    ${adderConfig.calDeliveryCheck ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                  </div>
                  <input type="checkbox" onchange="updateCalField('calDeliveryCheck', this.checked)" class="sr-only" ${adderConfig.calDeliveryCheck ? 'checked' : ''} />
                  <span class="text-xs font-bold text-slate-600 select-none">配信日</span>
               </label>
               <input type="time" value="${adderConfig.calDeliveryTime}" onchange="updateCalField('calDeliveryTime', this.value)" class="bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-xs ml-auto w-24 ${!adderConfig.calDeliveryCheck ? 'opacity-50 pointer-events-none' : ''}" />
             </div>
             
             <!-- Watch -->
             <div class="flex items-center gap-3">
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${adderConfig.calWatchCheck ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300 group-hover:border-amber-400'}">
                    ${adderConfig.calWatchCheck ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                  </div>
                  <input type="checkbox" onchange="updateCalField('calWatchCheck', this.checked)" class="sr-only" ${adderConfig.calWatchCheck ? 'checked' : ''} />
                  <span class="text-xs font-bold text-slate-600 select-none">視聴期限</span>
               </label>
               <input type="time" value="${adderConfig.calWatchTime}" onchange="updateCalField('calWatchTime', this.value)" class="bg-amber-50 border border-amber-200 rounded px-2 py-1 outline-none text-xs ml-auto w-24 ${!adderConfig.calWatchCheck ? 'opacity-50 pointer-events-none' : ''}" />
             </div>
             
             <!-- Assign -->
             <div class="flex items-center gap-3">
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${adderConfig.calAssignCheck ? 'bg-red-500 border-red-500' : 'bg-white border-slate-300 group-hover:border-red-400'}">
                    ${adderConfig.calAssignCheck ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                  </div>
                  <input type="checkbox" onchange="updateCalField('calAssignCheck', this.checked)" class="sr-only" ${adderConfig.calAssignCheck ? 'checked' : ''} />
                  <span class="text-xs font-bold text-slate-600 select-none">課題提出</span>
               </label>
               <input type="time" value="${adderConfig.calAssignTime}" onchange="updateCalField('calAssignTime', this.value)" class="bg-red-50 border border-red-200 rounded px-2 py-1 outline-none text-xs ml-auto w-24 ${!adderConfig.calAssignCheck ? 'opacity-50 pointer-events-none' : ''}" />
             </div>
           </div>
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div class="bg-white max-w-3xl w-full rounded-2xl shadow-xl flex flex-col m-auto max-h-[95vh] overflow-hidden border border-slate-200">
        
        <div class="flex flex-col border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div class="flex justify-between items-center p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="bg-blue-100 text-blue-600 p-2 rounded-xl">
                <i data-lucide="calendar-days" class="w-6 h-6"></i>
              </div>
              <div class="flex flex-col">
                <h4 class="font-extrabold text-slate-800 text-lg tracking-tight">スケジュール追加</h4>
                <p class="text-[11px] text-slate-500 font-medium mt-0.5">授業のスケジュールを一括設定または個別に設定できます</p>
              </div>
            </div>
            <button onclick="closeScheduleAdder()" class="text-slate-400 hover:text-slate-600 p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition-colors shadow-sm">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          
          <div class="px-6 flex gap-2 w-full">
            <button onclick="switchAdderMode('calendar')" class="pb-3 px-2 border-b-2 transition-colors text-sm font-bold flex items-center gap-1.5 ${adderConfig.add_mode === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
               <i data-lucide="calendar-plus" class="w-4 h-4"></i> カレンダーで一括作成
            </button>
            <button onclick="switchAdderMode('rows')" class="pb-3 px-2 border-b-2 transition-colors text-sm font-bold flex items-center gap-1.5 ${adderConfig.add_mode === 'rows' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
               <i data-lucide="list-plus" class="w-4 h-4"></i> 個別に行を追加
            </button>
          </div>
        </div>

        ${contentHtml}

        <div class="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <label class="flex items-center gap-3 cursor-pointer group">
              <div class="w-5 h-5 rounded flex items-center justify-center transition-colors border ${adderConfig.isSelfDeadline ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}">
                ${adderConfig.isSelfDeadline ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
              </div>
              <input type="checkbox" onchange="adderConfig.isSelfDeadline=this.checked; renderModal()" class="sr-only" ${adderConfig.isSelfDeadline ? 'checked' : ''} />
              <span class="text-sm font-bold text-slate-700 select-none">
                <span class="text-blue-600">自主的な目標期限</span>として登録する
              </span>
          </label>
          <button onclick="saveAdderTasks()" class="w-full md:w-auto bg-slate-800 text-white font-bold tracking-wide py-2.5 px-8 rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
             <i data-lucide="plus" class="w-4 h-4"></i> タスクを一括生成
          </button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) {
    lucide.createIcons();
  }

  if (adderConfig.add_mode === 'calendar' && typeof window.flatpickr !== 'undefined') {
     flatpickr('#multi-calendar', {
        inline: true,
        mode: "multiple",
        locale: "ja",
        defaultDate: adderConfig.calendarDates,
        onChange: function(selectedDates, dateStr, instance) {
           adderConfig.calendarDates = selectedDates.map(d => {
              const off = d.getTimezoneOffset();
              const adjusted = new Date(d.getTime() - (off*60*1000));
              return adjusted.toISOString().split('T')[0];
           });
        }
     });
  }
}

// Setup background notification checks
function setupNotifications() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const check = () => {
      try {
        if (Notification.permission !== 'granted') return;
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24*3600*1000);
        const upcoming = state.tasks.filter(t => {
          if (t.completed) return false;
          const d = new Date(t.date);
          return d > now && d < tomorrow;
        });

        upcoming.forEach(t => {
          const key = 'notified_' + t.id;
          const last = localStorage.getItem(key);
          if (!last || (now.getTime() - parseInt(last, 10) > 12*3600*1000)) {
            new Notification("期限のリマインダー", { body: 'もうすぐ期限です', icon: '/icon.png' });
            localStorage.setItem(key, now.getTime().toString());
          }
        });
      } catch (e) {
        console.error('Notification check failed:', e);
      }
    };
    check();
    setInterval(check, 3600 * 1000);
  } catch (e) {
    console.error('Setup notifications failed:', e);
  }
}


// Init
loadData();
render();
setupNotifications();
