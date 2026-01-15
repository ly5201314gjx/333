import React, { useState, useEffect } from 'react';
import { CategoryId, CategoryMeta, DailyLog, QuestionRecord } from '../types';
import { Icon } from './Icons';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { generateId } from '../services/storage';

interface Props {
  onSave: (log: DailyLog) => void;
  existingLog?: DailyLog;
}

const EmptyRecord: QuestionRecord = { total: 0, correct: 0, duration: 0 };

export const DailyCheckIn: React.FC<Props> = ({ onSave, existingLog }) => {
  const [data, setData] = useState<Record<CategoryId, QuestionRecord>>({
    [CategoryId.Speech]: { ...EmptyRecord },
    [CategoryId.Politics]: { ...EmptyRecord },
    [CategoryId.Common]: { ...EmptyRecord },
    [CategoryId.Logic]: { ...EmptyRecord },
    [CategoryId.Data]: { ...EmptyRecord },
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (existingLog) {
      // Ensure duration exists for backward compatibility
      const sanitizedCategories = { ...existingLog.categories };
      (Object.keys(sanitizedCategories) as CategoryId[]).forEach(key => {
        if (sanitizedCategories[key].duration === undefined) {
           sanitizedCategories[key].duration = 0;
        }
      });
      setData(sanitizedCategories);
    }
  }, [existingLog]);

  const handleChange = (cat: CategoryId, field: keyof QuestionRecord, value: string) => {
    const numVal = parseInt(value) || 0;
    
    // Validation logic
    let newErrors = { ...errors };
    if (field === 'correct') {
      if (numVal > data[cat].total) {
        newErrors[`${cat}-correct`] = true;
      } else {
        delete newErrors[`${cat}-correct`];
      }
    } else if (field === 'total') {
        if (numVal < data[cat].correct) {
            newErrors[`${cat}-correct`] = true;
        } else {
            delete newErrors[`${cat}-correct`];
        }
    }

    setErrors(newErrors);

    setData(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: numVal
      }
    }));
  };

  const calculateDailyAccuracy = () => {
    let totalQ = 0;
    let totalC = 0;
    Object.values(data).forEach((d: QuestionRecord) => {
      totalQ += d.total;
      totalC += d.correct;
    });
    return totalQ === 0 ? 0 : Math.round((totalC / totalQ) * 100);
  };

  const handleSubmit = () => {
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) return;

    const totalQuestions = Object.values(data).reduce((acc: number, curr: QuestionRecord) => acc + curr.total, 0);
    if (totalQuestions === 0) return;

    const log: DailyLog = {
      id: generateId(),
      date: format(new Date(), 'yyyy-MM-dd'),
      timestamp: Date.now(),
      categories: data
    };

    onSave(log);
    
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-100 p-6 md:p-8 relative overflow-hidden">
      
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-20 flex justify-center items-end pb-20">
             {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], y: -150 - Math.random() * 100, x: (Math.random() - 0.5) * 100 }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.1 }}
                  className="absolute text-yellow-400"
                >
                  <Icon name="Trophy" size={24} />
                </motion.div>
             ))}
          </div>
        )}
      </AnimatePresence>

      <header className="mb-8 text-center">
        <h2 className="text-xl font-semibold text-stone-800 tracking-tight">今日修炼</h2>
        <p className="text-sm text-stone-400 mt-2 font-light">不积跬步，无以至千里</p>
      </header>

      <div className="space-y-4">
        <div className="flex justify-end px-2 pb-2 text-xs text-stone-400 font-medium tracking-wide">
           <span className="w-16 text-center mr-2">总题数</span>
           <span className="w-16 text-center mr-4">答对</span>
           <span className="w-16 text-center">耗时(分)</span>
        </div>
        {(Object.keys(CategoryMeta) as CategoryId[]).map((cat) => {
           const meta = CategoryMeta[cat];
           const hasError = errors[`${cat}-correct`];

           return (
            <div key={cat} className="flex items-center justify-between group py-1">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-1.5 rounded-lg bg-stone-50 text-stone-400 group-hover:text-stone-600 group-hover:bg-stone-100 transition-colors duration-300`}>
                  <Icon name={meta.icon as any} size={18} />
                </div>
                <span className="text-sm font-medium text-stone-600">{meta.label}</span>
              </div>

              <div className="flex items-center gap-2 justify-end">
                {/* Total */}
                <div className="flex items-center bg-stone-50 rounded-lg p-1 w-16 justify-center border border-transparent focus-within:border-stone-200 focus-within:bg-white transition-all">
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-transparent text-center text-sm font-medium text-stone-800 focus:outline-none placeholder-stone-300"
                      placeholder="0"
                      value={data[cat].total || ''}
                      onChange={(e) => handleChange(cat, 'total', e.target.value)}
                    />
                </div>
                
                {/* Correct */}
                <div className={`flex items-center rounded-lg p-1 w-16 justify-center border transition-all ${hasError ? 'border-red-300 bg-red-50 animate-shake' : 'bg-stone-50 border-transparent focus-within:border-stone-200 focus-within:bg-white'}`}>
                    <input 
                      type="number" 
                      min="0"
                      className={`w-full bg-transparent text-center text-sm font-medium focus:outline-none placeholder-stone-300 ${hasError ? 'text-red-600' : 'text-stone-800'}`}
                      placeholder="0"
                      value={data[cat].correct || ''}
                      onChange={(e) => handleChange(cat, 'correct', e.target.value)}
                    />
                </div>

                {/* Duration */}
                 <div className="flex items-center bg-stone-50 rounded-lg p-1 w-16 justify-center border border-transparent focus-within:border-stone-200 focus-within:bg-white transition-all ml-2 relative group/time">
                    <Icon name="Clock" size={10} className="absolute left-1 text-stone-300" />
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-transparent text-center text-sm font-medium text-stone-600 focus:outline-none placeholder-stone-300 pl-2"
                      placeholder="0"
                      value={data[cat].duration || ''}
                      onChange={(e) => handleChange(cat, 'duration', e.target.value)}
                    />
                </div>
              </div>
            </div>
           );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-stone-100 flex items-center justify-between">
         <div className="text-left">
            <span className="text-xs text-stone-400 uppercase tracking-wider block mb-1">今日正确率</span>
            <span className="text-2xl font-bold text-stone-800 tabular-nums">
                {calculateDailyAccuracy()}<span className="text-sm text-stone-400 ml-1 font-normal">%</span>
            </span>
         </div>

         <button 
           onClick={handleSubmit}
           className="bg-stone-800 hover:bg-stone-700 text-white px-8 py-3 rounded-lg text-sm font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-stone-200"
         >
           完成打卡
         </button>
      </div>
    </div>
  );
};