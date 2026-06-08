import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ja } from 'date-fns/locale';
import { Plus, X, CalendarDays, MonitorPlay, PenLine, ArrowRight, Info, Check } from 'lucide-react';
import { useAppStore, Task } from '../store';
import { cn } from '../utils';

export default function ScheduleAdder({ courseId, onClose }: { courseId: string, onClose: () => void }) {
  const store = useAppStore();
  
  // Find highest existing lecture number for this course to auto-increment
  const existingLectures = store.tasks.filter(t => t.courseId === courseId).map(t => t.lectureName);
  let maxLectureNum = 0;
  existingLectures.forEach(name => {
    const match = name.match(/第(\d+)回/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxLectureNum) maxLectureNum = num;
    }
  });
  const autoStartNum = maxLectureNum + 1;
  
  const [cols, setCols] = useState({
    delivery: { enabled: false, dates: [] as Date[], time: '' },
    watch: { enabled: false, dates: [] as Date[], time: '23:59' },
    assign: { enabled: false, dates: [] as Date[], time: '23:59' }
  });

  const [isSelfDeadline, setIsSelfDeadline] = useState(false);

  const handleAddTasks = () => {
     const dDates = [...cols.delivery.dates].sort((a,b)=>a.getTime()-b.getTime());
     const wDates = [...cols.watch.dates].sort((a,b)=>a.getTime()-b.getTime());
     const aDates = [...cols.assign.dates].sort((a,b)=>a.getTime()-b.getTime());

     const maxLen = Math.max(
       cols.delivery.enabled ? dDates.length : 0, 
       cols.watch.enabled ? wDates.length : 0, 
       cols.assign.enabled ? aDates.length : 0
     );

     if (maxLen === 0) return alert("日付を設定してください");

     const tasksToCreate: Omit<Task, 'id' | 'completed'>[] = [];

     for (let i = 0; i < maxLen; i++) {
       const lectureName = `第${autoStartNum + i}回`;

       if (cols.delivery.enabled && dDates[i]) {
          const dateObj = new Date(dDates[i]);
          if (cols.delivery.time) {
            const [h,m] = cols.delivery.time.split(':');
            dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
          }
          tasksToCreate.push({ courseId, lectureName, type: 'delivery', date: dateObj.toISOString(), isSelfDeadline: false });
       }
       if (cols.watch.enabled && wDates[i]) {
          const dateObj = new Date(wDates[i]);
          if (cols.watch.time) {
            const [h,m] = cols.watch.time.split(':');
            dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
          }
          tasksToCreate.push({ courseId, lectureName, type: 'watch', date: dateObj.toISOString(), isSelfDeadline });
       }
       if (cols.assign.enabled && aDates[i]) {
          const dateObj = new Date(aDates[i]);
          if (cols.assign.time) {
            const [h,m] = cols.assign.time.split(':');
            dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
          }
          tasksToCreate.push({ courseId, lectureName, type: 'assignment', date: dateObj.toISOString(), isSelfDeadline });
       }
     }

     store.addBatchTasks(tasksToCreate);
     onClose();
  };
  
  const updateCol = (type: 'delivery'|'watch'|'assign', fields: any) => {
    setCols(prev => ({ ...prev, [type]: { ...prev[type], ...fields } }));
  };

  const getIcon = (type: string) => {
    if (type === 'delivery') return <CalendarDays className="w-5 h-5" />;
    if (type === 'watch') return <MonitorPlay className="w-5 h-5" />;
    return <PenLine className="w-5 h-5" />;
  };

  const getColor = (type: string) => {
    if (type === 'delivery') return 'text-slate-600 bg-slate-100 border-slate-200';
    if (type === 'watch') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getActiveColor = (type: string) => {
    if (type === 'delivery') return 'border-slate-300 ring-slate-100';
    if (type === 'watch') return 'border-amber-300 ring-amber-50';
    return 'border-red-300 ring-red-50';
  };

  const renderColUI = ({ type, label, data, step }: { type: 'delivery'|'watch'|'assign', label: string, data: any, step: number }) => (
    <div className={cn(
      "flex flex-col rounded-2xl border-2 transition-all duration-300 w-full max-w-sm shrink-0 relative overflow-hidden", 
      data.enabled 
        ? cn("bg-white shadow-md ring-4", getActiveColor(type))
        : "bg-slate-50/50 border-slate-100 opacity-75 hover:opacity-100"
    )} key={type}>
       {/* Header Toggle Area */}
       <div 
         className={cn(
           "flex items-center justify-between p-4 cursor-pointer select-none transition-colors",
           data.enabled ? "bg-slate-50/50 border-b border-slate-100/50" : "hover:bg-slate-100/50"
         )}
         onClick={() => updateCol(type, { enabled: !data.enabled })}
       >
          <div className="flex items-center gap-3">
             <div className={cn("p-2 rounded-xl border flex items-center justify-center transition-colors", data.enabled ? getColor(type) : "bg-white border-slate-200 text-slate-400")}>
               {getIcon(type)}
             </div>
             <div>
               <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-0.5">Step {step}</div>
               <h5 className={cn("font-bold transition-colors", data.enabled ? "text-slate-800" : "text-slate-500")}>{label}</h5>
             </div>
          </div>
          
          {/* Toggle Switch */}
          <div className={cn("w-11 h-6 rounded-full transition-colors relative", data.enabled ? "bg-blue-500" : "bg-slate-200")}>
            <div className={cn("absolute top-1 transform transition-transform bg-white w-4 h-4 rounded-full shadow-sm", data.enabled ? "translate-x-6 left-0" : "translate-x-1 left-0")}></div>
          </div>
       </div>

       {/* Expanded Content */}
       <div className={cn("grid transition-[grid-template-rows] duration-300 ease-in-out", data.enabled ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
         <div className="overflow-hidden">
           <div className="p-4 flex flex-col gap-4">
             {/* Calendar area */}
             <div className="bg-white rounded-xl border border-slate-200 p-4 flex justify-center shadow-sm w-full mx-auto">
               <DayPicker
                 mode="multiple"
                 locale={ja}
                 selected={data.dates}
                 onSelect={ds => updateCol(type, { dates: ds || [] })}
                 className="m-0"
                 modifiersClassNames={{
                   selected: 'bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700',
                   today: 'bg-slate-100 text-blue-600 font-bold rounded-lg text-lg'
                 }}
               />
             </div>
             {/* Time Input */}
             <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                  {type === 'delivery' ? '配信時刻' : '期限時刻'}
                </div>
                <input 
                  type="time" 
                  value={data.time} 
                  onChange={e => updateCol(type, { time: e.target.value })} 
                  className="w-full text-base font-bold text-slate-800 border-none bg-transparent focus:ring-0 outline-none p-0" 
                />
             </div>
           </div>
         </div>
       </div>
    </div>
  );

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white max-w-5xl w-full rounded-2xl shadow-xl flex flex-col m-auto animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-hidden border border-slate-200">
           
           {/* Header */}
           <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
             <div className="flex items-center gap-3">
               <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                 <CalendarDays className="w-6 h-6" />
               </div>
               <div className="flex flex-col">
                 <h4 className="font-extrabold text-slate-800 text-xl tracking-tight">スケジュール構造の作成</h4>
                 <p className="text-sm text-slate-500 font-medium mt-0.5">有効にしたいステップをオンにして、カレンダーから日付を選択してください。</p>
               </div>
             </div>
             <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition-colors shadow-sm"><X className="w-5 h-5" /></button>
           </div>

           {/* Scrollable Content Area */}
           <div className="p-6 overflow-y-auto">
             
             {/* Info Alert */}
             <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 font-medium leading-relaxed">
                  選択した日付の数に合わせてタスクが生成されます。<br/>
                  現在一番選択されている日付の数に合わせて、<strong className="bg-blue-100 px-1.5 py-0.5 rounded ml-1">第{autoStartNum}回</strong> から自動で連番の講義名が付きます。
                </div>
             </div>

             {/* Columns */}
             <div className="flex flex-col gap-2 items-center justify-center">
                {renderColUI({ type: 'delivery', label: '配信日', data: cols.delivery, step: 1 })}
                <div className="flex self-center text-slate-300 transform rotate-90 my-1">
                  <ArrowRight className="w-6 h-6 stroke-[2]" />
                </div>
                {renderColUI({ type: 'watch', label: '視聴期限', data: cols.watch, step: 2 })}
                <div className="flex self-center text-slate-300 transform rotate-90 my-1">
                  <ArrowRight className="w-6 h-6 stroke-[2]" />
                </div>
                {renderColUI({ type: 'assign', label: '課題提出', data: cols.assign, step: 3 })}
             </div>
           </div>

           {/* Footer Actions */}
           <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
              <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={cn("w-6 h-6 rounded-md flex items-center justify-center transition-colors border", isSelfDeadline ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300 group-hover:border-blue-400")}>
                    {isSelfDeadline && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <input type="checkbox" checked={isSelfDeadline} onChange={e => setIsSelfDeadline(e.target.checked)} className="sr-only" />
                  <span className="text-sm font-bold text-slate-700 select-none">
                    先生による指定ではなく、<span className="text-blue-600">自主的な目標期限</span>として登録する
                  </span>
              </label>

              <button 
                onClick={handleAddTasks} 
                className="w-full md:w-auto bg-slate-800 text-white font-bold tracking-wide py-3 px-8 rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
              >
                 <Plus className="w-5 h-5" />
                 タスクを一括生成
              </button>
           </div>
        </div>
     </div>
  );
}

