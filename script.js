// script.js
const STORAGE_KEY = 'ondemand_app_data';

let state = {
  activeTab: 'tasks',
  taskSortMode: 'date', // 'course' or 'date'
  courses: [],
  tasks: [],
  showAddCourse: false,
  courseNameInput: '',
  courseDescInput: '',
  activeCourseId: null,
  editingCourseId: null,
  editCourseName: '',
  editCourseDesc: '',
  editingLecture: null, // { courseId, oldName, newName }
  editingTaskId: null,
  editTaskData: null,
  gcalClientId: '',
  gcalToken: null,
  gcalOptions: [],
  gcalTargetId: 'primary'
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
      if (parsed.gcalClientId) state.gcalClientId = parsed.gcalClientId;
      if (parsed.gcalTargetId) state.gcalTargetId = parsed.gcalTargetId;
      // We don't save the ephemeral token to bypass frequent expiration without refresh token
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
      tasks: state.tasks,
      gcalClientId: state.gcalClientId,
      gcalTargetId: state.gcalTargetId
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
  try {
    const data = JSON.stringify({
      courses: state.courses,
      tasks: state.tasks
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "ondemand_backup.json";
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  } catch (e) {
    alert("エラーが発生しました: " + e.message + "\n\n代わりに「テキストでコピー」を使用してバックアップしてください。");
  }
}

function copyData() {
  const data = JSON.stringify({
    courses: state.courses,
    tasks: state.tasks
  });
  if (navigator.clipboard) {
    navigator.clipboard.writeText(data).then(() => {
      alert("データをクリップボードにコピーしました。テキストファイル等に貼り付けて保存してください。");
    }).catch(() => {
      prompt("以下のテキストをコピーして保存してください:", data);
    });
  } else {
    prompt("以下のテキストをコピーして保存してください:", data);
  }
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

function formatTaskTimeOnly(isoString) {
  const d = new Date(isoString);
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${min}`;
}

function startEditLecture(courseId, name) {
  state.editingLecture = { courseId, oldName: name, newName: name };
  render();
}

function saveLectureName() {
  if (state.editingLecture) {
    const { courseId, oldName, newName } = state.editingLecture;
    if (newName.trim() && newName !== oldName) {
      state.tasks.forEach(t => {
        if (t.courseId === courseId && t.lectureName === oldName) {
          t.lectureName = newName.trim();
        }
      });
      saveData();
    }
  }
  state.editingLecture = null;
  render();
}

function startEditTask(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  const dateObj = new Date(t.date);
  // Get local date/time string correctly formatted
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const mins = dateObj.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${mins}`;

  state.editingTaskId = taskId;
  state.editTaskData = {
    lectureName: t.lectureName,
    type: t.type,
    dateStr: dateStr,
    timeStr: timeStr,
    isSelfDeadline: t.isSelfDeadline
  };
  render();
}

function saveEditTask() {
  const t = state.tasks.find(x => x.id === state.editingTaskId);
  if (t && state.editTaskData) {
    t.lectureName = state.editTaskData.lectureName.trim() || '無題の講義';
    t.type = state.editTaskData.type;
    t.date = `${state.editTaskData.dateStr}T${state.editTaskData.timeStr || '00:00'}:00`;
    t.isSelfDeadline = state.editTaskData.isSelfDeadline;
    saveData();
  }
  state.editingTaskId = null;
  state.editTaskData = null;
  render();
}

function cancelEditTask() {
  state.editingTaskId = null;
  state.editTaskData = null;
  render();
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
  const switchHtml = `
    <div class="flex items-center gap-2 mb-2 bg-slate-100 p-1 rounded-lg w-max ml-auto shadow-inner border border-slate-200/60">
      <button onclick="state.taskSortMode='course'; render()" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all ${state.taskSortMode === 'course' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}">科目別</button>
      <button onclick="state.taskSortMode='date'; render()" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all ${state.taskSortMode === 'date' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}">日付順</button>
    </div>
  `;

  if (state.tasks.length === 0) {
    return `
      <div class="flex flex-col gap-2 animate-in fade-in">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="clock" class="w-5 h-5"></i> 講義スケジュール
        </h2>
        <div class="text-center p-8 mt-4 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
          表示するタスクがありません。科目管理からタスクを追加してください。
        </div>
      </div>
    `;
  }

  let contentHtml = '';

  if (state.taskSortMode === 'course') {
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

    contentHtml = grouped.map(({course, lectures}) => `
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="bg-blue-50/50 border-b border-slate-200 px-4 py-3">
          <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
             <i data-lucide="book-open" class="w-4 h-4 text-blue-600"></i> ${course.name}
          </h3>
        </div>
        <div class="p-4 flex flex-col gap-4">
          ${lectures.map(lec => {
            let editLecHtml = '';
            if (state.editingLecture && state.editingLecture.courseId === course.id && state.editingLecture.oldName === lec.name) {
              editLecHtml = `
                <div class="flex flex-wrap items-center gap-2 mb-2 bg-slate-50 p-2 rounded border border-slate-200">
                   <input type="text" value="${state.editingLecture.newName}" oninput="state.editingLecture.newName=this.value" class="border border-slate-300 rounded px-2 py-1 text-sm outline-none w-32 focus:border-blue-500" />
                   <button onclick="saveLectureName()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors">変更する</button>
                   <button onclick="state.editingLecture=null; render()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded text-xs font-bold transition-colors">キャンセル</button>
                </div>
              `;
            } else {
              editLecHtml = `
                <h4 class="font-bold text-slate-700 text-sm ml-1 flex items-center gap-2 group cursor-pointer hover:text-blue-700 transition-colors w-max" onclick="startEditLecture('${course.id}', '${lec.name}')" title="クリックして名前を編集">
                  ${lec.name}
                  <i data-lucide="edit-2" class="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                </h4>
              `;
            }

            return `
            <div class="flex flex-col gap-2">
              ${editLecHtml}
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

                  const badgeColors = task.type === 'assignment' ? "bg-red-100 text-red-700 border border-red-200" :
                                     task.type === 'watch' ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                     "bg-slate-100 text-slate-700 border border-slate-200";

                  const dateColor = isOverdue && !task.completed ? "text-red-600" :
                                    isTodayTask ? "text-amber-600" : "text-slate-700";

                  if (state.editingTaskId === task.id) {
                    return `
                    <div class="flex flex-col gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg -ml-1.5 transition-colors my-1">
                      <div class="flex flex-wrap gap-2 items-center">
                         <input type="text" value="${state.editTaskData.lectureName}" oninput="state.editTaskData.lectureName=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs w-28 outline-none" placeholder="講義名" />
                         <select onchange="state.editTaskData.type=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs outline-none bg-white">
                           <option value="delivery" ${state.editTaskData.type==='delivery'?'selected':''}>配信日</option>
                           <option value="watch" ${state.editTaskData.type==='watch'?'selected':''}>視聴期限</option>
                           <option value="assignment" ${state.editTaskData.type==='assignment'?'selected':''}>課題提出</option>
                         </select>
                         <input type="date" value="${state.editTaskData.dateStr}" onchange="state.editTaskData.dateStr=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs outline-none w-[110px]" />
                         <input type="time" value="${state.editTaskData.timeStr}" onchange="state.editTaskData.timeStr=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs outline-none w-20" />
                         <label class="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" ${state.editTaskData.isSelfDeadline?'checked':''} onchange="state.editTaskData.isSelfDeadline=this.checked" /> 自主期限</label>
                      </div>
                      <div class="flex justify-end gap-2">
                         <button onclick="cancelEditTask()" class="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded font-bold text-slate-700 transition">キャンセル</button>
                         <button onclick="saveEditTask()" class="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded font-bold text-white transition">保存</button>
                      </div>
                    </div>
                    `;
                  }

                  return `
                  <div class="flex items-center gap-3 group/task hover:bg-slate-50 p-1.5 -ml-1.5 rounded transition-colors">
                    <div class="flex items-center justify-center w-6 shrink-0">${checkBtn}</div>
                    <div class="flex-1 flex flex-wrap items-center gap-2 text-sm ${task.completed ? 'opacity-50 line-through' : ''}">
                      <span class="font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                      <span class="font-bold tabular-nums ${dateColor}">${formatTaskDate(task.date)}</span>
                      ${task.isSelfDeadline ? `<span class="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">自主期限</span>` : ''}
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 md:opacity-100 transition-opacity shrink-0">
                      <button onclick="startEditTask('${task.id}')" class="text-slate-300 hover:text-blue-500 p-1 hover:bg-blue-50 rounded" title="タスク編集">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                      </button>
                      <button onclick="deleteTask('${task.id}')" class="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded" title="タスク削除">
                        <i data-lucide="x" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  } else {
    // taskSortMode === 'date'
    const dateMap = {};
    state.tasks.forEach(task => {
      const d = new Date(task.date);
      const groupKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!dateMap[groupKey]) {
        dateMap[groupKey] = {
           ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
           tasks: []
        };
      }
      dateMap[groupKey].tasks.push(task);
    });

    const groups = Object.values(dateMap);
    groups.sort((a,b) => a.ts - b.ts);

    contentHtml = groups.map(g => {
      const d = new Date(g.ts);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const w = ['日','月','火','水','木','金','土'][d.getDay()];
      const headerStr = `${m}月${day}日 (${w})`;
      
      const nowTs = new Date().setHours(0,0,0,0);
      const isPast = g.ts < nowTs;
      const isToday = g.ts === nowTs;
      const headerColors = isPast ? 'text-slate-600 bg-slate-100 border-slate-200 opacity-80' : isToday ? 'text-blue-800 bg-blue-100 border-blue-200 shadow-sm' : 'text-slate-700 bg-slate-50 border-slate-200';

      g.tasks.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 last:mb-0">
           <div class="${headerColors} border-b px-4 py-2 font-bold text-sm tracking-wide">
             ${headerStr} ${isToday ? '<span class="ml-2 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Today</span>' : ''}
           </div>
           <div class="flex flex-col divide-y divide-slate-100">
             ${g.tasks.map(task => {
                const course = state.courses.find(c => c.id === task.courseId) || { name: '不明な科目' };
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

                const badgeColors = task.type === 'assignment' ? "bg-red-100 text-red-700 border border-red-200" :
                                   task.type === 'watch' ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                   "bg-slate-100 text-slate-700 border border-slate-200";

                const dateColor = isOverdue && !task.completed ? "text-red-600" :
                                  isTodayTask ? "text-amber-600" : "text-slate-700";

                if (state.editingTaskId === task.id) {
                    return `
                    <div class="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-100 transition-colors">
                      <div class="flex flex-wrap gap-2 items-center">
                         <input type="text" value="${state.editTaskData.lectureName}" oninput="state.editTaskData.lectureName=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs w-28 outline-none" placeholder="講義名" />
                         <select onchange="state.editTaskData.type=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs outline-none bg-white">
                           <option value="delivery" ${state.editTaskData.type==='delivery'?'selected':''}>配信日</option>
                           <option value="watch" ${state.editTaskData.type==='watch'?'selected':''}>視聴期限</option>
                           <option value="assignment" ${state.editTaskData.type==='assignment'?'selected':''}>課題提出</option>
                         </select>
                         <input type="date" value="${state.editTaskData.dateStr}" onchange="state.editTaskData.dateStr=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs outline-none w-[110px]" />
                         <input type="time" value="${state.editTaskData.timeStr}" onchange="state.editTaskData.timeStr=this.value" class="border border-slate-300 rounded px-2 py-1 text-xs outline-none w-20" />
                         <label class="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" ${state.editTaskData.isSelfDeadline?'checked':''} onchange="state.editTaskData.isSelfDeadline=this.checked" /> 自主期限</label>
                      </div>
                      <div class="flex justify-end gap-2 mt-1">
                         <button onclick="cancelEditTask()" class="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded font-bold text-slate-700 transition">キャンセル</button>
                         <button onclick="saveEditTask()" class="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded font-bold text-white transition">保存</button>
                      </div>
                    </div>
                    `;
                }

                return `
                <div class="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors group/task">
                  <div class="flex items-center justify-center w-6 shrink-0">${checkBtn}</div>
                  <div class="flex-1 flex flex-col gap-1 ${task.completed ? 'opacity-50 line-through' : ''}">
                    <div class="flex flex-wrap items-center gap-2 text-sm">
                      <span class="font-bold text-slate-700 text-xs truncate max-w-[150px]" title="${course.name}">${course.name}</span>
                      <span class="text-slate-500 text-xs border-l border-slate-300 pl-2">${task.lectureName}</span>
                      <span class="font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                      ${task.isSelfDeadline ? `<span class="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">自主期限</span>` : ''}
                    </div>
                    <div class="text-xs font-bold tabular-nums flex items-center gap-1.5 ${dateColor}">
                      <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                      ${task.date.includes('T00:00:00') && task.type === 'delivery' ? '時間未定' : formatTaskTimeOnly(task.date)}
                    </div>
                  </div>
                  <div class="flex flex-col sm:flex-row items-center gap-1 opacity-0 group-hover/task:opacity-100 md:opacity-100 transition-opacity shrink-0">
                    <button onclick="startEditTask('${task.id}')" class="text-slate-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded" title="タスク編集">
                      <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteTask('${task.id}')" class="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded" title="タスク削除">
                      <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>
                `;
             }).join('')}
           </div>
        </div>
      `;
    }).join('');
  }

  return `
    <div class="flex flex-col gap-2 animate-in fade-in">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="clock" class="w-5 h-5"></i> 講義スケジュール
        </h2>
        ${switchHtml}
      </div>
      <div class="flex flex-col gap-4">${contentHtml}</div>
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
    let headerAndDescHtml = '';
    if (state.editingCourseId === course.id) {
      headerAndDescHtml = `
        <div class="flex flex-col gap-2 relative z-10 w-full" onclick="event.stopPropagation()">
           <label class="text-xs font-bold text-slate-500">科目名</label>
           <input type="text" oninput="state.editCourseName=this.value" value="${state.editCourseName}" class="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
           <label class="text-xs font-bold text-slate-500 mt-1">科目説明</label>
           <textarea oninput="state.editCourseDesc=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20">${state.editCourseDesc}</textarea>
           <div class="flex gap-2 justify-end mt-2">
              <button onclick="state.editingCourseId=null;render()" class="text-xs text-slate-600 hover:bg-slate-100 font-medium px-4 py-2 rounded-lg transition-colors">キャンセル</button>
              <button onclick="saveCourseEdit('${course.id}')" class="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors">保存する</button>
           </div>
        </div>
      `;
    } else {
      const descText = course.description ? course.description.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '<span class="text-slate-400 italic text-xs">説明なし</span>';
      headerAndDescHtml = `
        <div class="flex-1 w-full max-w-[calc(100%-2rem)] pr-2 group cursor-pointer" onclick="state.editingCourseId='${course.id}'; state.editCourseName='${course.name.replace(/'/g, "\\'")}'; state.editCourseDesc='${(course.description || '').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'; render()">
           <div class="flex items-center gap-2">
             <h3 class="text-lg font-bold text-slate-800 whitespace-normal break-words">${course.name}</h3>
             <i data-lucide="edit-2" class="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0"></i>
           </div>
           <div class="mt-1 w-full">
             <p class="text-sm text-slate-500 whitespace-pre-wrap transition-colors group-hover:text-slate-600">${descText}</p>
           </div>
        </div>
      `;
    }

    return `
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
        <div class="flex justify-between items-start">
          ${headerAndDescHtml}
          ${state.editingCourseId !== course.id ? `
          <button onclick="deleteCourse('${course.id}')" class="text-slate-300 hover:bg-red-50 hover:text-red-500 p-1.5 rounded-lg transition-colors shrink-0" aria-label="科目削除">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
          ` : ''}
        </div>
        
        ${state.editingCourseId !== course.id ? `
        <button onclick="openScheduleAdder('${course.id}')" class="mt-5 border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 font-bold py-2.5 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm">
          <i data-lucide="plus" class="w-4 h-4"></i> スケジュールを追加
        </button>
        ` : ''}
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

function saveCourseEdit(id) {
  const c = state.courses.find(c => c.id === id);
  if (c) {
    if (state.editCourseName.trim()) {
      c.name = state.editCourseName.trim();
    }
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
          <h3 class="font-bold text-slate-700 text-sm mb-2 mt-2 flex items-center gap-2">
             <i data-lucide="calendar" class="w-4 h-4 text-green-600"></i> Googleカレンダー自動登録
          </h3>
          <p class="text-xs text-slate-500 mb-4 leading-relaxed">
             Google Calendar APIを使用して、スケジュールを直接カレンダーに登録します。<br/>
             連携には <a href="https://console.cloud.google.com/" target="_blank" class="text-blue-600 underline">Google Cloud Console</a> で取得したOAuth 2.0 クライアントIDが必要です。
          </p>
          <div class="flex flex-col gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">Google OAuth クライアントID</label>
                <input type="text" id="gcal_client_id" value="${state.gcalClientId || ''}" onchange="state.gcalClientId=this.value; saveData();" placeholder="例: xxx.apps.googleusercontent.com" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
             </div>
             
             ${state.gcalToken ? `
               <div class="flex items-center gap-2 text-xs mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <i data-lucide="check-circle-2" class="w-4 h-4 text-green-600"></i>
                  <span class="text-green-700 font-bold">Googleカレンダー連携済み</span>
                  <button onclick="gcalLogout()" class="ml-auto text-slate-500 hover:text-red-600 transition-colors bg-white px-2 py-1 rounded border border-slate-200">連携解除</button>
               </div>
               
               <div class="mt-2">
                  <label class="text-xs font-bold text-slate-600 mb-1 block">登録先カレンダー</label>
                  <select id="gcal_target_id" onchange="state.gcalTargetId=this.value; saveData();" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                     <option value="primary">メインカレンダー (デフォルト)</option>
                     ${state.gcalOptions ? state.gcalOptions.map(opt => `<option value="${opt.id}" ${state.gcalTargetId === opt.id ? 'selected' : ''}>${opt.summary}</option>`).join('') : ''}
                  </select>
               </div>
               
               <button onclick="exportToGoogleCalendar()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm w-full mt-2">
                  <i data-lucide="cloud-upload" class="w-4 h-4"></i> 未完了タスクをGoogleカレンダーに登録
               </button>
             ` : `
               <button onclick="gcalLogin()" class="mt-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2.5 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center gap-2 transition-colors">
                 <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5"> Google アカウントでログイン
               </button>
             `}
          </div>

          <h3 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2 border-t border-slate-100 pt-6">
             <i data-lucide="calendar" class="w-4 h-4 text-blue-600"></i> 手動カレンダーエクスポート (.ics)
          </h3>
          <p class="text-xs text-slate-500 mb-3 leading-relaxed">
             すべてのタスクをカレンダーファイル(ICS)としてダウンロードします。
          </p>
          <div class="flex flex-wrap gap-2 mb-2">
            <button onclick="generateICSAndDownloadAll()" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <i data-lucide="download" class="w-4 h-4"></i> カレンダーファイルを出力
            </button>
          </div>
        </div>

        <hr class="border-slate-100" />

        <div>
          <h3 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
             <i data-lucide="alert-circle" class="w-4 h-4"></i> データ管理
          </h3>
          <div class="text-sm text-slate-600 mb-3 leading-relaxed">
             データはログイン不要でブラウザに自動保存されます。機種変更の際などはデータをエクスポートして新しい端末でインポートしてください。<br/>
             <span class="text-xs text-slate-400">※プレビュー環境でエクスポートボタンが機能しない場合は、アプリを「新しいタブで開く」か右上のメニューから開いてからお試しください。</span>
          </div>
           <div class="flex flex-wrap gap-2">
            <button onclick="exportData()" class="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              <i data-lucide="download" class="w-4 h-4"></i> ファイル保存
            </button>
            <button onclick="copyData()" class="flex-1 min-w-[120px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200">
              <i data-lucide="copy" class="w-4 h-4"></i> テキストでコピー
            </button>
            <label class="flex-1 min-w-[120px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <i data-lucide="upload" class="w-4 h-4"></i> インポート
              <input type="file" accept=".json" class="hidden" onchange="handleImport(event)" />
            </label>
          </div>
          <div class="mt-2 text-center w-full">
            <button onclick="importFromClipboard()" class="text-xs text-blue-600 hover:underline font-bold py-1">クリップボードからインポート</button>
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

let clipboardModalOpen = false;

function openClipboardModal() {
  clipboardModalOpen = true;
  renderClipboardModal();
}

function closeClipboardModal() {
  clipboardModalOpen = false;
  renderClipboardModal();
}

function handleClipboardImport(e) {
  e.preventDefault();
  const text = document.getElementById('clipboard-import-text').value;
  if (!text) return;
  importData(text);
  closeClipboardModal();
}

function generateICSAndDownloadAll() {
  const events = [];
  
  state.tasks.forEach(task => {
    if (task.completed) return;
    const course = state.courses.find(c => c.id === task.courseId);
    if (!course) return;
    
    const cname = course.name;
    const tlabel = typeLabels[task.type] || 'タスク';
    
    const d = new Date(task.date);
    const isAllDay = task.type === 'delivery'; // 配信日はすべて終日予定として扱う
    
    const pad = n => n.toString().padStart(2, '0');
    
    const summary = `${cname} - ${task.lectureName} [${tlabel}]`;
    const description = `タスク種類: ${tlabel}\\n講義名: ${task.lectureName}\\n科目: ${cname}\\n自動カレンダー同期`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    if (isAllDay) {
       const dtstart = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
       const nextDay = new Date(d);
       nextDay.setDate(d.getDate() + 1);
       const dtend = `${nextDay.getFullYear()}${pad(nextDay.getMonth()+1)}${pad(nextDay.getDate())}`;
       
       events.push(`BEGIN:VEVENT
UID:${task.id}@ondemand-app
DTSTAMP:${stamp}
DTSTART;VALUE=DATE:${dtstart}
DTEND;VALUE=DATE:${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT`);
    } else {
       const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
       const dtString = utc.getFullYear() + pad(utc.getMonth()+1) + pad(utc.getDate()) + 'T' + pad(utc.getHours()) + pad(utc.getMinutes()) + pad(utc.getSeconds()) + 'Z';
       
       const endDate = new Date(utc.getTime() + 60*60*1000);
       const dtend = endDate.getFullYear() + pad(endDate.getMonth()+1) + pad(endDate.getDate()) + 'T' + pad(endDate.getHours()) + pad(endDate.getMinutes()) + pad(endDate.getSeconds()) + 'Z';
       
       events.push(`BEGIN:VTODO
UID:${task.id}@ondemand-app
DTSTAMP:${stamp}
DUE:${dtString}
SUMMARY:${summary}
DESCRIPTION:${description}
STATUS:NEEDS-ACTION
END:VTODO`);

       // 24時間前のリマインド用タスク
       const reminderUtc = new Date(utc.getTime() - 24*60*60*1000);
       
       const rStart = reminderUtc.getFullYear() + pad(reminderUtc.getMonth()+1) + pad(reminderUtc.getDate()) + 'T' + pad(reminderUtc.getHours()) + pad(reminderUtc.getMinutes()) + pad(reminderUtc.getSeconds()) + 'Z';
       
       events.push(`BEGIN:VTODO
UID:${task.id}-rem1@ondemand-app
DTSTAMP:${stamp}
DUE:${rStart}
SUMMARY:[確実なリマインド] ${summary}
DESCRIPTION:${description}
STATUS:NEEDS-ACTION
END:VTODO`);
    }
  });
  
  if (events.length === 0) {
    alert("カレンダーに出力できる未完了タスクがありません。");
    return;
  }
  
  const icsStr = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OnDemandApp//Calendar Export//JA
CALSCALE:GREGORIAN
${events.join('\n')}
END:VCALENDAR`;

  const blob = new Blob([icsStr], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(blob);
  a.download = "ondemand_schedule.ics";
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
}

function renderClipboardModal() {
  const root = document.getElementById('modal-root');
  if (!clipboardModalOpen) {
    if (root.innerHTML.includes('テキストからインポート')) {
      root.innerHTML = '';
    }
    return;
  }
  
  root.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) closeClipboardModal()">
      <div class="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="font-bold text-slate-800">テキストからインポート</h2>
          <button onclick="closeClipboardModal()" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
        <form onsubmit="handleClipboardImport(event)" class="p-4 flex flex-col gap-4 overflow-y-auto">
          <p class="text-sm text-slate-600">エクスポート等でコピーしてある文字データを、下の枠内に貼り付けて「インポートを確定」を押してください。</p>
          <textarea id="clipboard-import-text" class="w-full border border-slate-300 rounded-lg p-3 min-h-[150px] outline-none text-sm text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400" placeholder='{"courses": [...], "tasks": [...]}'></textarea>
          <div class="flex gap-2">
            <button type="button" onclick="closeClipboardModal()" class="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">キャンセル</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">インポートを確定</button>
          </div>
        </form>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function importFromClipboard() {
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(text => {
      // If we got text easily without prompt, and it looks like JSON
      if (text && text.trim().startsWith('{')) {
        openClipboardModal();
        setTimeout(() => {
          const ta = document.getElementById('clipboard-import-text');
          if (ta) ta.value = text;
        }, 50);
      } else {
        openClipboardModal();
      }
    }).catch(() => {
      openClipboardModal();
    });
  } else {
    openClipboardModal();
  }
}


// End of Clipboard logic

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
    startNum: 1, // Start strictly from 1 as requested
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
          
          <div class="px-6 pb-3 pt-1 flex items-center justify-between border-t border-slate-100/50">
            <div class="flex items-center gap-2">
               <span class="text-xs font-bold text-slate-600">開始ナンバー:</span>
               <div class="flex items-center text-sm font-bold bg-white border border-slate-200 rounded text-slate-600 overflow-hidden focus-within:border-blue-500">
                  <span class="bg-slate-50 px-2 py-1 border-r border-slate-200">第</span>
                  <input type="number" value="${adderConfig.startNum}" onchange="adderConfig.startNum=parseInt(this.value)||1; renderModal()" class="w-12 text-center py-1 outline-none font-bold text-blue-600" min="1" />
                  <span class="bg-slate-50 px-2 py-1 border-l border-slate-200">回</span>
               </div>
            </div>
          </div>

          <div class="px-6 flex gap-2 w-full border-t border-slate-200 bg-white pt-2">
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

// End of logic

// ------ GOOGLE CALENDAR ------
let tokenClient;

function createTokenClient() {
  if (!state.gcalClientId || typeof google === 'undefined') return false;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.gcalClientId,
    scope: 'https://www.googleapis.com/auth/calendar',
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        state.gcalToken = tokenResponse.access_token;
        saveData();
        fetchGcalList();
      }
    },
  });
  return true;
}

function gcalLogin() {
  if (!state.gcalClientId) {
    alert("先にGoogle OAuth クライアントIDを設定してください。");
    return;
  }
  if (!tokenClient) {
    if (!createTokenClient()) {
       alert("Google APIの読み込みに失敗しました。時間をおいて再試行してください。");
       return;
    }
  }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function gcalLogout() {
  state.gcalToken = null;
  state.gcalOptions = [];
  saveData();
  render();
}

async function fetchGcalList() {
  if (!state.gcalToken) return;
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${state.gcalToken}` }
    });
    if (res.status === 401) {
      gcalLogout();
      return;
    }
    const data = await res.json();
    if (data.items) {
      state.gcalOptions = data.items.map(item => ({ id: item.id, summary: item.summary }));
      saveData();
      render();
    }
  } catch(e) {
    console.error(e);
  }
}

async function exportToGoogleCalendar() {
  if (!state.gcalToken) return;
  const calendarId = state.gcalTargetId || 'primary';
  const tasksToExport = state.tasks.filter(t => !t.completed);
  if (tasksToExport.length === 0) {
    alert("登録できる未完了タスクがありません。");
    return;
  }
  
  if (!confirm(`未完了のタスク ${tasksToExport.length} 件をGoogleカレンダーに登録しますか？\n(既に登録済みのタスクが重複して登録される可能性があります)`)) return;

  const pad = n => n.toString().padStart(2, '0');
  let successCount = 0;
  let hasError = false;

  const reqHeaders = {
    'Authorization': `Bearer ${state.gcalToken}`,
    'Content-Type': 'application/json'
  };

  for (const task of tasksToExport) {
    const course = state.courses.find(c => c.id === task.courseId);
    if (!course) continue;
    
    const d = new Date(task.date);
    const isAllDay = task.type === 'delivery';
    
    const summary = `${course.name} - ${task.lectureName} [${typeLabels[task.type]}]`;
    const description = `タスク種類: ${typeLabels[task.type]}\n講義名: ${task.lectureName}\n科目: ${course.name}\n自動カレンダー同期`;
    
    const pushEvent = async (eventBody) => {
        try {
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(eventBody)
          });
          if (res.ok) successCount++;
          else hasError = true;
        } catch(e) {
          console.error(e);
          hasError = true;
        }
    };
    
    if (isAllDay) {
       const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
       const nextDay = new Date(d);
       nextDay.setDate(d.getDate() + 1);
       const endDateStr = `${nextDay.getFullYear()}-${pad(nextDay.getMonth()+1)}-${pad(nextDay.getDate())}`;
       
       await pushEvent({
         summary, description,
         start: { date: dateStr },
         end: { date: endDateStr }
       });
    } else {
       // Start of task as deadline time
       const startUtc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
       const endUtc = new Date(startUtc.getTime() + 60*60*1000);

       await pushEvent({
         summary, description,
         start: { dateTime: d.toISOString() },
         end: { dateTime: new Date(d.getTime() + 60*60*1000).toISOString() }
       });
       
       // Reminder task 24 hours ago
       const rStart = new Date(d.getTime() - 24*60*60*1000);
       const rEnd = new Date(rStart.getTime() + 60*60*1000);
       await pushEvent({
         summary: `[確実なリマインド] ${summary}`, description,
         start: { dateTime: rStart.toISOString() },
         end: { dateTime: rEnd.toISOString() }
       });
    }
  }
  
  if (hasError) {
    alert(`${successCount} 件の予定を登録しましたが、一部でエラーが発生しました。`);
  } else {
    alert(`${successCount} 件の予定を登録しました。`);
  }
}

// ------ INIT ------
loadData();
render();
if (state.gcalToken) {
  setTimeout(() => {
    fetchGcalList();
  }, 1000);
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed', err));
}
