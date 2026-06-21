// script.js
const STORAGE_KEY = "ondemand_app_data";

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
  showCustomAssignment: false,
  customAssignInput: {
    courseName: "",
    dateStr: "",
    timeStr: "23:59",
    isSelfDeadline: false,
    description: "",
  },
  widgets: ["deadlines", "schedule"],
  memoContent: "",
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
        lectureName: t.lectureName || "無題の講義",
        isSelfDeadline:
          t.isSelfDeadline !== undefined
            ? t.isSelfDeadline
            : t.deadlineType === "self",
        updatedAt: t.updatedAt || 0,
      }));
      state.lastExportTime = parsed.lastExportTime || 0;
      if (parsed.widgets) state.widgets = parsed.widgets;
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
  delivery: "配信日",
  watch: "視聴期限",
  assignment: "課題期限",
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

function startEditTask(taskId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const dateObj = new Date(t.date);
  // Get local date/time string correctly formatted
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const day = dateObj.getDate().toString().padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const mins = dateObj.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hours}:${mins}`;

  state.editingTaskId = taskId;
  state.editTaskData = {
    courseId: t.courseId,
    lectureName: t.lectureName,
    type: t.type,
    dateStr: dateStr,
    timeStr: timeStr,
    isSelfDeadline: t.isSelfDeadline,
  };
  render();
}

function saveEditTask() {
  if (document.activeElement && document.activeElement.tagName === "INPUT") {
    document.activeElement.blur();
  }

  setTimeout(() => {
    const t = state.tasks.find((x) => x.id === state.editingTaskId);
    if (t) {
      // Read directly from DOM to ensure we get the latest value (especially for mobile time pickers)
      const courseInput = document.getElementById("edit-course-input");
      const lecInput = document.getElementById("edit-lecture-input");
      const typeInput = document.getElementById("edit-type-input");
      const dateInput = document.getElementById("edit-date-input");
      const timeInput = document.getElementById("edit-time-input");
      const selfInput = document.getElementById("edit-self-input");

      if (courseInput) t.courseId = courseInput.value;
      if (lecInput) t.lectureName = lecInput.value.trim() || "無題の講義";
      if (typeInput) t.type = typeInput.value;
      if (selfInput) t.isSelfDeadline = selfInput.checked;

      const d = dateInput
        ? dateInput.value
        : state.editTaskData
          ? state.editTaskData.dateStr
          : "";
      const tm = timeInput
        ? timeInput.value
        : state.editTaskData
          ? state.editTaskData.timeStr
          : "";

      t.date = `${d}T${tm || "00:00"}:00`;
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
  } else {
    state.activeTab = "home";
    html = renderHomeTab();
  }

  appEl.innerHTML = html;

  // Create icons after innerHTML
  if (window.lucide) {
    lucide.createIcons();
  }

  if (state.showCustomAssignment) {
    renderCustomAssignModal();
  } else {
    const el = document.getElementById("custom-assign-modal-root");
    if (el) el.innerHTML = "";
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

function renderCustomAssignModal() {
  let root = document.getElementById("custom-assign-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "custom-assign-modal-root";
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onclick="if(event.target===this) closeCustomAssignment()">
      <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl flex flex-col gap-4 border border-slate-200">
        <div class="flex items-center justify-between">
          <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2"><i data-lucide="pen-tool" class="w-5 h-5 text-indigo-600"></i> オンデマンド以外の課題を追加</h3>
          <button onclick="closeCustomAssignment()" class="text-slate-400 hover:text-slate-600 transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
        
        <div class="flex flex-col md:flex-row gap-6 mt-2">
           <div class="flex flex-col gap-2 relative z-10 mx-auto w-full max-w-[310px] shrink-0">
              <label class="block text-xs font-bold text-slate-600 mb-1">期限の日付 (必須)</label>
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-2 flatpickr-wrapper shadow-inner">
                 <input type="text" id="custom-assign-calendar" class="hidden" />
              </div>
           </div>
           
           <div class="flex-1 flex flex-col gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">科目名 (必須)</label>
                <input type="text" value="${state.customAssignInput.courseName}" oninput="state.customAssignInput.courseName=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例: 英語ライティング" />
              </div>
              
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">時間</label>
                <button type="button" onclick="openCustomTimePicker('${state.customAssignInput.timeStr}', 'setCustomAssignTime')" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none hover:bg-slate-50 transition-colors text-center text-slate-700 font-bold">${state.customAssignInput.timeStr || "23:59"}</button>
              </div>
              
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">詳細説明</label>
                <textarea oninput="state.customAssignInput.description=this.value" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20" placeholder="提出方法や課題の詳細など...">${state.customAssignInput.description}</textarea>
              </div>
              
              <div>
                <label class="flex items-center gap-2 text-sm cursor-pointer border border-slate-200 bg-slate-50 p-2 rounded-lg font-medium text-slate-700 w-max">
                   <input type="checkbox" onchange="state.customAssignInput.isSelfDeadline=this.checked" ${state.customAssignInput.isSelfDeadline ? "checked" : ""} class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"/> 
                   自主的な目標期限として登録する
                </label>
              </div>
           </div>
        </div>
        
        <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100">
           <button onclick="closeCustomAssignment()" class="flex-1 py-2.5 bg-slate-100 font-bold text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-sm">キャンセル</button>
           <button onclick="saveCustomAssignment()" class="flex-1 py-2.5 bg-indigo-600 font-bold text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 text-sm">追加する</button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons({ root });

  if (typeof window.flatpickr !== "undefined") {
    flatpickr("#custom-assign-calendar", {
      inline: true,
      mode: "single",
      locale: "ja",
      defaultDate: state.customAssignInput.dateStr || new Date(),
      onChange: function (selectedDates, dateStr, instance) {
        state.customAssignInput.dateStr = dateStr;
      },
    });
  }
}

function setCustomAssignTime(v) {
  state.customAssignInput.timeStr = v;
  renderCustomAssignModal();
}

function renderNav() {
  const mobileNav = document.getElementById("mobile-nav");
  const desktopNav = document.getElementById("desktop-nav");

  const tabs = [
    { id: "home", label: "ホーム", icon: "home" },
    { id: "tasks", label: "タスク", icon: "clock" },
    { id: "courses", label: "科目管理", icon: "book-open" },
    { id: "settings", label: "設定", icon: "settings" },
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
      <span class="leading-tight">オンデマンド受講管理<br/><span class="text-xs text-slate-400 font-normal tracking-wider uppercase">UniCourse</span></span>
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
          ${t.id === "home" ? "ホーム" : t.id === "tasks" ? "タスク" : t.id === "courses" ? "科目管理" : "設定とデータ"}
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
      if (t.completed || t.type === "delivery") return false;
      const ts = new Date(t.date).getTime();
      return (
        ts >= now.getTime() - 24 * 60 * 60 * 1000 &&
        ts <= in5DaysTs + 24 * 60 * 60 * 1000 - 1
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Recent schedule (delivery events within next 7 days)
  const next7DaysTs = todayTs + 7 * 24 * 60 * 60 * 1000;
  const upcomingSchedule = state.tasks
    .filter((t) => {
      if (t.type !== "delivery") return false;
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
            (task.courseId === "custom"
              ? { name: task.lectureName, isCustom: true }
              : { name: "不明な科目" });
          const badgeColor =
            task.type === "assignment"
              ? "bg-red-100 text-red-700"
              : task.type === "watch"
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700";

          const isPast =
            new Date(task.date).getTime() < now.getTime() &&
            task.type !== "delivery";

          return `
        <div class="flex p-3 gap-3 items-center group relative overflow-hidden">
          ${isPast ? '<div class="absolute inset-y-0 left-0 w-1 bg-red-400"></div>' : ""}
          ${showCheck ? `<button onclick="toggleTaskCompletion('${task.id}')" class="shrink-0 transition-colors ${isPast ? "text-red-500 hover:text-red-600" : "text-blue-600 hover:text-blue-700"}"><i data-lucide="circle" class="w-5 h-5"></i></button>` : ""}
          <div class="flex-1 flex flex-col gap-1 w-full min-w-0">
             <div class="flex items-center gap-2 text-xs">
                <span class="font-bold truncate text-slate-700">${course.name}</span>
                ${course.isCustom ? "" : `<span class="text-slate-400 border-l border-slate-200 pl-2 whitespace-nowrap">${task.lectureName}</span>`}
             </div>
             <div class="flex items-center gap-2 text-xs font-bold tabular-nums ${isPast ? "text-red-500" : "text-slate-600"}">
                <span class="${badgeColor} px-1.5 py-0.5 rounded-sm shrink-0 whitespace-nowrap">${typeLabels[task.type]}</span>
                <i data-lucide="clock" class="w-3.5 h-3.5 opacity-70"></i>
                ${formatTaskDate(task.date)} ${task.type !== "delivery" && !task.date.includes("T00:00:00") ? formatTaskTimeOnly(task.date) : ""}
                ${isPast ? '<span class="text-[10px] bg-red-50 text-red-600 px-1 rounded uppercase tracking-wider ml-1">overdue</span>' : ""}
             </div>
          </div>
        </div>
      `;
        })
        .join("") +
      `</div>`
    );
  };

  const widgetDefs = {
    deadlines: {
      id: "deadlines",
      title: "5日以内の期限",
      icon: "alert-circle",
      iconColor: "text-red-500",
      html: generateTaskHtml(
        upcomingDeadlines,
        "直近の期限はありません。よくやりました！",
        true,
      ),
    },
    schedule: {
      id: "schedule",
      title: "直近1週間の配信予定",
      icon: "calendar",
      iconColor: "text-blue-500",
      html: generateTaskHtml(
        upcomingSchedule,
        "直近の配信予定はありません。",
        false,
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
                (task.courseId === "custom"
                  ? { name: task.lectureName, isCustom: true }
                  : { name: "不明な科目" });
              return `
             <div class="flex p-3 gap-3 items-center group relative overflow-hidden">
                <i data-lucide="check" class="w-5 h-5 text-emerald-500 mx-1"></i>
                <div class="flex-1 flex flex-col w-full min-w-0 line-through text-slate-500">
                   <div class="text-xs font-bold truncate">${course.name} ${course.isCustom ? "" : `<span class="font-normal text-slate-400">/ ${task.lectureName}</span>`}</div>
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
      html: `<textarea oninput="state.memoContent=this.value; saveData()" class="w-full border border-amber-200 bg-amber-50/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none h-32" placeholder="自由にメモを書き込めます...">${state.memoContent || ""}</textarea>`,
    },
  };

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
           <button onclick="removeWidget('${w.id}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:bg-red-50 hover:text-red-500 p-1.5 rounded-lg transition-all" aria-label="ウィジェット削除">
             <i data-lucide="x" class="w-4 h-4"></i>
           </button>
         </div>
         ${content}
      </div>
    `;
    })
    .join("");

  const inactiveWidgets = Object.values(widgetDefs).filter(
    (w) => !state.widgets.includes(w.id),
  );
  const addWidgetBtnHtml =
    inactiveWidgets.length > 0
      ? `
    <div class="relative inline-block w-full text-left" id="add-widget-dropdown">
       <button onclick="document.getElementById('widget-menu').classList.toggle('hidden')" class="border border-slate-200 border-dashed text-slate-500 hover:text-blue-600 hover:bg-slate-50 hover:border-blue-300 font-medium py-3 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1.5">
         <i data-lucide="plus-circle" class="w-4 h-4"></i> ウィジェットを追加
       </button>
       <div id="widget-menu" class="hidden absolute left-0 right-0 z-10 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden origin-top animate-in zoom-in-95">
         <div class="py-1">
           ${inactiveWidgets
             .map(
               (w) => `
             <button onclick="addWidget('${w.id}')" class="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors gap-3 border-b border-slate-100 last:border-0">
               <div class="bg-slate-100 p-1.5 rounded"><i data-lucide="${w.icon}" class="w-4 h-4 ${w.iconColor}"></i></div>
               <div class="font-bold text-left">${w.title}を追加</div>
             </button>
           `,
             )
             .join("")}
         </div>
       </div>
    </div>
  `
      : "";

  return `
    <div class="flex flex-col gap-6 animate-in fade-in pb-8">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-black text-slate-800 tracking-tight">ホーム</h2>
        <p class="text-sm text-slate-500 font-medium tracking-wide">本日のステータスと直近の予定</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        ${activeWidgetsHtml}
        ${addWidgetBtnHtml}
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
          <i data-lucide="clock" class="w-5 h-5"></i> 講義スケジュール
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
    const customNames = [...new Set(customTasks.map((t) => t.lectureName))];
    customNames.forEach((cName) => {
      baseCourses.push({
        id: "custom",
        name: cName,
        isCustom: true,
      });
    });

    const grouped = baseCourses
      .map((course) => {
        const courseTasks = state.tasks.filter((t) => {
          if (course.isCustom)
            return t.courseId === "custom" && t.lectureName === course.name;
          return t.courseId === course.id;
        });
        const map = {};
        courseTasks.forEach((t) => {
          const lecName = course.isCustom ? "登録課題" : t.lectureName;
          if (!map[lecName]) map[lecName] = [];
          map[lecName].push(t);
        });
        const lectures = Object.entries(map).map(([name, tasks]) => {
          const order = { delivery: 0, watch: 1, assignment: 2 };
          tasks.sort((a, b) => order[a.type] - order[b.type]);
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
              if (course.isCustom) {
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
                      task.type !== "delivery" &&
                      isPastButNotToday(task.date);
                    const isTodayTask =
                      !task.completed &&
                      task.type !== "delivery" &&
                      isTodayDate(task.date);

                    let checkBtn = "";
                    if (task.type !== "delivery") {
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

                    const badgeColors =
                      task.type === "assignment"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : task.type === "watch"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200";

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
                            <option value="custom" ${state.editTaskData.courseId === "custom" ? "selected" : ""}>オンデマンド以外</option>
                         </select>
                         <input type="text" id="edit-lecture-input" oninput="state.editTaskData.lectureName=this.value" value="${state.editTaskData.lectureName}" class="border border-slate-300 rounded px-2 py-1.5 text-base w-32 outline-none" placeholder="講義名" />
                         <select id="edit-type-input" onchange="state.editTaskData.type=this.value" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none bg-white">
                           <option value="delivery" ${state.editTaskData.type === "delivery" ? "selected" : ""}>配信日</option>
                           <option value="watch" ${state.editTaskData.type === "watch" ? "selected" : ""}>視聴期限</option>
                           <option value="assignment" ${state.editTaskData.type === "assignment" ? "selected" : ""}>課題提出</option>
                         </select>
                         <input type="date" id="edit-date-input" oninput="state.editTaskData.dateStr=this.value" value="${state.editTaskData.dateStr}" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[120px]" />
                         <button type="button" onclick="openCustomTimePicker('${state.editTaskData.timeStr}', 'setEditTaskTime')" class="bg-white border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[70px] text-center whitespace-nowrap overflow-hidden">${state.editTaskData.timeStr || "00:00"}</button>
                         <label class="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" id="edit-self-input" onchange="state.editTaskData.isSelfDeadline=this.checked" ${state.editTaskData.isSelfDeadline ? "checked" : ""} /> 自主期限</label>
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
                    <div class="flex-1 flex flex-wrap items-center gap-2 text-sm ${task.completed ? "opacity-50 line-through" : ""}">
                      <span class="font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                      <span class="font-bold tabular-nums ${dateColor}">${formatTaskDate(task.date)}</span>
                      ${task.isSelfDeadline ? `<span class="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">自主期限</span>` : ""}
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
                   (task.courseId === "custom"
                     ? { name: task.lectureName, isCustom: true }
                     : { name: "不明な科目" });
                 const isOverdue =
                   !task.completed &&
                   task.type !== "delivery" &&
                   isPastButNotToday(task.date);
                 const isTodayTask =
                   !task.completed &&
                   task.type !== "delivery" &&
                   isTodayDate(task.date);

                 let checkBtn = "";
                 if (task.type !== "delivery") {
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

                 const badgeColors =
                   task.type === "assignment"
                     ? "bg-red-100 text-red-700 border border-red-200"
                     : task.type === "watch"
                       ? "bg-amber-100 text-amber-700 border border-amber-200"
                       : "bg-slate-100 text-slate-700 border border-slate-200";

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
                             <option value="custom" ${state.editTaskData.courseId === "custom" ? "selected" : ""}>オンデマンド以外</option>
                           </select>
                           <input type="text" id="edit-lecture-input" oninput="state.editTaskData.lectureName=this.value" value="${state.editTaskData.lectureName}" class="border border-slate-300 rounded px-2 py-1.5 text-base w-32 outline-none" placeholder="講義名" />
                           <select id="edit-type-input" onchange="state.editTaskData.type=this.value" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none bg-white">
                             <option value="delivery" ${state.editTaskData.type === "delivery" ? "selected" : ""}>配信日</option>
                             <option value="watch" ${state.editTaskData.type === "watch" ? "selected" : ""}>視聴期限</option>
                             <option value="assignment" ${state.editTaskData.type === "assignment" ? "selected" : ""}>課題提出</option>
                           </select>
                           <input type="date" id="edit-date-input" oninput="state.editTaskData.dateStr=this.value" value="${state.editTaskData.dateStr}" class="border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[120px]" />
                           <button type="button" onclick="openCustomTimePicker('${state.editTaskData.timeStr}', 'setEditTaskTime')" class="bg-white border border-slate-300 rounded px-2 py-1.5 text-base outline-none w-auto min-w-[70px] text-center whitespace-nowrap overflow-hidden">${state.editTaskData.timeStr || "00:00"}</button>
                           <label class="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" id="edit-self-input" onchange="state.editTaskData.isSelfDeadline=this.checked" ${state.editTaskData.isSelfDeadline ? "checked" : ""} /> 自主期限</label>
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
                        <span class="font-bold text-slate-700 text-xs truncate max-w-[150px]" title="${course.name}">${course.name}</span>
                        ${course.isCustom ? "" : `<span class="text-slate-500 text-xs border-l border-slate-300 pl-2">${task.lectureName}</span>`}
                        <span class="font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColors}">${typeLabels[task.type]}</span>
                        ${task.isSelfDeadline ? `<span class="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">自主期限</span>` : ""}
                      </div>
                      <div class="text-xs font-bold tabular-nums flex items-center gap-1.5 ${dateColor}">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                        ${task.date.includes("T00:00:00") && task.type === "delivery" ? "時間未定" : formatTaskTimeOnly(task.date)}
                      </div>
                      ${task.description ? `<p class="text-xs text-slate-500 mt-0.5 truncate whitespace-normal break-words">${task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ""}
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
          <i data-lucide="clock" class="w-5 h-5"></i> 講義スケジュール
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
          : '<span class="text-slate-400 italic text-xs">説明なし</span>';
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
        <button onclick="openScheduleAdder('${course.id}')" class="mt-5 border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 font-bold py-2.5 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm">
          <i data-lucide="plus" class="w-4 h-4"></i> スケジュールを追加
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
         <button onclick="openCustomAssignment()" class="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 font-bold py-3 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-2 shadow-sm">
           <i data-lucide="pen-tool" class="w-4 h-4"></i> オンデマンド以外の課題を追加する
         </button>
      </div>
    </div>
  `;
}

function openCustomAssignment() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;

  state.showCustomAssignment = true;
  state.customAssignInput = {
    courseName: "",
    dateStr: dateStr,
    timeStr: "23:59",
    isSelfDeadline: false,
    description: "",
  };
  render();
}

function closeCustomAssignment() {
  state.showCustomAssignment = false;
  render();
}

function saveCustomAssignment() {
  const { courseName, dateStr, timeStr, isSelfDeadline, description } =
    state.customAssignInput;
  if (!courseName.trim() || !dateStr) {
    showToast("科目名と期限の日付は必須です", "error");
    return;
  }

  state.tasks.push({
    id: generateId(),
    courseId: "custom",
    lectureName: courseName.trim(), // Storing custom course name in lectureName
    type: "assignment",
    date: `${dateStr}T${timeStr || "23:59"}:00`,
    isSelfDeadline: isSelfDeadline,
    description: description.trim(),
    completed: false,
    updatedAt: Date.now(),
  });

  saveData();
  closeCustomAssignment();
  showToast("課題を追加しました");
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

function renderSettingsTab() {
  return `
    <div class="flex flex-col gap-4 animate-in fade-in">
      <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
        <i data-lucide="settings" class="w-5 h-5"></i> 設定・使い方ガイド
      </h2>
      
      <div class="bg-indigo-50 border border-indigo-100 p-5 rounded-xl shadow-sm">
        <h3 class="font-bold text-indigo-800 text-sm mb-2 flex items-center gap-2">
           <i data-lucide="info" class="w-4 h-4"></i> 基本的な使い方
        </h3>
        <ol class="list-decimal list-inside text-sm text-indigo-900 leading-relaxed space-y-2 mb-2">
          <li><strong>科目を登録する：</strong>「科目管理」タブから授業を追加し、「スケジュールを追加」から日程を一括登録します。</li>
          <li><strong>タスクの管理：</strong>「タスク」タブで、配信日・視聴期限・課題提出の予定を確認し、完了したものはチェックをつけます。</li>
          <li><strong>データのバックアップ・復元:</strong> 他の端末やブラウザにデータを移行したい場合は、「jsonデータをエクスポート」し、新しい環境で「jsonデータのインポート」を行ってください。</li>
        </ol>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div>
          <h3 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
             <i data-lucide="database" class="w-4 h-4"></i> データのバックアップ・復元
          </h3>
          <div class="text-sm text-slate-600 mb-4 leading-relaxed">
             データの復元や機種変更時の移行に使うためのJSONファイルをダウンロードできます。<br/>
             <span class="text-xs text-slate-400">※ボタンが機能しない場合は、アプリを「新しいタブで開く」からお試しください。</span>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <button onclick="exportData()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <i data-lucide="download" class="w-4 h-4"></i> jsonデータをエクスポート
            </button>
            <button onclick="openCombinedImportModal()" class="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <i data-lucide="upload" class="w-4 h-4"></i> jsonデータのインポート
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

// ------ SCHEDULE ADDER MODAL ------
let adderConfig = null;

function openScheduleAdder(courseId) {
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
    startNum: 1, // Start strictly from 1 as requested
    calendarDates: [],
    calDeliveryCheck: false,
    calDeliveryTime: "00:00",
    calWatchCheck: true,
    calWatchTime: "23:59",
    calAssignCheck: false,
    calAssignTime: "23:59",
    isSelfDeadline: false,
  };

  renderModal();
}

function closeScheduleAdder() {
  adderConfig = null;
  renderModal();
}

function updateCalField(field, value) {
  adderConfig[field] = value;
  renderModal();
}

function saveAdderTasks() {
  const newTasks = [];

  if (adderConfig.calendarDates.length === 0) {
    showToast("カレンダーで日付を1つ以上選択してください", "error");
    return;
  }

  // Sort dates chronologically
  const sortedDates = [...adderConfig.calendarDates].sort(
    (a, b) => new Date(a) - new Date(b),
  );

  sortedDates.forEach((dateStr, idx) => {
    const lectureName = `第${adderConfig.startNum + idx}回`;
    if (adderConfig.calDeliveryCheck) {
      newTasks.push({
        id: generateId(),
        courseId: adderConfig.courseId,
        lectureName,
        type: "delivery",
        date: `${dateStr}T${adderConfig.calDeliveryTime || "00:00"}:00`,
        isSelfDeadline: false,
        completed: false,
        updatedAt: Date.now(),
      });
    }
    if (adderConfig.calWatchCheck) {
      newTasks.push({
        id: generateId(),
        courseId: adderConfig.courseId,
        lectureName,
        type: "watch",
        date: `${dateStr}T${adderConfig.calWatchTime || "23:59"}:00`,
        isSelfDeadline: adderConfig.isSelfDeadline,
        completed: false,
        updatedAt: Date.now(),
      });
    }
    if (adderConfig.calAssignCheck) {
      newTasks.push({
        id: generateId(),
        courseId: adderConfig.courseId,
        lectureName,
        type: "assignment",
        date: `${dateStr}T${adderConfig.calAssignTime || "23:59"}:00`,
        isSelfDeadline: adderConfig.isSelfDeadline,
        completed: false,
        updatedAt: Date.now(),
      });
    }
  });

  if (newTasks.length === 0) {
    showToast(
      "作成するタスクの種類（視聴期限など）を選択してください",
      "error",
    );
    return;
  }

  state.tasks.push(...newTasks);
  saveData();
  closeScheduleAdder();
  render();
  showToast("スケジュールを保存しました");
}

function renderModal() {
  const root = document.getElementById("modal-root");
  if (!adderConfig) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div class="bg-white max-w-3xl w-full rounded-2xl shadow-xl flex flex-col m-auto max-h-[85dvh] md:max-h-[85vh] border border-slate-200">
        
        <div class="flex flex-col border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div class="flex justify-between items-center p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="bg-blue-100 text-blue-600 p-2 rounded-xl">
                <i data-lucide="calendar-days" class="w-6 h-6"></i>
              </div>
              <div class="flex flex-col">
                <h4 class="font-extrabold text-slate-800 text-lg tracking-tight">スケジュール追加</h4>
                <p class="text-[11px] text-slate-500 font-medium mt-0.5">授業のスケジュールをカレンダーで一括作成できます</p>
              </div>
            </div>
            <button onclick="closeScheduleAdder()" class="text-slate-400 hover:text-slate-600 p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition-colors shadow-sm">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          
          <div class="px-6 pb-4 pt-1 flex items-center justify-between border-t border-slate-100/50">
            <div class="flex items-center gap-2">
               <span class="text-xs font-bold text-slate-600">開始ナンバー:</span>
               <div class="flex items-center text-sm font-bold bg-white border border-slate-200 rounded text-slate-600 overflow-hidden focus-within:border-blue-500">
                  <span class="bg-slate-50 px-2 py-1 border-r border-slate-200">第</span>
                  <input type="number" value="${adderConfig.startNum}" onchange="adderConfig.startNum=parseInt(this.value)||1; renderModal()" class="w-12 text-center py-1 outline-none font-bold text-blue-600" min="1" />
                  <span class="bg-slate-50 px-2 py-1 border-l border-slate-200">回</span>
               </div>
            </div>
          </div>
        </div>

      <div class="flex-1 flex flex-col md:flex-row p-6 overflow-y-auto bg-slate-50/30 gap-6">
        <div class="flex flex-col gap-2 relative z-10 w-full md:w-auto">
          <p class="text-sm font-bold text-slate-700 flex items-center gap-1.5"><i data-lucide="calendar" class="w-4 h-4"></i> 日付を複数選択</p>
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flatpickr-wrapper w-full max-w-[310px]">
             <input type="text" id="multi-calendar" class="hidden" />
          </div>
          <p class="text-[11px] text-slate-500 mt-1 pl-1">※選択した順番に関わらず、日付順に第${adderConfig.startNum}回〜が割り当てられます。</p>
        </div>
        
        <div class="flex-1 flex flex-col gap-4">
           <p class="text-sm font-bold text-slate-700 mt-2 md:mt-0 flex items-center gap-1.5"><i data-lucide="settings-2" class="w-4 h-4"></i> 設定 (選択した全日に適用)</p>
           
           <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4">
             <!-- Delivery -->
             <div class="flex items-center gap-3">
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${adderConfig.calDeliveryCheck ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300 group-hover:border-blue-400"}">
                    ${adderConfig.calDeliveryCheck ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ""}
                  </div>
                  <input type="checkbox" onchange="updateCalField('calDeliveryCheck', this.checked)" class="sr-only" ${adderConfig.calDeliveryCheck ? "checked" : ""} />
                  <span class="text-xs font-bold text-slate-600 select-none">配信日</span>
               </label>
               <input id="calDeliveryTimeInput" type="hidden" value="${adderConfig.calDeliveryTime}" />
               <button type="button" onclick="openCustomTimePicker('${adderConfig.calDeliveryTime}', 'setCalDeliveryTime')" class="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-base ml-auto w-auto min-w-[100px] text-center ${!adderConfig.calDeliveryCheck ? "opacity-50 pointer-events-none" : ""}">${adderConfig.calDeliveryTime || "00:00"}</button>
             </div>
             
             <!-- Watch -->
             <div class="flex items-center gap-3">
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${adderConfig.calWatchCheck ? "bg-amber-500 border-amber-500" : "bg-white border-slate-300 group-hover:border-amber-400"}">
                    ${adderConfig.calWatchCheck ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ""}
                  </div>
                  <input type="checkbox" onchange="updateCalField('calWatchCheck', this.checked)" class="sr-only" ${adderConfig.calWatchCheck ? "checked" : ""} />
                  <span class="text-xs font-bold text-slate-600 select-none">視聴期限</span>
               </label>
               <input id="calWatchTimeInput" type="hidden" value="${adderConfig.calWatchTime}" />
               <button type="button" onclick="openCustomTimePicker('${adderConfig.calWatchTime}', 'setCalWatchTime')" class="bg-amber-50 border border-amber-300 rounded px-2 py-1.5 text-base ml-auto w-auto min-w-[100px] text-center ${!adderConfig.calWatchCheck ? "opacity-50 pointer-events-none" : ""}">${adderConfig.calWatchTime || "00:00"}</button>
             </div>
             
             <!-- Assign -->
             <div class="flex items-center gap-3">
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${adderConfig.calAssignCheck ? "bg-red-500 border-red-500" : "bg-white border-slate-300 group-hover:border-red-400"}">
                    ${adderConfig.calAssignCheck ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ""}
                  </div>
                  <input type="checkbox" onchange="updateCalField('calAssignCheck', this.checked)" class="sr-only" ${adderConfig.calAssignCheck ? "checked" : ""} />
                  <span class="text-xs font-bold text-slate-600 select-none">課題提出</span>
               </label>
               <input id="calAssignTimeInput" type="hidden" value="${adderConfig.calAssignTime}" />
               <button type="button" onclick="openCustomTimePicker('${adderConfig.calAssignTime}', 'setCalAssignTime')" class="bg-red-50 border border-red-300 rounded px-2 py-1.5 text-base ml-auto w-auto min-w-[100px] text-center ${!adderConfig.calAssignCheck ? "opacity-50 pointer-events-none" : ""}">${adderConfig.calAssignTime || "00:00"}</button>
             </div>
           </div>
        </div>
      </div>

        <div class="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <label class="flex items-center gap-3 cursor-pointer group">
              <div class="w-5 h-5 rounded flex items-center justify-center transition-colors border ${adderConfig.isSelfDeadline ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300 group-hover:border-blue-400"}">
                ${adderConfig.isSelfDeadline ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ""}
              </div>
              <input type="checkbox" onchange="adderConfig.isSelfDeadline=this.checked; renderModal()" class="sr-only" ${adderConfig.isSelfDeadline ? "checked" : ""} />
              <span class="text-sm font-bold text-slate-700 select-none">
                <span class="text-blue-600">自主的な目標期限</span>として登録する
              </span>
          </label>
          <button onclick="saveAdderTasks()" class="w-full md:w-auto bg-blue-600 text-white font-bold tracking-wide py-2.5 px-8 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
             <i data-lucide="calendar" class="w-4 h-4"></i> スケジュールを保存
          </button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) {
    lucide.createIcons();
  }

  if (typeof window.flatpickr !== "undefined") {
    flatpickr("#multi-calendar", {
      inline: true,
      mode: "multiple",
      locale: "ja",
      defaultDate: adderConfig.calendarDates,
      onChange: function (selectedDates, dateStr, instance) {
        adderConfig.calendarDates = selectedDates.map((d) => {
          const off = d.getTimezoneOffset();
          const adjusted = new Date(d.getTime() - off * 60 * 1000);
          return adjusted.toISOString().split("T")[0];
        });
      },
    });
  }
}

// ------ TIME PICKER MODAL ------
let tpConf = null;

function openCustomTimePicker(initial, callbackFuncStr) {
  let h = "00",
    m = "00";
  if (initial && initial.includes(":")) {
    const parts = initial.split(":");
    h = parts[0] || "00";
    m = parts[1] || "00";
  }
  tpConf = { h, m, callback: callbackFuncStr };
  renderCustomTimePicker();
}

function closeCustomTimePicker() {
  tpConf = null;
  renderCustomTimePicker();
}

function saveCustomTimePicker() {
  if (tpConf) {
    const timeStr = `${String(tpConf.h).padStart(2, "0")}:${String(tpConf.m).padStart(2, "0")}`;
    if (typeof window[tpConf.callback] === "function") {
      window[tpConf.callback](timeStr);
    } else {
      if (tpConf.callback === "setCalDeliveryTime") setCalDeliveryTime(timeStr);
      else if (tpConf.callback === "setCalWatchTime") setCalWatchTime(timeStr);
      else if (tpConf.callback === "setCalAssignTime")
        setCalAssignTime(timeStr);
      else if (tpConf.callback === "setEditTaskTime") setEditTaskTime(timeStr);
      else if (tpConf.callback === "setTaskModalTime")
        setTaskModalTime(timeStr);
      else console.error("Callback not found:", tpConf.callback);
    }
  }
  closeCustomTimePicker();
}

function renderCustomTimePicker() {
  let root = document.getElementById("time-picker-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "time-picker-modal-root";
    document.body.appendChild(root);
  }
  if (!tpConf) {
    root.innerHTML = "";
    return;
  }

  let hOpts = "";
  for (let i = 0; i < 24; i++) {
    let v = i.toString().padStart(2, "0");
    hOpts += `<option value="${v}" ${tpConf.h === v ? "selected" : ""}>${v}</option>`;
  }
  let mOpts = "";
  for (let i = 0; i < 60; i++) {
    let v = i.toString().padStart(2, "0");
    mOpts += `<option value="${v}" ${tpConf.m === v ? "selected" : ""}>${v}</option>`;
  }

  root.innerHTML = `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onclick="if(event.target===this) closeCustomTimePicker()">
      <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-[280px] flex flex-col gap-6">
        <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2"><i data-lucide="clock" class="w-5 h-5 text-blue-600"></i>時刻を選択</h3>
        
        <div class="flex items-center justify-center gap-3 text-xl">
           <div class="flex flex-col gap-1 items-center">
             <label class="text-xs font-bold text-slate-500">時</label>
             <select onchange="tpConf.h=this.value" class="border border-slate-300 rounded-xl px-4 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 font-bold block appearance-none text-center text-lg min-w-[70px]">
               ${hOpts}
             </select>
           </div>
           <span class="font-black text-slate-400 mt-5">:</span>
           <div class="flex flex-col gap-1 items-center">
             <label class="text-xs font-bold text-slate-500">分</label>
             <select onchange="tpConf.m=this.value" class="border border-slate-300 rounded-xl px-4 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 font-bold block appearance-none text-center text-lg min-w-[70px]">
               ${mOpts}
             </select>
           </div>
        </div>

        <div class="flex gap-2 mt-2">
           <button onclick="closeCustomTimePicker()" class="flex-1 py-3 bg-slate-100 font-bold text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-sm">キャンセル</button>
           <button onclick="saveCustomTimePicker()" class="flex-1 py-3 bg-blue-600 font-bold text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 text-sm"><i data-lucide="check" class="w-4 h-4"></i>保存</button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
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
function setEditTaskTime(v) {
  state.editTaskData.timeStr = v;
  render();
}
function setTaskModalTime(v) {
  taskModalData.timeStr = v;
  renderTaskModal();
}

// End of logic

// ------ INIT ------
loadData();
render();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .catch((err) => console.log("SW registration failed", err));
}
