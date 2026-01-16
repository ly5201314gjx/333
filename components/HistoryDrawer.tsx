import React, { useState } from 'react';
import { DailyLog, ReviewNote, CategoryMeta, CategoryId, QuestionRecord } from '../types';
import { Icon } from './Icons';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: DailyLog[];
  reviews: ReviewNote[];
  onDeleteRange: (startDate: string, endDate: string) => void;
  onDeleteLog: (logId: string) => void;
}

export const HistoryDrawer: React.FC<Props> = ({ isOpen, onClose, logs, reviews, onDeleteRange, onDeleteLog }) => {
  // Filter State
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Delete UI State
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [deleteStart, setDeleteStart] = useState('');
  const [deleteEnd, setDeleteEnd] = useState('');
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0); // 0: Idle, 1: Range Pick, 2: Confirm 1, 3: Confirm 2, 4: Execute
  const [estimatedSize, setEstimatedSize] = useState('');

  // Individual Log Deletion State
  const [logToDelete, setLogToDelete] = useState<string | null>(null);

  // Group data by date
  const groupedData = React.useMemo(() => {
      let dates = new Set([
        ...logs.map(l => l.date),
        ...reviews.map(r => r.date.split(' ')[0])
      ]);
      
      let dateArray = Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      // Date Range Filter Logic
      if (filterStart) {
          dateArray = dateArray.filter(d => d >= filterStart);
      }
      if (filterEnd) {
          dateArray = dateArray.filter(d => d <= filterEnd);
      }

      return dateArray;
  }, [logs, reviews, filterStart, filterEnd]);

  const getLogsForDate = (date: string) => logs.filter(l => l.date === date).sort((a, b) => b.timestamp - a.timestamp);
  const getReviewsForDate = (date: string) => reviews.filter(r => r.date.startsWith(date)).sort((a, b) => b.timestamp - a.timestamp);

  const downloadSingleLog = (log: DailyLog) => {
      let csvContent = "日期,时间,科目,总题数,答对数,正确率,用时(分)\n";
      const timeStr = format(new Date(log.timestamp), 'HH:mm:ss');
      
      (Object.keys(log.categories) as CategoryId[]).forEach(cat => {
          const d = log.categories[cat];
          if(d.total > 0) {
              const acc = Math.round((d.correct/d.total)*100);
              csvContent += `${log.date},${timeStr},${CategoryMeta[cat].label},${d.total},${d.correct},${acc}%,${d.duration}\n`;
          }
      });

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `打卡记录_${log.date}_${format(new Date(log.timestamp), 'HHmm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const calculateTotal = (dailyLogs: DailyLog[]) => {
      let totalQ = 0, totalC = 0, totalT = 0;
      dailyLogs.forEach(l => {
          Object.values(l.categories).forEach(c => {
              totalQ += c.total;
              totalC += c.correct;
              totalT += c.duration;
          });
      });
      return { totalQ, totalC, totalT, accuracy: totalQ > 0 ? Math.round((totalC/totalQ)*100) : 0 };
  };

  const formatBytes = (bytes: number, decimals = 2) => {
      if (!+bytes) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const calculateDataSize = (startStr: string, endStr: string) => {
      if (!startStr || !endStr) return '0 Bytes';
      const start = new Date(startStr).setHours(0,0,0,0);
      const end = new Date(endStr).setHours(23,59,59,999);
      
      const logsInRange = logs.filter(l => {
         const t = l.timestamp || new Date(l.date).getTime();
         return t >= start && t <= end;
      });
      const reviewsInRange = reviews.filter(r => {
         const t = r.timestamp;
         return t >= start && t <= end;
      });

      const jsonStr = JSON.stringify({ logs: logsInRange, reviews: reviewsInRange });
      const sizeInBytes = new Blob([jsonStr]).size;
      return formatBytes(sizeInBytes);
  };

  const handleDeleteFlow = () => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1); // Show Picker
    } else if (deleteConfirmStep === 1) {
      if (!deleteStart || !deleteEnd) return; // Validation
      setDeleteConfirmStep(2); // First Warning
    } else if (deleteConfirmStep === 2) {
      // Calculate Size
      const size = calculateDataSize(deleteStart, deleteEnd);
      setEstimatedSize(size);
      setDeleteConfirmStep(3); // Second Warning with Size
    } else if (deleteConfirmStep === 3) {
      // Execute
      onDeleteRange(deleteStart, deleteEnd);
      // Reset
      setDeleteConfirmStep(0);
      setIsDeleteMode(false);
      setDeleteStart('');
      setDeleteEnd('');
      setEstimatedSize('');
    }
  };

  const confirmDeleteLog = (id: string) => {
     onDeleteLog(id);
     setLogToDelete(null);
  };

  const getDeleteButtonText = () => {
    switch (deleteConfirmStep) {
      case 1: return "下一步: 确认范围";
      case 2: return "警告: 确认删除? (1/2)";
      case 3: return `最终确认: 释放 ${estimatedSize} (2/2)`;
      default: return "批量清除数据";
    }
  };

  const getDeleteButtonColor = () => {
    switch (deleteConfirmStep) {
        case 2: return "bg-orange-500 hover:bg-orange-600";
        case 3: return "bg-red-600 hover:bg-red-700 animate-pulse";
        default: return "bg-stone-800 hover:bg-stone-700";
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div className={`fixed top-0 left-0 h-full w-full md:w-[520px] bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 border-b border-stone-100 bg-stone-50/50">
           <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-stone-200 rounded-lg text-stone-600">
                    <Icon name="History" size={20} />
                  </div>
                  <h2 className="text-xl font-semibold text-stone-800">历史档案</h2>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 transition-colors">
                  <Icon name="X" size={20} />
               </button>
           </div>
           
           {/* Date Range Filter */}
           <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-sm w-full">
                <Icon name="Calendar" size={14} className="text-stone-400 shrink-0" />
                
                <input 
                  type="date" 
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="bg-transparent text-sm text-stone-600 focus:outline-none w-full min-w-0"
                />
                
                <span className="text-stone-300 shrink-0">-</span>
                
                <input 
                  type="date" 
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className="bg-transparent text-sm text-stone-600 focus:outline-none w-full min-w-0"
                />

                {(filterStart || filterEnd) && (
                    <button 
                        onClick={() => { setFilterStart(''); setFilterEnd(''); }} 
                        className="text-stone-400 hover:text-stone-600 shrink-0 p-1"
                        title="清除筛选"
                    >
                        <Icon name="X" size={14} />
                    </button>
                )}
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-stone-50/30">
            {groupedData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400">
                    <Icon name="Calendar" size={48} className="mb-4 opacity-20" />
                    <p>暂无历史记录</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {groupedData.map(date => {
                        const dailyLogs = getLogsForDate(date);
                        const dailyReviews = getReviewsForDate(date);
                        const daySummary = calculateTotal(dailyLogs);

                        return (
                            <div key={date} className="relative">
                                {/* Date Header */}
                                <div className="flex items-baseline justify-between mb-4 sticky top-0 bg-white/95 backdrop-blur py-2 z-10 border-b border-stone-100">
                                    <h3 className="text-lg font-bold text-stone-800 font-mono tracking-tight">
                                        {format(new Date(date), 'yyyy年MM月dd日')}
                                    </h3>
                                    <span className="text-xs text-stone-400 font-medium bg-stone-100 px-2 py-1 rounded-md">
                                        当日汇总: {daySummary.totalQ}题
                                    </span>
                                </div>

                                {/* Daily Summary Card */}
                                {dailyLogs.length > 0 && (
                                    <div className="bg-gradient-to-br from-stone-800 to-stone-700 rounded-2xl p-5 text-white shadow-lg mb-6 mx-1">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">全天总览</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${daySummary.accuracy >= 75 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-stone-600 text-stone-300'}`}>
                                                综合正确率 {daySummary.accuracy}%
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold">{daySummary.totalQ}</div>
                                                <div className="text-xs text-stone-400 mt-1">总刷题</div>
                                            </div>
                                            <div className="text-center border-l border-white/10">
                                                <div className="text-2xl font-bold">{daySummary.totalC}</div>
                                                <div className="text-xs text-stone-400 mt-1">答对</div>
                                            </div>
                                            <div className="text-center border-l border-white/10">
                                                <div className="text-2xl font-bold">{daySummary.totalT}</div>
                                                <div className="text-xs text-stone-400 mt-1">总耗时(分)</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Individual Sessions Timeline */}
                                <div className="space-y-6 pl-4 border-l-2 border-stone-100 ml-2">
                                    {/* Merge Logs and Reviews into a single timeline sorted by time */}
                                    {[
                                        ...dailyLogs.map(l => ({ type: 'log', data: l, ts: l.timestamp })),
                                        ...dailyReviews.map(r => ({ type: 'review', data: r, ts: r.timestamp }))
                                    ].sort((a, b) => b.ts - a.ts).map((item, idx) => {
                                        const timeLabel = format(new Date(item.ts), 'HH:mm:ss');
                                        
                                        if (item.type === 'log') {
                                            const l = item.data as DailyLog;
                                            const isConfirmingDelete = logToDelete === l.id;
                                            
                                            const sessionTotal = Object.values(l.categories).reduce((acc, c) => acc + c.total, 0);
                                            const sessionCorrect = Object.values(l.categories).reduce((acc, c) => acc + c.correct, 0);
                                            const sessionAcc = sessionTotal > 0 ? Math.round((sessionCorrect/sessionTotal)*100) : 0;

                                            return (
                                                <div key={`log-${l.id}`} className="relative pl-6">
                                                    <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-stone-300"></div>
                                                    
                                                    <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition-all group relative overflow-hidden">
                                                        
                                                        {/* Delete Confirmation Overlay */}
                                                        {isConfirmingDelete && (
                                                            <div className="absolute inset-0 z-20 bg-stone-50/95 flex flex-col items-center justify-center p-4 animate-fade-in">
                                                                <p className="text-sm font-semibold text-stone-800 mb-3">确认删除此条记录?</p>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={() => setLogToDelete(null)}
                                                                        className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 text-xs hover:bg-white"
                                                                    >
                                                                        取消
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => confirmDeleteLog(l.id)}
                                                                        className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 shadow-sm"
                                                                    >
                                                                        确认删除
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded font-mono">{timeLabel}</span>
                                                                <span className="text-xs text-stone-400">打卡记录</span>
                                                            </div>
                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => downloadSingleLog(l)}
                                                                    className="text-stone-300 hover:text-stone-600"
                                                                    title="导出"
                                                                >
                                                                    <Icon name="Download" size={16} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setLogToDelete(l.id)}
                                                                    className="text-stone-300 hover:text-red-500"
                                                                    title="删除"
                                                                >
                                                                    <Icon name="Trash2" size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            {(Object.keys(l.categories) as CategoryId[]).map(cat => {
                                                                const d = l.categories[cat];
                                                                if (d.total === 0) return null;
                                                                const meta = CategoryMeta[cat];
                                                                const cAcc = Math.round((d.correct/d.total)*100);
                                                                return (
                                                                    <div key={cat} className="flex items-center justify-between text-xs text-stone-600">
                                                                        <div className="flex items-center gap-1.5 w-24">
                                                                            <Icon name={meta.icon as any} size={12} className={meta.color}/>
                                                                            <span>{meta.label}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-1 text-stone-400">
                                                                            <Icon name="Clock" size={10} />
                                                                            <span>{d.duration}m</span>
                                                                        </div>

                                                                        <div className="flex items-center gap-3 justify-end flex-1">
                                                                            <span className="text-stone-400 font-mono">{d.correct}/{d.total}</span>
                                                                            <span className={`${cAcc >= 80 ? 'text-emerald-600' : 'text-stone-500'} font-medium w-8 text-right`}>{cAcc}%</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-3 pt-2 border-t border-stone-50 flex justify-between text-xs text-stone-400">
                                                            <span>合计: {sessionTotal}题</span>
                                                            <span>正确率: {sessionAcc}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            const r = item.data as ReviewNote;
                                            return (
                                                <div key={`rev-${r.id}`} className="relative pl-6">
                                                     <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-stone-100 border-2 border-stone-300"></div>
                                                     <div className="bg-stone-50 rounded-xl border border-stone-100/50 p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-xs font-mono text-stone-400">{timeLabel}</span>
                                                            <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                                                                <Icon name="PenTool" size={10} />
                                                                复盘笔记
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                                                            {r.content}
                                                        </p>
                                                     </div>
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Data Management Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50">
           {!isDeleteMode ? (
             <button 
               onClick={() => { setIsDeleteMode(true); setDeleteConfirmStep(1); }}
               className="w-full flex items-center justify-center gap-2 text-stone-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all text-sm"
             >
                <Icon name="Trash2" size={16} />
                <span>批量数据管理</span>
             </button>
           ) : (
             <div className="animate-fade-in space-y-3">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="text-sm font-semibold text-stone-700">批量删除数据</h4>
                 <button onClick={() => { setIsDeleteMode(false); setDeleteConfirmStep(0); }} className="text-stone-400 hover:text-stone-600">
                   <Icon name="X" size={16} />
                 </button>
               </div>
               
               {deleteConfirmStep === 1 && (
                 <div className="flex items-center gap-2 bg-white p-2 rounded border border-stone-200">
                    <input 
                      type="date" 
                      value={deleteStart}
                      onChange={(e) => setDeleteStart(e.target.value)}
                      className="bg-transparent text-xs text-stone-600 focus:outline-none flex-1"
                    />
                    <span className="text-stone-300">-</span>
                    <input 
                      type="date" 
                      value={deleteEnd}
                      onChange={(e) => setDeleteEnd(e.target.value)}
                      className="bg-transparent text-xs text-stone-600 focus:outline-none flex-1"
                    />
                 </div>
               )}

               <button 
                 onClick={handleDeleteFlow}
                 disabled={deleteConfirmStep === 1 && (!deleteStart || !deleteEnd)}
                 className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-all shadow-md ${getDeleteButtonColor()} disabled:opacity-50 disabled:cursor-not-allowed`}
               >
                 {getDeleteButtonText()}
               </button>
               
               {deleteConfirmStep > 1 && (
                  <p className="text-xs text-center text-red-500">此操作不可撤销，请谨慎操作</p>
               )}
             </div>
           )}
        </div>
      </div>
    </>
  );
};