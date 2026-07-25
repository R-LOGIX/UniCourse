// script.js
const STORAGE_KEY = "ondemand_app_data";

let tpConf = null;
let state = {
  activeTab: "home",
  taskSortMode: "today", // 'today', 'course' or 'date'
  courses: [],
  tasks: [],
  showAddCourse: false,
  courseNameInput: "",
  courseDescInput: "",
  activeCourseId: null,
  editingCourseId: null,
  editCourseName: "",
  editCourseDesc: "",
  editingLecture: null, // { courseId, oldName, newName }
  editingTaskId: null,
  editTaskData: null,
  widgets: ["deadlines_assignment", "deadlines_study", "completed", "memo"],
  memoContent: "",
  memoForceAddedV2: false,
};

// Generate UUID-like short ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Load from local storage
function showToast(msg, type = "info") {
  const t = document.createElement("div");
  const bg = type === "error" ? "bg-red-600" : "bg-slate-800";
  t.className = `fixed bottom-4 left-1/2 -translate-x-1/2 ${bg} text-white px-4 py-2 rounded-lg shadow-lg z-[9999] text-sm animate-in fade-in slide-in-from-bottom-4 transition-all`;
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add("opacity-0");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function confirmAction(message, onConfirm) {
  const root = document.createElement("div");
  root.className =
    "fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in";
  root.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 flex flex-col gap-4">
       <div class="flex items-start gap-3 text-slate-800 font-medium text-sm leading-relaxed">
         <i data-lucide="alert-triangle" class="w-5 h-5 text-red-500 shrink-0 mt-0.5"></i>
         <p>${message}</p>
       </div>
       <div class="flex justify-end gap-2 mt-2">
         <button id="btn-cancel" class="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
         <button id="btn-ok" class="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">OK</button>
       </div>
    </div>
  `;
  document.body.appendChild(root);
  if (window.lucide) lucide.createIcons({ root });

  root.querySelector("#btn-cancel").onclick = () => root.remove();
  root.querySelector("#btn-ok").onclick = () => {
    root.remove();
    onConfirm();
  };
}

function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/[^A-Za-z0-9+/=]/g, ""))));
}

function showExportModal(title, content, filename, mimeType) {
  const root = document.createElement("div");
  root.className =
    "fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in";
  root.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 flex flex-col gap-4 max-h-[90vh]">
       <div class="flex items-center gap-3 text-slate-800 font-bold text-lg">
         <i data-lucide="download" class="w-5 h-5 text-blue-600"></i>
         ${title}
       </div>
       <p class="text-sm text-slate-600">
         環境によってファイルの直接ダウンロードが失敗する場合があるため、データをテキストとして出力します。コピーして安全な場所に保存するか、「ファイルとして保存」をお試しください。
       </p>
       <textarea id="export-text" class="w-full border border-slate-300 rounded-lg p-3 text-xs font-mono h-48 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" readonly></textarea>
       <div class="flex flex-col sm:flex-row justify-end gap-2 mt-2">
         <button id="btn-cancel-export" class="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors order-3 sm:order-1">閉じる</button>
         <button id="btn-copy-export" class="px-4 py-2 text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 order-2"><i data-lucide="copy" class="w-4 h-4"></i>コピー</button>
         <button id="btn-download-export" class="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 order-1 sm:order-3"><i data-lucide="save" class="w-4 h-4"></i>ファイルとして保存</button>
       </div>
    </div>
  `;
  document.body.appendChild(root);
  if (window.lucide) lucide.createIcons({ root });

  const textarea = root.querySelector("#export-text");
  textarea.value = content;

  root.querySelector("#btn-cancel-export").onclick = () => root.remove();

  root.querySelector("#btn-copy-export").onclick = () => {
    textarea.select();
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(content)
        .then(() => {
          showToast("クリップボードにコピーしました");
        })
        .catch(() => {
          showToast(
            "コピーに失敗しました。手動でコピーしてください。",
            "error",
          );
        });
    } else {
      document.execCommand("copy");
      showToast("コピーしました。");
    }
  };

  root.querySelector("#btn-download-export").onclick = () => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 300);
    } catch (e) {
      showToast(
        "ファイルダウンロードに失敗しました。手動でコピーしてください。",
        "error",
      );
    }
  };
}

let storageCrashed = false;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.courses = parsed.courses || [];
      state.tasks = (parsed.tasks || []).map((t) => ({
        ...t,
        lectureName: (t.lectureName === "無題の講義" ? "無題の課題" : t.lectureName) || "無題の課題",
        type: t.type || "assignment",
        updatedAt: t.updatedAt || 0,
      }));
      state.lastExportTime = parsed.lastExportTime || 0;
      state.widgets = parsed.widgets || ["deadlines_assignment", "deadlines_study", "completed", "memo"];
      if (!parsed.memoForceAddedV2) {
        if (!state.widgets.includes("memo")) state.widgets.push("memo");
        state.memoForceAddedV2 = true;
      } else {
        state.memoForceAddedV2 = parsed.memoForceAddedV2;
      }
      if (parsed.memoContent !== undefined)
        state.memoContent = parsed.memoContent;
    }
  } catch (e) {
    console.error("Failed to access localStorage:", e);
    storageCrashed = true;
  }
}

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        courses: state.courses,
        tasks: state.tasks,
        lastExportTime: state.lastExportTime || 0,
        widgets: state.widgets,
        memoContent: state.memoContent,
        memoForceAddedV2: state.memoForceAddedV2,
      }),
    );
  } catch (e) {
    console.error("Failed to set localStorage:", e);
    if (!storageCrashed) {
      alert(
        "プレビュー環境の制限等によりデータが保存できませんでした。新しいタブで開くことをお勧めします。",
      );
      storageCrashed = true;
    }
  }
}

// Actions
let shouldScrollToToday = false;

function setActiveTab(tab) {
  if (tab === "tasks" && state.activeTab !== "tasks") {
    shouldScrollToToday = true;
  }
  state.activeTab = tab;
  render();
}

function addCourse() {
  if (!state.courseNameInput.trim()) return;
  state.courses.push({
    id: generateId(),
    name: state.courseNameInput,
    description: state.courseDescInput,
  });
  state.courseNameInput = "";
  state.courseDescInput = "";
  state.showAddCourse = false;
  saveData();
  render();
}

function deleteCourse(id) {
  confirmAction(
    "この科目を削除しますか？関連するタスクもすべて削除されます。",
    () => {
      state.courses = state.courses.filter((c) => c.id !== id);
      state.tasks = state.tasks.filter((t) => t.courseId !== id);
      saveData();
      render();
    },
  );
}

function toggleTaskCompletion(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (task) {
    const actionText = task.completed
      ? "タスクを未完了に戻しますか？"
      : "このタスクを完了にしますか？";
    confirmAction(actionText, () => {
      task.completed = !task.completed;
      task.updatedAt = Date.now();
      saveData();
      render();
    });
  }
}

function deleteTask(id) {
  confirmAction("このタスクを削除しますか？", () => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    saveData();
    render();
  });
}

