import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { Calendar as CalendarIcon, CheckCircle, Circle, Plus, Trash2, Settings, Download, Upload, Clock, BookOpen, AlertCircle, Bell, X } from 'lucide-react';
import { useAppStore, TaskType, Course, Task } from './store';
import { setupNotifications } from './notifications';
import { cn } from './utils';
import ScheduleAdder from './components/ScheduleAdder';

// Utility to render task type
const formatTaskType = (type: TaskType) => {
  switch (type) {
    case 'delivery': return '配信日';
    case 'watch': return '視聴期限';
    case 'assignment': return '課題期限';
  }
};

const formatTaskDate = (isoString: string) => {
  const d = new Date(isoString);
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return format(d, 'M/d (E)', { locale: ja });
  }
  return format(d, 'M/d (E) HH:mm', { locale: ja });
};

export default function App() {
  const store = useAppStore();
  const [activeTab, setActiveTab] = useState<'tasks' | 'courses' | 'settings'>('tasks');
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseNameInput, setCourseNameInput] = useState('');
  const [courseDescInput, setCourseDescInput] = useState('');

  // Course -> Add Task State
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // Edit course logic
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseDesc, setEditCourseDesc] = useState('');

  useEffect(() => {
    if (store.isLoaded) {
      setupNotifications(store.tasks);
    }
  }, [store.tasks, store.isLoaded]);

  // Grouped Tasks Array
  const groupedCourses = useMemo(() => {
    return store.courses.map(course => {
      const courseTasks = store.tasks.filter(t => t.courseId === course.id);
      
      const lectureMap = new Map<string, Task[]>();
      courseTasks.forEach(task => {
        if (!lectureMap.has(task.lectureName)) {
           lectureMap.set(task.lectureName, []);
        }
        lectureMap.get(task.lectureName)!.push(task);
      });
      
      const lectures = Array.from(lectureMap.entries()).map(([name, tasks]) => ({
        name,
        // Sort tasks inside lecture: delivery -> watch -> assignment
        tasks: tasks.sort((a, b) => {
           const order = { delivery: 0, watch: 1, assignment: 2 };
           return order[a.type] - order[b.type];
        })
      }));

      // Sort lectures by their earliest task date
      lectures.sort((a, b) => {
         const earliestA = Math.min(...a.tasks.map(t => new Date(t.date).getTime()));
         const earliestB = Math.min(...b.tasks.map(t => new Date(t.date).getTime()));
         return earliestA - earliestB;
      });

      return { course, lectures };
    }).filter(c => c.lectures.length > 0);
  }, [store.courses, store.tasks]);

  const handleCreateCourse = () => {
    if (!courseNameInput.trim()) return;
    store.addCourse(courseNameInput, courseDescInput);
    setCourseNameInput('');
    setCourseDescInput('');
    setShowAddCourse(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === 'string') {
        store.importData(ev.target.result);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!store.isLoaded) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20 sm:pb-0">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          オンデマンド受講管理
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto p-4 flex flex-col gap-4">
        
        {/* Tasks Tab (Grouped by Course and Lecture) */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-4 space-y-2 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              講義スケジュール
            </h2>
            {groupedCourses.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
                表示するタスクがありません。科目管理からタスクを追加してください。
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {groupedCourses.map(({ course, lectures }) => (
                  <div key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-blue-50/50 border-b border-slate-200 px-4 py-3">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                         <BookOpen className="w-4 h-4 text-blue-600" />
                         {course.name}
                      </h3>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                       {lectures.map(lecture => (
                         <div key={lecture.name} className="flex flex-col gap-2">
                           <h4 className="font-bold text-slate-700 text-sm ml-1">{lecture.name}</h4>
                           <div className="grid grid-cols-1 gap-2 pl-4 border-l-2 border-slate-100">
                             {lecture.tasks.map(task => {
                               const isOverdue = !task.completed && task.type !== 'delivery' && isPast(new Date(task.date)) && !isToday(new Date(task.date));
                               const isTodayTask = !task.completed && task.type !== 'delivery' && isToday(new Date(task.date));
                               
                               return (
                                 <div key={task.id} className="flex items-center gap-3">
                                   <div className="flex items-center justify-center w-6 shrink-0">
                                     {task.type !== 'delivery' ? (
                                        <button 
                                          onClick={() => store.toggleTaskCompletion(task.id)}
                                          className={cn(
                                            "transition-colors",
                                            task.completed ? "text-slate-400" : "text-blue-600 hover:text-blue-700",
                                            isOverdue ? "text-red-500" : ""
                                          )}
                                        >
                                          {task.completed ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                        </button>
                                     ) : (
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                     )}
                                   </div>
                                   <div className={cn(
                                     "flex-1 flex flex-wrap items-center gap-2 text-sm",
                                     task.completed ? "opacity-50 line-through" : ""
                                   )}>
                                     <span className={cn(
                                        "font-medium text-xs px-2 py-0.5 rounded-full shrink-0",
                                        task.type === 'assignment' ? "bg-red-100 text-red-700" :
                                        task.type === 'watch' ? "bg-amber-100 text-amber-700" :
                                        "bg-slate-100 text-slate-700"
                                     )}>
                                        {formatTaskType(task.type)}
                                     </span>
                                     <span className={cn(
                                       "font-bold tabular-nums",
                                       isOverdue && !task.completed ? "text-red-600" : 
                                       isTodayTask ? "text-amber-600" : "text-slate-700"
                                     )}>
                                        {formatTaskDate(task.date)}
                                     </span>
                                     {task.isSelfDeadline && (
                                       <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded shrink-0">
                                          自主期限
                                       </span>
                                     )}
                                   </div>
                                   <button 
                                     onClick={() => store.deleteTask(task.id)}
                                     className="text-slate-300 hover:text-red-500 p-1 shrink-0 transition-colors"
                                   >
                                     <X className="w-4 h-4" />
                                   </button>
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                登録科目
              </h2>
              <button 
                onClick={() => setShowAddCourse(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" />
                科目を追加
              </button>
            </div>

            {showAddCourse && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 animate-in slide-in-from-top-2">
                <h3 className="font-bold text-slate-700">新規科目の追加</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">科目名</label>
                  <input 
                    type="text" 
                    value={courseNameInput}
                    onChange={(e) => setCourseNameInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: 情報学基礎"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">科目説明 (任意)</label>
                  <textarea 
                    value={courseDescInput}
                    onChange={(e) => setCourseDescInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                    placeholder="例: 第1クォーター 月曜2限"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button 
                    onClick={() => setShowAddCourse(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleCreateCourse}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    disabled={!courseNameInput.trim()}
                  >
                    保存する
                  </button>
                </div>
              </div>
            )}

            {store.courses.length === 0 && !showAddCourse && (
              <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
                まだ登録されている科目がありません。
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {store.courses.map(course => (
                <div key={course.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-800">{course.name}</h3>
                      {editingCourseId === course.id ? (
                        <div className="mt-2 flex flex-col gap-2">
                           <textarea
                             value={editCourseDesc}
                             onChange={(e) => setEditCourseDesc(e.target.value)}
                             className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16"
                           />
                           <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingCourseId(null)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">キャンセル</button>
                              <button onClick={() => {
                                store.updateCourseDescription(course.id, editCourseDesc);
                                setEditingCourseId(null);
                              }} className="text-xs bg-blue-100/50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-md transition-colors">保存する</button>
                           </div>
                        </div>
                      ) : (
                        <div 
                          className="mt-1 group cursor-pointer"
                          onClick={() => {
                             setEditingCourseId(course.id);
                             setEditCourseDesc(course.description);
                          }}
                        >
                          <p className="text-sm text-slate-500 whitespace-pre-wrap transition-colors group-hover:text-slate-600">
                            {course.description || <span className="text-slate-300 italic text-xs">説明なし (クリックで追加)</span>}
                          </p>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                         if (window.confirm('この科目を削除しますか？関連するタスクもすべて削除されます。')) {
                           store.deleteCourse(course.id);
                         }
                      }}
                      className="text-slate-300 hover:bg-red-50 hover:text-red-500 p-1.5 rounded-lg transition-colors ml-4"
                      aria-label="科目削除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Task Addition UI via ScheduleAdder component */}
                  {activeCourseId === course.id ? (
                    <ScheduleAdder courseId={course.id} onClose={() => setActiveCourseId(null)} />
                  ) : (
                    <button 
                      onClick={() => setActiveCourseId(course.id)}
                      className="mt-5 border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 font-bold py-2.5 px-4 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      スケジュールを追加
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              設定・その他
            </h2>
            
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
              
              <div>
                <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                   <Bell className="w-4 h-4" /> 通知設定
                </h3>
                <div className="text-sm text-slate-600 mb-3 leading-relaxed">
                   端末のプッシュ通知を許可すると、アプリを開いていなくても期限が近づいた際にリマインドを受け取ることができます。
                   <br/><span className="text-xs text-slate-400">※ブラウザやOSの仕様により、アプリを開いている間のみ機能する場合があります。</span>
                </div>
                <button 
                  onClick={() => {
                    if ("Notification" in window) {
                      Notification.requestPermission().then(r => {
                         alert(r === 'granted' ? '通知が許可されました。' : '通知が拒否されました。設定から変更してください。');
                      });
                    } else {
                      alert('ご利用のブラウザは通知をサポートしていません。');
                    }
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  通知の許可をリクエスト
                </button>
              </div>

              <hr className="border-slate-100" />

              <div>
                <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                   <AlertCircle className="w-4 h-4" /> データ管理
                </h3>
                <div className="text-sm text-slate-600 mb-3 leading-relaxed">
                   データはログイン不要でブラウザに自動保存されます。機種変更の際などはデータをエクスポートして新しい端末でインポートしてください。
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={store.exportData}
                    className="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    エクスポート
                  </button>
                  <label className="flex-1 min-w-[120px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    インポート
                    <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Basic Bottom Navigation for Mobile / Fixed sidebar on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 sm:border-t-0 justify-around p-2 flex sm:hidden z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <NavButton 
          active={activeTab === 'tasks'} 
          onClick={() => setActiveTab('tasks')} 
          icon={<Clock className="w-6 h-6" />} 
          label="タスク" 
        />
        <NavButton 
          active={activeTab === 'courses'} 
          onClick={() => setActiveTab('courses')} 
          icon={<BookOpen className="w-6 h-6" />} 
          label="科目管理" 
        />
        <NavButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<Settings className="w-6 h-6" />} 
          label="設定" 
        />
      </nav>

      {/* Desktop side nav logic can be handled via CSS max-w or flex, but keeping it simple below for full width with bottom nav visually mapped to top mostly. Instead of complex responsive design, let's just make it a bottom nav everywhere, or absolute for Desktop? Let's hide bottom nav on SM and make top nav tabs on SM. */}
      {/* Tab bar for SM and larger */}
      <div className="hidden sm:flex fixed bottom-0 top-0 left-0 w-64 bg-slate-900 flex-col py-6 shadow-xl z-20">
         <div className="px-6 pb-6 text-white text-lg font-bold flex items-center gap-2 border-b border-slate-800">
           <BookOpen className="w-6 h-6 text-blue-400" />
           <span className="leading-tight">オンデマンド<br/>受講管理</span>
         </div>
         <div className="flex-1 py-4 flex flex-col gap-2 px-4">
            <DesktopNavButton 
              active={activeTab === 'tasks'} 
              onClick={() => setActiveTab('tasks')} 
              icon={<Clock className="w-5 h-5" />} 
              label="タスク (Home)" 
            />
            <DesktopNavButton 
              active={activeTab === 'courses'} 
              onClick={() => setActiveTab('courses')} 
              icon={<BookOpen className="w-5 h-5" />} 
              label="科目管理" 
            />
            <DesktopNavButton 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={<Settings className="w-5 h-5" />} 
              label="設定とデータ" 
            />
         </div>
      </div>
      
      {/* Desktop padding hack */}
      <style>{`
        @media (min-width: 640px) {
          main, header { padding-left: 17rem; }
          header { display: none; }
          main { max-width: 1000px; margin: 0 auto; margin-top: 2rem; }
        }
      `}</style>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 w-full transition-colors rounded-xl",
        active ? "text-blue-600" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function DesktopNavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-left",
        active ? "bg-blue-600 text-white shadow-md shadow-blue-900/50" : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
