import React, { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours } from 'date-fns';
import { ExamTarget } from '../types';
import { Icon } from './Icons';

interface Props {
  target: ExamTarget | undefined;
  onClick: () => void;
}

export const FloatingCountdown: React.FC<Props> = ({ target, onClick }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    if (!target) return;

    const calculateTime = () => {
      const now = new Date();
      // Replace parseISO with new Date. 
      // Appending T00:00:00 to ensure local time parsing for date-only strings if needed, 
      // but standard new Date(string) usually works for comparisons.
      // To be safe and match likely parseISO(local) behavior for YYYY-MM-DD:
      const examDate = new Date(target.examDate);
      const days = differenceInDays(examDate, now);
      const hours = differenceInHours(examDate, now) % 24;
      setTimeLeft({ days: Math.max(0, days), hours: Math.max(0, hours) });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000 * 60); // Update every minute
    return () => clearInterval(timer);
  }, [target]);

  if (!target) {
    return (
      <button 
        onClick={onClick}
        className="fixed top-6 left-6 z-50 group flex items-center gap-3 bg-white/80 backdrop-blur-md border border-stone-200 px-4 py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
      >
        <div className="bg-stone-100 p-2 rounded-lg text-stone-400 group-hover:text-stone-600 transition-colors">
          <Icon name="Plus" size={20} />
        </div>
        <div className="text-left">
          <p className="text-xs text-stone-500 font-medium">开始备考</p>
          <p className="text-sm font-semibold text-stone-800">创建目标</p>
        </div>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className="fixed top-6 left-6 z-50 flex items-center gap-4 bg-white/80 backdrop-blur-sm border border-stone-200/50 px-5 py-3 rounded-xl shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 cursor-pointer text-left"
    >
      <div className="flex flex-col">
        <span className="text-xs text-stone-500 tracking-wide font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: target.color }}></span>
          {target.name}
        </span>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-2xl font-bold text-stone-800 font-sans tabular-nums tracking-tight">
            {timeLeft?.days}
          </span>
          <span className="text-xs text-stone-500 font-medium mr-1">天</span>
          <span className="text-lg font-semibold text-stone-600 tabular-nums tracking-tight">
            {timeLeft?.hours}
          </span>
          <span className="text-xs text-stone-500 font-medium">小时</span>
        </div>
      </div>
    </button>
  );
};