async function exportData() {
  try {
    const backupData = JSON.stringify(
      { courses: state.courses, tasks: state.tasks },
      null,
      2,
    );
    showExportModal(
      "JSONデータのエクスポート",
      backupData,
      "unicourse_backup.json",
      "application/json;charset=utf-8",
    );
    state.lastExportTime = Date.now();
    saveData();
  } catch (e) {
    showToast("エラーが発生しました: " + e.message, "error");
  }
}

function openCombinedImportModal() {
  const root = document.createElement("div");
  root.className =
    "fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in";
  root.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 flex flex-col gap-4">
       <div class="flex items-center gap-3 text-slate-800 font-bold text-lg">
         <i data-lucide="upload" class="w-5 h-5 text-blue-600"></i>
         データのインポート
       </div>
       
       <div class="flex flex-col gap-3 pb-3 border-b border-slate-200">
         <p class="text-sm text-slate-600 font-medium">ファイルから読み込む場合：</p>
         <label class="bg-slate-50 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold py-3 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer w-full text-center">
           <i data-lucide="file-up" class="w-5 h-5"></i> ファイルを選択 (.json)
           <input type="file" accept=".json,.ics" class="hidden" id="file-import-input" />
         </label>
       </div>

       <div class="flex flex-col gap-2 pt-1">
         <p class="text-sm text-slate-600 font-medium">テキストから読み込む場合：</p>
         <p class="text-xs text-slate-500">コピーしたデータ (JSON形式、または古いエクスポートデータ) を貼り付けてください。</p>
         <textarea id="import-text" class="w-full border border-slate-300 rounded-lg p-3 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="データをここに貼り付け..."></textarea>
       </div>

       <div class="flex justify-end gap-2 mt-2">
         <button id="btn-cancel-import" class="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
         <button id="btn-ok-import" class="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">テキストからインポート実行</button>
       </div>
    </div>
  `;
  document.body.appendChild(root);
  if (window.lucide) lucide.createIcons({ root });

  root.querySelector("#btn-cancel-import").onclick = () => root.remove();

  root.querySelector("#file-import-input").onchange = (e) => {
    root.remove();
    handleImport(e);
  };

  root.querySelector("#btn-ok-import").onclick = () => {
    const text = root.querySelector("#import-text").value;
    if (!text || !text.trim()) {
      showToast("データが入力されていません。", "error");
      return;
    }
    root.remove();
    importData(text);
  };
}

function importData(dataString) {
  try {
    let parsed = null;
    let str = dataString.trim();
    if (str.startsWith("{")) {
      parsed = JSON.parse(str);
    } else {
      const match = str.match(/\[DATA_START\]([\s\S]*?)\[DATA_END\]/);
      if (match) {
        parsed = JSON.parse(decodeBase64(match[1]));
      } else {
        // try parsing as pure base64
        try {
          parsed = JSON.parse(decodeBase64(str));
        } catch (e) {
          console.warn("Base64 parsing failed", e);
        }
      }
    }

    if (parsed && parsed.courses && parsed.tasks) {
      state.courses = parsed.courses;
      state.tasks = parsed.tasks;
      saveData();
      render();
      showToast("データのインポートに成功しました");
    } else {
      showToast(
        "無効なデータ形式です。正しいバックアップデータを選択するか、データをコピーして貼り付けてください。",
        "error",
      );
    }
  } catch (e) {
    showToast(
      "データの読み込みに失敗しました。データが破損している可能性があります。",
      "error",
    );
  }
}

function formatTaskDate(isoString) {
  const d = new Date(isoString);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return `${m}/${day} (${w})`;
  }
  const h = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${m}/${day} (${w}) ${h}:${min}`;
}

