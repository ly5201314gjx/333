import React, { useState, useEffect } from 'react';
import { loadState, saveState, generateId } from './services/storage';
import { AppState, DailyLog, ExamTarget, ReviewNote } from './types';
import { FloatingCountdown } from './components/FloatingCountdown';
import { DailyCheckIn } from './components/DailyCheckIn';
import { StatsDashboard } from './components/StatsDashboard';
import { ReviewSection } from './components/ReviewSection';
import { HistoryDrawer } from './components/HistoryDrawer';
import { Icon } from './components/Icons';
import { format } from 'date-fns';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Session Key controls the DailyCheckIn form reset
  const [sessionKey, setSessionKey] = useState(0);

  // Modal State
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newTargetColor, setNewTargetColor] = useState('#57534e');

  // Refresh Confirmation UI State
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentTarget = state.targets.find(t => t.id === state.selectedTargetId);
  const currentLogs = state.selectedTargetId ? (state.logs[state.selectedTargetId] || []) : [];
  const currentReviews = state.selectedTargetId ? (state.reviews?.[state.selectedTargetId] || []) : [];

  const handleCreateTarget = () => {
    if (!newTargetName || !newTargetDate) return;
    
    const newTarget: ExamTarget = {
      id: generateId(),
      name: newTargetName,
      examDate: newTargetDate,
      color: newTargetColor,
      createdAt: Date.now()
    };

    setState(prev => ({
      ...prev,
      targets: [...prev.targets, newTarget],
      selectedTargetId: newTarget.id
    }));

    setIsModalOpen(false);
    resetModal();
  };

  const handleDeleteTarget = (id: string) => {
    setState(prev => {
        const newTargets = prev.targets.filter(t => t.id !== id);
        return {
            ...prev,
            targets: newTargets,
            selectedTargetId: newTargets.length > 0 ? newTargets[0].id : null
        };
    });
  };

  const resetModal = () => {
    setNewTargetName('');
    setNewTargetDate('');
    setNewTargetColor('#57534e');
  };

  const handleSaveLog = (logData: DailyLog) => {
    if (!state.selectedTargetId) return;
    
    // Always create a NEW log entry (Multiple check-ins per day)
    const newLog: DailyLog = {
        ...logData,
        id: generateId(), // Ensure unique ID
    };

    setState(prev => {
        const targetLogs = prev.logs[prev.selectedTargetId!] || [];
        return {
            ...prev,
            logs: {
                ...prev.logs,
                [prev.selectedTargetId!]: [...targetLogs, newLog]
            }
        };
    });

    // Auto-refresh session after save to allow next entry immediately if desired
    setSessionKey(prev => prev + 1);
  };

  const handleSaveReview = (content: string) => {
      if (!state.selectedTargetId) return;

      const newReview: ReviewNote = {
          id: generateId(),
          date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          content,
          targetId: state.selectedTargetId,
          timestamp: Date.now()
      };

      setState(prev => {
          const targetReviews = prev.reviews?.[prev.selectedTargetId!] || [];
          return {
              ...prev,
              reviews: {
                  ...prev.reviews,
                  [prev.selectedTargetId!]: [newReview, ...targetReviews]
              }
          };
      });
  };

  const handleRefreshSession = () => {
      setSessionKey(prev => prev + 1);
      setShowRefreshConfirm(false);
  };

  const handleDeleteRange = (startDate: string, endDate: string) => {
    if (!state.selectedTargetId) return;
    const targetId = state.selectedTargetId;
    
    // Create Date objects (start of startDate and end of endDate)
    const startTs = new Date(startDate).setHours(0,0,0,0);
    const endTs = new Date(endDate).setHours(23,59,59,999);

    setState(prev => {
        const targetLogs = prev.logs[targetId] || [];
        const targetReviews = prev.reviews?.[targetId] || [];

        const newLogs = targetLogs.filter(log => {
             const t = log.timestamp || new Date(log.date).getTime();
             return t < startTs || t > endTs;
        });

        const newReviews = targetReviews.filter(rev => {
            const t = rev.timestamp;
            return t < startTs || t > endTs;
        });

        return {
            ...prev,
            logs: { ...prev.logs, [targetId]: newLogs },
            reviews: { ...prev.reviews, [targetId]: newReviews }
        };
    });
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800 selection:bg-stone-200">
      
      {/* 1. Countdown Widget */}
      <FloatingCountdown 
        target={currentTarget} 
        onClick={() => setIsModalOpen(true)}
      />

      {/* 2. History & Refresh Buttons */}
      {currentTarget && (
        <div className="fixed top-24 left-6 z-40 flex flex-col gap-3">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="bg-white/80 backdrop-blur-sm border border-stone-200/50 p-3 rounded-xl shadow-sm hover:shadow-md hover:bg-white text-stone-500 hover:text-stone-800 transition-all duration-300"
              title="查看历史档案"
            >
              <Icon name="History" size={20} />
            </button>
            <button 
              onClick={() => setShowRefreshConfirm(true)}
              className="bg-white/80 backdrop-blur-sm border border-stone-200/50 p-3 rounded-xl shadow-sm hover:shadow-md hover:bg-white text-stone-500 hover:text-stone-800 transition-all duration-300"
              title="开启新一轮练习"
            >
              <Icon name="RotateCcw" size={20} />
            </button>
        </div>
      )}

      {/* Refresh Confirmation Modal */}
      {showRefreshConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/10 backdrop-blur-[2px]">
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-stone-100 max-w-xs w-full animate-scale-in">
                  <h3 className="text-lg font-semibold text-stone-800 mb-2">开启新记录?</h3>
                  <p className="text-sm text-stone-500 mb-6">这将清空当前的输入框，以便开始新的一轮练习记录。</p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowRefreshConfirm(false)} className="flex-1 py-2 text-sm text-stone-500 hover:bg-stone-50 rounded-lg">取消</button>
                      <button onClick={handleRefreshSession} className="flex-1 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 shadow-lg shadow-stone-200">确认刷新</button>
                  </div>
              </div>
          </div>
      )}

      {/* 3. History Drawer */}
      <HistoryDrawer 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        logs={currentLogs}
        reviews={currentReviews}
        onDeleteRange={handleDeleteRange}
      />

      {/* 4. Main Layout */}
      <main className="container mx-auto px-4 py-20 flex flex-col items-center">
        
        {!currentTarget ? (
           <div className="text-center mt-32 animate-float-up">
              <h1 className="text-3xl font-light text-stone-800 mb-4">静心笃志，如愿以偿</h1>
              <p className="text-stone-400 mb-8 font-light">请创建一个考试目标，开启你的上岸之旅</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-stone-800 text-white px-6 py-3 rounded-xl hover:bg-stone-700 transition-colors shadow-lg shadow-stone-200"
              >
                创建新目标
              </button>
           </div>
        ) : (
           <div className="w-full max-w-4xl flex flex-col items-center space-y-10 animate-fade-in pb-20">
              {/* Daily Check-in Area */}
              {/* existingLog is purposely NOT passed to ensure we start fresh sessions unless editing (editing not implemented in this flow to simplify "independent sessions") */}
              <DailyCheckIn 
                key={sessionKey} 
                onSave={handleSaveLog} 
              />

              {/* Visualization Area */}
              <StatsDashboard logs={currentLogs} />

              {/* Review Module Area */}
              <ReviewSection 
                key={`review-${sessionKey}`} 
                logs={currentLogs} 
                reviews={currentReviews} 
                onSaveReview={handleSaveReview} 
              />
              
              {/* Simple Target List Footer */}
              <div className="mt-8 flex gap-3 overflow-x-auto pb-4 max-w-full">
                  {state.targets.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setState(s => ({ ...s, selectedTargetId: t.id }))}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${state.selectedTargetId === t.id ? 'bg-white border-stone-300 text-stone-800 shadow-sm' : 'bg-transparent border-transparent text-stone-400 hover:text-stone-600'}`}
                      >
                        {t.name}
                      </button>
                  ))}
                  <button onClick={() => { resetModal(); setIsModalOpen(true); }} className="px-3 py-2 text-stone-400 hover:text-stone-600">
                     <Icon name="Plus" size={16} />
                  </button>
              </div>
           </div>
        )}

      </main>

      {/* 5. Target Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-stone-800">目标管理</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">目标名称</label>
                <input 
                  type="text" 
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="例如：2024 国考"
                  className="w-full bg-stone-50 border border-transparent focus:bg-white focus:border-stone-300 rounded-lg px-4 py-3 text-stone-800 outline-none transition-all placeholder-stone-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">考试日期</label>
                <input 
                  type="date" 
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="w-full bg-stone-50 border border-transparent focus:bg-white focus:border-stone-300 rounded-lg px-4 py-3 text-stone-800 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-2 uppercase tracking-wide">标签颜色</label>
                <div className="flex gap-3">
                  {['#57534e', '#0f766e', '#1d4ed8', '#be185d', '#b45309'].map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTargetColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newTargetColor === c ? 'border-stone-400 scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-stone-100 flex gap-3">
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="flex-1 py-3 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors text-sm font-medium"
               >
                 取消
               </button>
               <button 
                 onClick={handleCreateTarget}
                 className="flex-1 bg-stone-800 hover:bg-stone-700 text-white py-3 rounded-lg text-sm font-medium transition-all shadow-md shadow-stone-200"
               >
                 确认添加
               </button>
            </div>
            
            {state.targets.length > 0 && (
                <div className="mt-6">
                     <p className="text-xs text-stone-400 mb-2">已存目标 (点击删除)</p>
                     <div className="flex flex-wrap gap-2">
                        {state.targets.map(t => (
                            <div key={t.id} className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-md border border-stone-100">
                                <span className="text-xs text-stone-600">{t.name}</span>
                                <button onClick={() => handleDeleteTarget(t.id)} className="text-stone-300 hover:text-red-400">
                                    <Icon name="Trash2" size={12} />
                                </button>
                            </div>
                        ))}
                     </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;