const typeLabels = {
  assignment: "課題",
  study: "自主学習",
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
  const h = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
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
      state.tasks.forEach((t) => {
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


function shiftEditTaskDateRelative(days) {
  if(!state.editTaskData) return;
  const el = document.getElementById("edit-date-input");
  let dStr = el ? el.value : state.editTaskData.dateStr;
  dStr = dStr.trim().replace(/\./g, '-');
  const dParts = dStr.split('-');
  if (dParts.length === 3) {
    dStr = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
  }
  const dObj = new Date(dStr);
  if (!isNaN(dObj.getTime())) {
    dObj.setDate(dObj.getDate() + days);
    const newDateStr = `${dObj.getFullYear()}.${dObj.getMonth()+1}.${dObj.getDate()}`;
    if (el) el.value = newDateStr;
    state.editTaskData.dateStr = newDateStr;
  }
}

function setEditTaskDateTo(daysOffsetFromToday) {
  if(!state.editTaskData) return;
  const dObj = new Date();
  dObj.setDate(dObj.getDate() + daysOffsetFromToday);
  const newDateStr = `${dObj.getFullYear()}.${dObj.getMonth()+1}.${dObj.getDate()}`;
  const el = document.getElementById("edit-date-input");
  if (el) el.value = newDateStr;
  state.editTaskData.dateStr = newDateStr;
}

function startEditTask(taskId) {

  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const dateObj = new Date(t.date);
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1);
  const day = dateObj.getDate();
  const dateStr = `${year}.${month}.${day}`;
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const mins = dateObj.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hours}:${mins}`;

  state.editingTaskId = taskId;
  state.editTaskData = {
    courseId: t.courseId,
    lectureName: t.lectureName,
    type: t.type,
    dateStr: "",
    timeStr: timeStr,
    }
  render();
}

function saveEditTask() {
  if (document.activeElement && document.activeElement.tagName === "INPUT") {
    document.activeElement.blur();
  }

  setTimeout(() => {
    const t = state.tasks.find((x) => x.id === state.editingTaskId);
    if (t) {
      const courseInput = document.getElementById("edit-course-input");
      const lecInput = document.getElementById("edit-lecture-input");
      const dateInput = document.getElementById("edit-date-input");
      const timeInput = document.getElementById("edit-time-input");
      if (courseInput) t.courseId = courseInput.value;
      if (lecInput) t.lectureName = lecInput.value.trim() || "無題の課題";
      if (state.editTaskData.type) t.type = state.editTaskData.type;

      let dStr = dateInput ? dateInput.value : (state.editTaskData ? state.editTaskData.dateStr : "");
      dStr = dStr.trim().replace(/\./g, '-');
      const dParts = dStr.split('-');
      if (dParts.length === 3) {
        dStr = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
      }
      const dObj = new Date(dStr);
      if (!isNaN(dObj.getTime())) {
        const tm = timeInput ? timeInput.value : (state.editTaskData ? state.editTaskData.timeStr : "");
        t.date = `${dStr}T${tm || "00:00"}:00`;
      } else {
        showToast("日付形式が正しくありません（YYYY.MM.DD）。保存されませんでした。", "error");
        return;
      }

      t.updatedAt = Date.now();
      saveData();
    }
    state.editingTaskId = null;
    state.editTaskData = null;
    render();
    showToast("タスクを保存しました");
  }, 100);
}

function cancelEditTask() {
  state.editingTaskId = null;
  state.editTaskData = null;
  render();
}

// Rendering UI
function render() {
  renderNav();

  const appEl = document.getElementById("app");
  let html = "";

  if (state.activeTab === "home") {
    html = renderHomeTab();
  } else if (state.activeTab === "tasks") {
    html = renderTasksTab();
  } else if (state.activeTab === "courses") {
    html = renderCoursesTab();
  } else if (state.activeTab === "settings") {
    html = renderSettingsTab();
  } else if (state.activeTab === "guide") {
    html = renderGuideTab();
  } else {
    state.activeTab = "home";
    html = renderHomeTab();
  }

  appEl.innerHTML = html;

  // Create icons after innerHTML
  if (window.lucide) {
    lucide.createIcons();
  }

  
  // Scroll to today if needed
  if (
    shouldScrollToToday &&
    state.activeTab === "tasks" &&
    state.taskSortMode === "date"
  ) {
    shouldScrollToToday = false;
    requestAnimationFrame(() => {
      const todayEl = document.getElementById("today-group");
      if (todayEl) {
        todayEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

function renderNav() {
  const mobileNav = document.getElementById("mobile-nav");
  const desktopNav = document.getElementById("desktop-nav");

  const tabs = [
    { id: "home", label: "ホーム", icon: "home" },
    { id: "tasks", label: "タスク", icon: "clock" },
    { id: "courses", label: "科目管理", icon: "book-open" },
    { id: "settings", label: "データ管理", icon: "database" },
    { id: "guide", label: "使い方", icon: "help-circle" },
  ];

  mobileNav.innerHTML = tabs
    .map((t) => {
      const active = state.activeTab === t.id;
      return `
      <button onclick="setActiveTab('${t.id}')" class="flex flex-col items-center gap-1 p-2 w-full transition-colors rounded-xl ${active ? "text-blue-600" : "text-slate-500 hover:bg-slate-50"}">
        <i data-lucide="${t.icon}" class="w-6 h-6"></i>
        <span class="text-[10px] font-bold">${t.label}</span>
      </button>
    `;
    })
    .join("");

  desktopNav.innerHTML = `
    <div class="px-6 pb-6 text-white text-lg font-bold flex items-center gap-2 border-b border-slate-800">
      <i data-lucide="book-open" class="w-6 h-6 text-blue-400 shrink-0"></i>
      <span class="leading-tight">課題管理アプリ<br/><span class="text-xs text-slate-400 font-normal tracking-wider uppercase">UniCourse</span></span>
    </div>
    <div class="flex-1 py-4 flex flex-col gap-2 px-4">
      ${tabs
        .map((t) => {
          const active = state.activeTab === t.id;
          const classes = active
            ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
            : "text-slate-400 hover:bg-slate-800 hover:text-white";
          return `
        <button onclick="setActiveTab('${t.id}')" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-left ${classes}">
          <i data-lucide="${t.icon}" class="w-5 h-5"></i>
          ${t.label}
        </button>
        `;
        })
        .join("")}
    </div>
  `;
}

function removeWidget(id) {
  confirmAction("このウィジェットを非表示にしますか？", () => {
    state.widgets = state.widgets.filter((w) => w !== id);
    saveData();
    render();
  });
}

function addWidget(id) {
  if (!state.widgets.includes(id)) {
    state.widgets.push(id);
    saveData();
    render();
  }
}

function renderHomeTab() {
  const now = new Date();
  const todayTs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const in5DaysTs = todayTs + 5 * 24 * 60 * 60 * 1000; // 5 days from today

  // Types: watch, assignment within 5 days
  const upcomingDeadlines = state.tasks
    .filter((t) => {
      if (t.completed || false) return false;
      const ts = new Date(t.date).getTime();
      return (
        ts >= now.getTime() - 24 * 60 * 60 * 1000 &&
        ts <= in5DaysTs + 24 * 60 * 60 * 1000 - 1
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingAssignmentDeadlines = upcomingDeadlines.filter((t) => t.type === "assignment");
  const upcomingStudyDeadlines = upcomingDeadlines.filter((t) => t.type === "study");

  // Recent schedule (delivery events within next 7 days)
  const next7DaysTs = todayTs + 7 * 24 * 60 * 60 * 1000;
  const upcomingSchedule = state.tasks
    .filter((t) => {
      if (true) return false;
      const ts = new Date(t.date).getTime();
      return ts >= todayTs && ts <= next7DaysTs;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5); // limit to 5

  const generateTaskHtml = (tasks, emptyMsg, showCheck = false) => {
    if (tasks.length === 0) {
      return `<div class="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-100">${emptyMsg}</div>`;
    }
    return (
      `<div class="flex flex-col border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">` +
      tasks
        .map((task) => {
          const course =
            state.courses.find((c) => c.id === task.courseId) ||
            { name: "その他" };
          const badgeColor = "bg-blue-100 text-blue-700";

          const isPast =
            new Date(task.date).getTime() < now.getTime() &&
            true;

          return `
        <div class="flex p-3 gap-3 items-center group relative overflow-hidden">
          ${isPast ? '<div class="absolute inset-y-0 left-0 w-1 bg-red-400"></div>' : ""}
          ${showCheck ? `<button onclick="toggleTaskCompletion('${task.id}')" class="shrink-0 transition-colors ${isPast ? "text-red-500 hover:text-red-600" : "text-blue-600 hover:text-blue-700"}"><i data-lucide="circle" class="w-5 h-5"></i></button>` : ""}
          <div class="flex-1 flex flex-col gap-1 w-full min-w-0">
             <div class="flex items-center gap-2 text-xs">
                <span class="font-bold truncate text-slate-700">${task.lectureName}</span>
                <span class="text-slate-400 border-l border-slate-200 pl-2 whitespace-nowrap">${course.name}</span>
             </div>
             <div class="flex items-center gap-2 text-xs font-bold tabular-nums ${isPast ? "text-red-500" : "text-slate-600"}">
                <span class="${badgeColor} px-1.5 py-0.5 rounded-sm shrink-0 whitespace-nowrap">${typeLabels[task.type]}</span>
                <i data-lucide="clock" class="w-3.5 h-3.5 opacity-70"></i>
                ${formatTaskDate(task.date)}
                ${isPast ? '<span class="text-[10px] bg-red-50 text-red-600 px-1 rounded uppercase tracking-wider ml-1">overdue</span>' : ""}
             </div>
             ${(task.description && task.description.trim()) ? `<details class="group/details mt-1"><summary class="text-[11px] font-bold text-blue-600 cursor-pointer select-none flex items-center gap-1 hover:text-blue-700 transition-colors w-max"><i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform group-open/details:-rotate-180"></i>課題説明を見る</summary><div class="text-xs text-slate-500 mt-1 pl-4 border-l-2 border-slate-100 whitespace-pre-wrap break-words">${task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></details>` : ""}
          </div>
        </div>
      `;
        })
        .join("") +
      `</div>`
    );
  };

  const widgetDefs = {
    deadlines_assignment: {
      id: "deadlines_assignment",
      title: "直近1週間の課題期限",
      icon: "alert-circle",
      iconColor: "text-red-500",
      html: generateTaskHtml(
        upcomingAssignmentDeadlines,
        "直近の期限はありません。よくやりました！",
        true,
      ),
    },
    deadlines_study: {
      id: "deadlines_study",
      title: "直近1週間の自主学習",
      icon: "book-open",
      iconColor: "text-blue-500",
      html: generateTaskHtml(
        upcomingStudyDeadlines,
        "直近の予定はありません。",
        true,
      ),
    },
    
    completed: {
      id: "completed",
      title: "最近完了したタスク",
      icon: "check-circle-2",
      iconColor: "text-emerald-500",
      html: () => {
        const recentlyCompleted = state.tasks
          .filter((t) => t.completed)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 5);
        if (recentlyCompleted.length === 0)
          return `<div class="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-100">まだ完了したタスクがありません。</div>`;
        return (
          `<div class="flex flex-col border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white opacity-70">` +
          recentlyCompleted
            .map((task) => {
              const course =
                state.courses.find((c) => c.id === task.courseId) ||
                { name: "その他" };
              return `
             <div class="flex p-3 gap-3 items-center group relative overflow-hidden">
                <i data-lucide="check" class="w-5 h-5 text-emerald-500 mx-1"></i>
                <div class="flex-1 flex flex-col w-full min-w-0 line-through text-slate-500">
                   <div class="text-xs font-bold truncate">${task.lectureName} <span class="font-normal text-slate-400">/ ${course.name}</span></div>
                   <div class="text-[10px] mt-0.5">${typeLabels[task.type] || task.type}</div>
                </div>
             </div>`;
            })
            .join("") +
          `</div>`
        );
      },
    },
    memo: {
      id: "memo",
      title: "メモ帳",
      icon: "sticky-note",
      iconColor: "text-amber-500",
      html: () => `<textarea oninput="state.memoContent=this.value; saveData()" class="w-full border border-amber-200 bg-amber-50/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none h-32" placeholder="自由にメモを書き込めます...">${state.memoContent || ""}</textarea>`,
    },
  };

  
  let onboardingHtml = "";
  if (state.courses.length === 0 && state.tasks.length === 0) {
    onboardingHtml = `
      <div class="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl mb-4 relative overflow-hidden">
        <div class="absolute right-0 top-0 opacity-10 pointer-events-none -mt-4 -mr-4">
           <i data-lucide="sparkles" class="w-32 h-32 text-indigo-600"></i>
        </div>
        <h3 class="text-indigo-800 font-extrabold text-lg flex items-center gap-2 mb-2 relative z-10">
          <i data-lucide="help-circle" class="w-5 h-5"></i> UniCourseへようこそ！
        </h3>
        <p class="text-indigo-700 text-sm font-medium leading-relaxed relative z-10">
          まずは下のナビゲーションから「科目管理」を開き、受講している科目を追加しましょう。<br>
          科目を追加すると、その科目に対する「課題」や「自主学習」を登録できるようになります。<br>
          設定タブからより詳しい使い方ガイドも確認できます。
        </p>
        <button onclick="setActiveTab('courses')" class="mt-3 bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg text-sm shadow-sm hover:bg-indigo-700 transition-colors relative z-10">
          科目管理へ進む
        </button>
      </div>
    `;
  }

  const activeWidgetsHtml = state.widgets
    .map((wId) => {
      const w = widgetDefs[wId];
      if (!w) return "";
      const content = typeof w.html === "function" ? w.html() : w.html;
      return `
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-3 relative group">
         <div class="flex justify-between items-center">
           <h3 class="font-bold text-slate-800 flex items-center gap-2 text-sm">
             <i data-lucide="${w.icon}" class="w-4 h-4 ${w.iconColor}"></i>
             ${w.title}
           </h3>
           
         </div>
         ${content}
      </div>
    `;
    })
    .join("");

  return `
    <div class="flex flex-col gap-6 animate-in fade-in pb-8">
      <div class="flex flex-col gap-1">
        ${onboardingHtml}
        <h2 class="text-2xl font-black text-slate-800 tracking-tight">ホーム</h2>
        <p class="text-sm text-slate-500 font-medium tracking-wide">本日のステータスと直近の予定</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        ${activeWidgetsHtml}
        
      </div>
    </div>
  `;
}

function renderTasksTab() {
  if (state.taskSortMode === "today") state.taskSortMode = "date";

  const switchHtml = `
    <div class="flex items-center gap-2 mb-2 bg-slate-100 p-1 rounded-lg w-max ml-auto shadow-inner border border-slate-200/60 overflow-x-auto w-full justify-between sm:justify-end">
      <button onclick="state.taskSortMode='course'; render()" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap min-w-16 ${state.taskSortMode === "course" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}">科目別</button>
      <button onclick="state.taskSortMode='date'; shouldScrollToToday=true; render()" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap min-w-16 ${state.taskSortMode === "date" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}">すべて</button>
    </div>
  `;

  if (state.tasks.length === 0) {
    return `
      <div class="flex flex-col gap-2 animate-in fade-in">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="clock" class="w-5 h-5"></i> 課題・学習リスト
        </h2>
        <div class="text-center p-8 mt-4 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
          表示するタスクがありません。科目管理からタスクを追加してください。
        </div>
      </div>
    `;
  }

  let contentHtml = "";

  if (state.taskSortMode === "course") {
    const baseCourses = [...state.courses];
    const customTasks = state.tasks.filter((t) => t.courseId === "custom");
    if (customTasks.length > 0) {
      baseCourses.push({
        id: "custom",
        name: "その他"
      });
    }

    const grouped = baseCourses
      .map((course) => {
        const courseTasks = state.tasks.filter((t) => t.courseId === course.id);
        const map = {};
        courseTasks.forEach((t) => {
          const lecName = t.lectureName;
          if (!map[lecName]) map[lecName] = [];
          map[lecName].push(t);
        });
        const lectures = Object.entries(map).map(([name, tasks]) => {
          
          return { name, tasks };
        });
        lectures.sort((a, b) => {
          const ea = Math.min(
            ...a.tasks.map((t) => new Date(t.date).getTime()),
          );
          const eb = Math.min(
            ...b.tasks.map((t) => new Date(t.date).getTime()),
          );
          return ea - eb;
        });
        return { course, lectures };
      })
      .filter((c) => c.lectures.length > 0);

    contentHtml = grouped
      .map(
        ({ course, lectures }) => `
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="bg-blue-50/50 border-b border-slate-200 px-4 py-3">
          <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
             <i data-lucide="book-open" class="w-4 h-4 text-blue-600"></i> ${course.name}
          </h3>
        </div>
        <div class="p-4 flex flex-col gap-4">
          ${lectures
            .map((lec) => {
              let editLecHtml = "";
              if (course.id === "custom") {
                editLecHtml = `<h4 class="font-bold text-slate-700 text-sm ml-1 flex items-center gap-2 group">${lec.name}</h4>`;
              } else if (
                state.editingLecture &&
                state.editingLecture.courseId === course.id &&
                state.editingLecture.oldName === lec.name
              ) {
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
                ${lec.tasks
                  .map((task) => {
                    const isOverdue =
                      !task.completed &&
                      true &&
                      isPastButNotToday(task.date);
                    const isTodayTask =
                      !task.completed &&
                      true &&
                      isTodayDate(task.date);

                    let checkBtn = "";
                    if (true) {
                      const checkColor = task.completed
                        ? "text-slate-400"
                        : isOverdue
                          ? "text-red-500 hover:text-red-600"
                          : "text-blue-600 hover:text-blue-700";
                      const icon = task.completed ? "check-circle" : "circle";
                      checkBtn = `<button onclick="toggleTaskCompletion('${task.id}')" class="transition-colors ${checkColor}"><i data-lucide="${icon}" class="w-5 h-5"></i></button>`;
                    } else {
                      checkBtn = `<div class="w-2 h-2 rounded-full bg-slate-300"></div>`;
                    }

                    const badgeColors = "bg-blue-100 text-blue-800 border border-blue-200";

                    const dateColor =
                      isOverdue && !task.completed
                        ? "text-red-600"
                        : isTodayTask
                          ? "text-amber-600"
                          : "text-slate-700";

                    if (state.editingTaskId === task.id) {
                      return `
                    <div class="flex flex-col gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg -ml-1.5 transition-colors my-1">
                      <div class="flex flex-wrap gap-2 items-center">
                         <select id="edit-course-input" onchange="state.editTaskData.courseId=this.value" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none bg-white max-w-[120px]">
                            ${state.courses.map((c) => `<option value="${c.id}" ${state.editTaskData.courseId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
                            <option value="custom" ${state.editTaskData.courseId === "custom" ? "selected" : ""}>その他</option>
                         </select>
                         <input type="text" id="edit-lecture-input" oninput="state.editTaskData.lectureName=this.value" value="${state.editTaskData.lectureName === '無題の課題' ? '' : state.editTaskData.lectureName}" class="border border-slate-300 rounded px-2 py-1.5 text-base w-32 outline-none" placeholder="課題のタイトルなど…" />
                         
                         <input type="text" id="edit-date-input" oninput="state.editTaskData.dateStr=this.value" value="${state.editTaskData.dateStr}" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[120px]" placeholder="YYYY.MM.DD" />
                         <input type="text" id="edit-time-input" oninput="state.editTaskData.timeStr=this.value" value="${state.editTaskData.timeStr || "00:00"}" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[70px] text-center" placeholder="HH:MM" />
                         <select id="edit-type-input" onchange="state.editTaskData.type=this.value" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none bg-white">
                           <option value="assignment" ${state.editTaskData.type === 'assignment' ? 'selected' : ''}>課題</option>
                           <option value="study" ${state.editTaskData.type === 'study' ? 'selected' : ''}>自主学習</option>
                         </select>
                         
                      </div>
                      <div class="flex gap-1 mb-1 flex-wrap">
                        <button onclick="setEditTaskDateTo(0)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">今日</button>
                        <button onclick="setEditTaskDateTo(1)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">明日</button>
                        <button onclick="shiftEditTaskDateRelative(1)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">+1日</button>
                        <button onclick="shiftEditTaskDateRelative(7)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">+1週間</button>
                      </div>
                      </div>
                      <div class="flex justify-end gap-2">
                         <button onclick="cancelEditTask()" class="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded font-bold text-slate-700 transition">キャンセル</button>
                         <button onclick="saveEditTask()" class="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded font-bold text-white transition">保存</button>
                      </div>
                    </div>
                    `;
                    }

                    return `
                  <div class="flex items-center gap-3 group/task hover:bg-slate-50 p-1.5 -ml-1.5 rounded transition-colors">
                    <div class="flex items-center justify-center w-6 shrink-0">${checkBtn}</div>
                    <div class="flex-1 flex flex-col gap-1 text-sm ${task.completed ? "opacity-50 line-through" : ""}">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                        <span class="font-bold tabular-nums ${dateColor}">${formatTaskDate(task.date)}</span>
                      </div>
                      ${(task.description && task.description.trim()) ? `<details class="group/details mt-1 w-full"><summary class="text-[11px] font-bold text-blue-600 cursor-pointer select-none flex items-center gap-1 hover:text-blue-700 transition-colors w-max"><i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform group-open/details:-rotate-180"></i>課題説明を見る</summary><div class="text-xs text-slate-500 mt-1 pl-4 border-l-2 border-slate-100 whitespace-pre-wrap break-words">${task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></details>` : ""}
                    </div>
                    <div class="flex items-center gap-1 opacity-100 shrink-0">
                      <button onclick="startEditTask('${task.id}')" class="text-slate-300 hover:text-blue-500 p-1 hover:bg-blue-50 rounded" title="タスク編集">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                      </button>
                      <button onclick="deleteTask('${task.id}')" class="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded" title="タスク削除">
                        <i data-lucide="x" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                  `;
                  })
                  .join("")}
              </div>
            </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `,
      )
      .join("");
  } else {
    // taskSortMode === 'date'
    const dateMap = {};
    const todayTs = new Date().setHours(0, 0, 0, 0);

    state.tasks.forEach((task) => {
      const d = new Date(task.date);
      const groupKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      if (!dateMap[groupKey]) {
        dateMap[groupKey] = {
          ts: ts,
          tasks: [],
        };
      }
      dateMap[groupKey].tasks.push(task);
    });

    const groups = Object.values(dateMap);
    groups.sort((a, b) => a.ts - b.ts);

    contentHtml = groups
      .map((g) => {
        const d = new Date(g.ts);
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
        const headerStr = `${m}月${day}日 (${w})`;

        const nowTs = new Date().setHours(0, 0, 0, 0);
        const isPast = g.ts < nowTs;
        const isToday = g.ts === nowTs;
        const headerColors = isPast
          ? "text-slate-600 bg-slate-100 border-slate-200 opacity-80"
          : isToday
            ? "text-blue-800 bg-blue-100 border-blue-200 shadow-sm"
            : "text-slate-700 bg-slate-50 border-slate-200";

        g.tasks.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        return `
        <div ${isToday ? 'id="today-group"' : ""} class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 last:mb-0 scroll-mt-20">
           <div class="${headerColors} border-b px-4 py-2 font-bold text-sm tracking-wide flex items-center justify-between">
             <div>${headerStr} ${isToday ? '<span class="ml-2 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Today</span>' : ""}</div>
           </div>
           <div class="flex flex-col divide-y divide-slate-100">
             ${g.tasks
               .map((task) => {
                 const course =
                   state.courses.find((c) => c.id === task.courseId) ||
                   { name: "その他" };
                 const isOverdue =
                   !task.completed &&
                   true &&
                   isPastButNotToday(task.date);
                 const isTodayTask =
                   !task.completed &&
                   true &&
                   isTodayDate(task.date);

                 let checkBtn = "";
                 if (true) {
                   const checkColor = task.completed
                     ? "text-slate-400"
                     : isOverdue
                       ? "text-red-500 hover:text-red-600"
                       : "text-blue-600 hover:text-blue-700";
                   const icon = task.completed ? "check-circle" : "circle";
                   checkBtn = `<button onclick="toggleTaskCompletion('${task.id}')" class="transition-colors ${checkColor}"><i data-lucide="${icon}" class="w-5 h-5"></i></button>`;
                 } else {
                   checkBtn = `<div class="w-2 h-2 rounded-full bg-slate-300"></div>`;
                 }

                 const badgeColors = "bg-blue-100 text-blue-800 border border-blue-200";

                 const dateColor =
                   isOverdue && !task.completed
                     ? "text-red-600"
                     : isTodayTask
                       ? "text-amber-600"
                       : "text-slate-700";

                 if (state.editingTaskId === task.id) {
                   return `
                      <div class="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-100 transition-colors">
                        <div class="flex flex-wrap gap-2 items-center">
                           <select id="edit-course-input" onchange="state.editTaskData.courseId=this.value" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none bg-white max-w-[120px]">
                             ${state.courses.map((c) => `<option value="${c.id}" ${state.editTaskData.courseId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
                             <option value="custom" ${state.editTaskData.courseId === "custom" ? "selected" : ""}>その他</option>
                           </select>
                           <input type="text" id="edit-lecture-input" oninput="state.editTaskData.lectureName=this.value" value="${state.editTaskData.lectureName === '無題の課題' ? '' : state.editTaskData.lectureName}" class="border border-slate-300 rounded px-2 py-1.5 text-base w-32 outline-none" placeholder="課題のタイトルなど…" />
                           
                           <input type="text" id="edit-date-input" oninput="state.editTaskData.dateStr=this.value" value="${state.editTaskData.dateStr}" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[120px]" placeholder="YYYY.MM.DD" />
                         <input type="text" id="edit-time-input" oninput="state.editTaskData.timeStr=this.value" value="${state.editTaskData.timeStr || "00:00"}" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[70px] text-center" placeholder="HH:MM" />
                         <select id="edit-type-input" onchange="state.editTaskData.type=this.value" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none bg-white">
                           <option value="assignment" ${state.editTaskData.type === 'assignment' ? 'selected' : ''}>課題</option>
                           <option value="study" ${state.editTaskData.type === 'study' ? 'selected' : ''}>自主学習</option>
                         </select>
                         
                      </div>
                      <div class="flex gap-1 mb-1 flex-wrap">
                        <button onclick="setEditTaskDateTo(0)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">今日</button>
                        <button onclick="setEditTaskDateTo(1)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">明日</button>
                        <button onclick="shiftEditTaskDateRelative(1)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">+1日</button>
                        <button onclick="shiftEditTaskDateRelative(7)" class="text-xs bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">+1週間</button>
                      </div>
                      </div>
                        <div class="flex justify-end gap-2 mt-1">
                           <button onclick="cancelEditTask()" class="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded font-bold text-slate-700 transition">キャンセル</button>
                           <button onclick="saveEditTask()" class="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded font-bold text-white transition">保存</button>
                        </div>
                      </div>
                      `;
                 }

                 return `
                  <div class="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors group/task">
                    <div class="flex items-center justify-center w-6 shrink-0">${checkBtn}</div>
                    <div class="flex-1 flex flex-col gap-1 ${task.completed ? "opacity-50 line-through" : ""}">
                      <div class="flex flex-wrap items-center gap-2 text-sm">
                        <span class="font-bold text-slate-700 text-xs truncate max-w-[150px]" title="${task.lectureName}">${task.lectureName}</span>
                        <span class="text-slate-500 text-xs border-l border-slate-300 pl-2">${course.name}</span>
                        <span class="font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                        
                      </div>
                      <div class="text-xs font-bold tabular-nums flex items-center gap-1.5 ${dateColor}">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                        ${task.date.includes("T00:00:00") && false ? "時間未定" : formatTaskTimeOnly(task.date)}
                      </div>
                      ${(task.description && task.description.trim()) ? `<details class="group/details mt-1"><summary class="text-[11px] font-bold text-blue-600 cursor-pointer select-none flex items-center gap-1 hover:text-blue-700 transition-colors w-max"><i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform group-open/details:-rotate-180"></i>課題説明を見る</summary><div class="text-xs text-slate-500 mt-1 pl-4 border-l-2 border-slate-100 whitespace-pre-wrap break-words">${task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></details>` : ""}
                    </div>
                    <div class="flex flex-col sm:flex-row items-center gap-1 opacity-100 shrink-0">
                      <button onclick="startEditTask('${task.id}')" class="text-slate-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded" title="タスク編集">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                      </button>
                      <button onclick="deleteTask('${task.id}')" class="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded" title="タスク削除">
                        <i data-lucide="x" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                  `;
               })
               .join("")}
             </div>
          </div>
        `;
      })
      .join("");
  }

  return `
    <div class="flex flex-col gap-2 animate-in fade-in">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="clock" class="w-5 h-5"></i> 課題・学習リスト
        </h2>
        ${switchHtml}
      </div>
      <div class="flex flex-col gap-4">${contentHtml}</div>
    </div>
  `;
}

function renderCoursesTab() {
  let addCourseHtml = "";
  if (state.showAddCourse) {
    addCourseHtml = `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 animate-in slide-in-from-top-2">
        <h3 class="font-bold text-slate-700">新規科目の追加</h3>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">科目名</label>
          <input type="text" id="cname" value="${state.courseNameInput}" oninput="state.courseNameInput=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="科目名" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">科目説明 (任意)</label>
          <textarea id="cdesc" oninput="state.courseDescInput=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20" placeholder="科目に関する説明やメモ">${state.courseDescInput}</textarea>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <button onclick="state.showAddCourse=false;render()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
          <button onclick="addCourse()" class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存する</button>
        </div>
      </div>
    `;
  }

  const listHtml = state.courses
    .map((course) => {
      let headerAndDescHtml = "";
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
        const descText = course.description
          ? course.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")
          : "";
        headerAndDescHtml = `
        <div class="flex-1 w-full max-w-[calc(100%-2rem)] pr-2 group cursor-pointer" onclick="state.editingCourseId='${course.id}'; state.editCourseName='${course.name.replace(/'/g, "\\'")}'; state.editCourseDesc='${(course.description || "").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'; render()">
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
          ${
            state.editingCourseId !== course.id
              ? `
          <button onclick="deleteCourse('${course.id}')" class="text-slate-300 hover:bg-red-50 hover:text-red-500 p-1.5 rounded-lg transition-colors shrink-0" aria-label="科目削除">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
          `
              : ""
          }
        </div>
        
        ${
          state.editingCourseId !== course.id
            ? `
        <button onclick="openAssignmentAdder('${course.id}')" class="mt-5 border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 font-bold py-2.5 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm">
          <i data-lucide="plus" class="w-4 h-4"></i> 課題・学習を追加する
        </button>
        `
            : ""
        }
      </div>
    `;
    })
    .join("");

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

      ${
        state.courses.length === 0 && !state.showAddCourse
          ? `
        <div class="text-center p-8 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
          まだ登録されている科目がありません。
        </div>
      `
          : ""
      }

      <div class="grid grid-cols-1 gap-4">
        ${listHtml}
      </div>

      <div class="mt-4 pt-4 border-t border-slate-200">
         <button onclick="openAssignmentAdder('custom')" class="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 font-bold py-3 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-2 shadow-sm">
           <i data-lucide="pen-tool" class="w-4 h-4"></i> その他の課題・学習を追加する
         </button>
      </div>
    </div>
  `;
}



function saveCourseEdit(id) {
  const c = state.courses.find((c) => c.id === id);
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

function renderGuideTab() {
  return `
    <div class="flex flex-col animate-in fade-in pb-8">
      <div class="flex flex-col gap-1 mb-6">
        <h2 class="text-2xl font-black text-slate-800 tracking-tight">使い方ガイド</h2>
        <p class="text-sm text-slate-500 font-medium tracking-wide">UniCourse（ユニコース）の便利な使い方</p>
      </div>
      
      <div class="flex flex-col gap-5">
        
        <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden">
          <div class="absolute right-0 top-0 opacity-5 pointer-events-none -mt-4 -mr-4">
             <i data-lucide="book-open" class="w-32 h-32"></i>
          </div>
          <div class="flex items-center gap-3 border-b border-slate-100 pb-3 relative z-10">
             <div class="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
               <span class="font-bold">STEP 1</span>
             </div>
             <h3 class="font-bold text-slate-800 text-lg">科目を登録しよう！</h3>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed relative z-10">
            まずは<strong>「科目管理」</strong>タブを開いて、学校の授業（数学、英語など）や、自分で勉強したいジャンル（資格の勉強など）を追加しましょう。<br>
            科目を登録しておくと、あとで「この課題はどの科目のものか」がわかりやすくなります。
          </p>
        </div>

        <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden">
          <div class="absolute right-0 top-0 opacity-5 pointer-events-none -mt-4 -mr-4">
             <i data-lucide="edit-3" class="w-32 h-32"></i>
          </div>
          <div class="flex items-center gap-3 border-b border-slate-100 pb-3 relative z-10">
             <div class="bg-blue-100 text-blue-600 p-2 rounded-lg">
               <span class="font-bold">STEP 2</span>
             </div>
             <h3 class="font-bold text-slate-800 text-lg">課題や予定（タスク）を追加しよう！</h3>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed relative z-10">
            科目管理画面で科目を追加したら、<strong>「課題・学習を追加する」</strong>ボタンを押して、出された「課題」や自分の「自主学習」の予定を書き込みます。<br>
            「いつまでにやるか（日付と時間）」を決めておくと、あとで忘れずにすみますよ。<br>
            詳しい説明があるときは「課題説明（メモ）」に書いておきましょう。
          </p>
        </div>

        <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden">
          <div class="absolute right-0 top-0 opacity-5 pointer-events-none -mt-4 -mr-4">
             <i data-lucide="check-circle" class="w-32 h-32"></i>
          </div>
          <div class="flex items-center gap-3 border-b border-slate-100 pb-3 relative z-10">
             <div class="bg-emerald-100 text-emerald-600 p-2 rounded-lg">
               <span class="font-bold">STEP 3</span>
             </div>
             <h3 class="font-bold text-slate-800 text-lg">終わったらチェックをつけよう！</h3>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed relative z-10">
            <strong>「タスク」</strong>タブには、登録したすべての課題や予定がリストで並びます。「科目別」か「日付順（すべて）」で見やすい方に切り替えてみてください。<br>
            課題が終わったら、左側にある丸いボタン（<i data-lucide="circle" class="w-4 h-4 inline-block text-blue-600"></i>）を押して完了（<i data-lucide="check-circle" class="w-4 h-4 inline-block text-slate-400"></i>）にしましょう！
          </p>
        </div>

        <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden">
          <div class="absolute right-0 top-0 opacity-5 pointer-events-none -mt-4 -mr-4">
             <i data-lucide="home" class="w-32 h-32"></i>
          </div>
          <div class="flex items-center gap-3 border-b border-slate-100 pb-3 relative z-10">
             <div class="bg-amber-100 text-amber-600 p-2 rounded-lg">
               <span class="font-bold">STEP 4</span>
             </div>
             <h3 class="font-bold text-slate-800 text-lg">ホーム画面を活用しよう！</h3>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed relative z-10">
            アプリを開くと最初に表示される<strong>「ホーム」</strong>タブでは、直近1週間のうちに期限がくる課題や、これからの自主学習の予定がパッと見てわかります。<br>
            ちょっとしたことを書いておける「メモ帳」もあるので、思いついたことを忘れないうちに書き留めておけます。
          </p>
        </div>
        
        <div class="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-3">
          <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
            <i data-lucide="info" class="w-4 h-4 text-slate-500"></i> 大切なデータについて
          </h3>
          <p class="text-sm text-slate-600 leading-relaxed">
            スマホやパソコンを新しくするときや、万が一のために、<strong>「データ管理」</strong>タブからデータのバックアップ（エクスポート）ができます。ダウンロードしたファイルから元通りに復元（インポート）できるので安心です。
          </p>
        </div>

      </div>
    </div>
  `;
}

function renderSettingsTab() {
  return `
    <div class="flex flex-col animate-in fade-in pb-8">
      <div class="flex flex-col gap-1 mb-6">
        <h2 class="text-2xl font-black text-slate-800 tracking-tight">データ管理</h2>
        <p class="text-sm text-slate-500 font-medium tracking-wide">アプリデータのバックアップと復元</p>
      </div>
      
      <div class="flex flex-col gap-4 animate-in fade-in">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-5">
          <div>
            <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
              <i data-lucide="download" class="w-5 h-5 text-blue-600"></i> バックアップのエクスポート
            </h3>
            <p class="text-sm text-slate-600 leading-relaxed mb-4">
               現在のすべてのデータをJSONファイルとしてダウンロードします。機種変更時のデータ移行や、万が一のデータ消失に備えた定期的なバックアップとしてご利用ください。<br>
               <span class="text-xs text-slate-400">※ボタンが機能しない場合は、アプリを「新しいタブで開く」からお試しください。</span>
            </p>
            <button onclick="exportData()" class="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <i data-lucide="download" class="w-4 h-4"></i> データをエクスポート
            </button>
          </div>

          <hr class="border-slate-100 my-2">

          <div>
            <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
              <i data-lucide="upload" class="w-5 h-5 text-blue-600"></i> データの復元 (インポート)
            </h3>
            <p class="text-sm text-slate-600 leading-relaxed mb-4">
               エクスポートしたJSONファイルを読み込み、データを復元します。<br>
               <span class="text-red-500 font-bold">※インポートを実行すると、現在のデータは上書きされますのでご注意ください。</span>
            </p>
            <button onclick="openCombinedImportModal()" class="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <i data-lucide="upload" class="w-4 h-4"></i> データをインポート
            </button>
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
  reader.onload = (ev) => {
    if (ev.target.result) importData(ev.target.result);
  };
  reader.readAsText(file);
  e.target.value = "";
}

// ------ ADDER MODAL ------
let adderConfig = null;

function openAssignmentAdder(courseId) {
  const existing = state.tasks
    .filter((t) => t.courseId === courseId)
    .map((t) => t.lectureName);
  let max = 0;
  existing.forEach((name) => {
    const m = name.match(/第(\d+)回/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });

  adderConfig = {
    courseId,
    startNum: max + 1,
    items: [
      { dateStr: "", content: "", timeStr: "", type: "assignment", description: "" }
    ],
    };

  renderModal();
}

function closeAssignmentAdder() {
  adderConfig = null;
  renderModal();
}

function addAdderItem() {
  const nextNum = adderConfig.startNum + adderConfig.items.length;
  adderConfig.items.push({ dateStr: "", content: "", timeStr: "", type: "assignment", description: "" });
  renderModal();
}

function removeAdderItem(index) {
  adderConfig.items.splice(index, 1);
  renderModal();
}

function updateAdderItem(index, field, value) {
  adderConfig.items[index][field] = value;
}



function saveAdderTasks() {
  const newTasks = [];

  for (let i = 0; i < adderConfig.items.length; i++) {
    const item = adderConfig.items[i];
    if (!item.dateStr.trim()) {
      showToast(`行 ${i+1} の日付が入力されていません`, "error");
      return;
    }
    
    // Parse date (e.g. 2026.7.18)
    let dStr = item.dateStr.trim().replace(/\./g, '-');
    const dParts = dStr.split('-');
    if (dParts.length === 3) {
      dStr = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
    }
    const dObj = new Date(dStr);
    if (isNaN(dObj.getTime())) {
      showToast(`行 ${i+1} の日付形式が正しくありません（YYYY.MM.DD）`, "error");
      return;
    }

    newTasks.push({
      id: generateId(),
      courseId: adderConfig.courseId,
      lectureName: item.content.trim() || "無題の課題",
      type: item.type || "assignment",
      date: `${dStr}T${item.timeStr || "23:59"}:00`,
      description: item.description || "",
      completed: false,
      updatedAt: Date.now(),
    });
  }

  if (newTasks.length === 0) return;

  state.tasks.push(...newTasks);
  saveData();
  closeAssignmentAdder();
  render();
  showToast("課題・学習を保存しました");
}

function renderModal() {
  const root = document.getElementById("modal-root");
  if (!adderConfig) {
    root.innerHTML = "";
    return;
  }
  
  const isCustom = adderConfig.courseId === "custom";
  const title = isCustom ? "その他の課題・学習を追加する" : "課題・学習を追加する";
  const subtitle = isCustom ? "特定の科目に紐づかない単発の課題や予定を追加できます" : "複数の課題や自主学習を一括で追加できます";
  const icon = isCustom ? "pen-tool" : "list-plus";
  const iconBg = isCustom ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600";

  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div class="bg-white max-w-3xl w-full rounded-2xl shadow-xl flex flex-col m-auto max-h-[85dvh] md:max-h-[85vh] border border-slate-200">
        
        <div class="flex flex-col border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div class="flex justify-between items-center p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="${iconBg} p-2 rounded-xl">
                <i data-lucide="${icon}" class="w-6 h-6"></i>
              </div>
              <div class="flex flex-col">
                <h4 class="font-extrabold text-slate-800 text-lg tracking-tight">${title}</h4>
                <p class="text-[11px] text-slate-500 font-medium mt-0.5">${subtitle}</p>
              </div>
            </div>
            <button onclick="closeAssignmentAdder()" class="text-slate-400 hover:text-slate-600 p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition-colors shadow-sm">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

      <div class="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-50/30 gap-4">
        
        <div class="flex flex-col gap-3">
          ${adderConfig.items.map((item, index) => `
            <div class="flex flex-col gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm relative">
              <div class="absolute top-2 right-2">
                <button onclick="removeAdderItem(${index})" class="text-slate-400 hover:text-red-500 p-1.5 transition-colors" title="この行を削除" ${adderConfig.items.length <= 1 ? "disabled class='opacity-50 pointer-events-none'" : ""}>
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pr-6 sm:pr-0">
                <div class="flex flex-col">
                  <label class="text-xs font-bold text-slate-600 mb-1">期限の日付</label>
                  <input type="text" value="${item.dateStr}" oninput="updateAdderItem(${index}, 'dateStr', this.value)" placeholder="YYYY.MM.DD" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                
                <div class="flex flex-col">
                  <label class="text-xs font-bold text-slate-600 mb-1">時間</label>
                  <input type="text" value="${item.timeStr}" oninput="updateAdderItem(${index}, 'timeStr', this.value)" placeholder="HH:MM" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-center" />
                </div>

                <div class="flex flex-col">
                  <label class="text-xs font-bold text-slate-600 mb-1">種類</label>
                  <select onchange="updateAdderItem(${index}, 'type', this.value)" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="assignment" ${item.type === 'assignment' ? 'selected' : ''}>課題</option>
                    <option value="study" ${item.type === 'study' ? 'selected' : ''}>自主学習</option>
                  </select>
                </div>

                <div class="flex flex-col">
                  <label class="text-xs font-bold text-slate-600 mb-1">課題名</label>
                  <input type="text" value="${item.content}" oninput="updateAdderItem(${index}, 'content', this.value)" placeholder="課題のタイトルなど…" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div class="flex flex-col">
                <label class="text-xs font-bold text-slate-600 mb-1">詳細説明</label>
                <textarea oninput="updateAdderItem(${index}, 'description', this.value)" placeholder="提出方法や課題の詳細など..." class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none h-16">${item.description || ""}</textarea>
              </div>
            </div>
          `).join('')}
        </div>

        <button onclick="addAdderItem()" class="border-2 border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4"></i> さらに行を追加
        </button>

        <div class="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <button onclick="saveAdderTasks()" class="w-full md:w-auto bg-blue-600 text-white font-bold tracking-wide py-2.5 px-8 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
             <i data-lucide="save" class="w-4 h-4"></i> 保存する
          </button>
        </div>

      </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ root });
}

function setCalDeliveryTime(v) {
  updateCalField("calDeliveryTime", v);
}
function setCalWatchTime(v) {
  updateCalField("calWatchTime", v);
}
function setCalAssignTime(v) {
  updateCalField("calAssignTime", v);
}



// End of logic

// ------ INIT ------
loadData();
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}
// Expose globals for inline HTML event handlers
window.state = state;
window.tpConf = tpConf;
window.shouldScrollToToday = shouldScrollToToday;

const globalsToExpose = {
  generateId, showToast, confirmAction, encodeBase64, decodeBase64, showExportModal, loadData, saveData, setActiveTab, addCourse, deleteCourse, toggleTaskCompletion, deleteTask, openCombinedImportModal, importData, formatTaskDate, isPastButNotToday, isTodayDate, formatTaskTimeOnly, startEditLecture, saveLectureName, shiftEditTaskDateRelative, setEditTaskDateTo, startEditTask, saveEditTask, cancelEditTask, render, renderNav, removeWidget, addWidget, renderHomeTab, renderTasksTab, renderCoursesTab, saveCourseEdit, renderGuideTab, renderSettingsTab, handleImport, openAssignmentAdder, closeAssignmentAdder, addAdderItem, removeAdderItem, updateAdderItem, saveAdderTasks, renderModal, exportData
};

for (const [key, val] of Object.entries(globalsToExpose)) {
  if (typeof val === 'function') {
    window[key] = val;
  }
}
