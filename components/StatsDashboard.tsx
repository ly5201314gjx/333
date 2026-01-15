import React, { useState, useMemo } from 'react';
import { DailyLog, CategoryId, CategoryMeta, QuestionRecord } from '../types';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, YAxis } from 'recharts';
import { Icon } from './Icons';
import { format } from 'date-fns';

interface Props {
  logs: DailyLog[];
}

const parseLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
};

export const StatsDashboard: React.FC<Props> = ({ logs }) => {
  // Date Range State
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 6); // Default last 7 days
      return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 1. Calculate Streak
  const calculateStreak = () => {
    if (logs.length === 0) return 0;
    const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    let streak = 0;
    
    // Check if the most recent log is today or yesterday
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const lastLogDate = parseLocal(sortedLogs[0].date);
    lastLogDate.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - lastLogDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (diffDays > 1) return 0;

    const processedDates = new Set<string>();
    
    let currentCheckDate = lastLogDate;
    
    for (const log of sortedLogs) {
        const logDate = parseLocal(log.date);
        logDate.setHours(0,0,0,0);
        const dateStr = format(logDate, 'yyyy-MM-dd');

        if (processedDates.has(dateStr)) continue;
        processedDates.add(dateStr);

        if (logDate.getTime() === currentCheckDate.getTime()) {
            streak++;
            currentCheckDate.setDate(currentCheckDate.getDate() - 1);
        } else {
            break; 
        }
    }
    
    return streak;
  };

  // 2. Prepare Chart Data based on Range
  const chartData = useMemo(() => {
    const start = parseLocal(startDate);
    start.setHours(0,0,0,0);
    const end = parseLocal(endDate);
    end.setHours(23,59,59,999);

    if (startDate === endDate) {
        // Single Day: Show Sessions
        const dayLogs = logs
            .filter(l => l.date === startDate)
            .sort((a, b) => a.timestamp - b.timestamp);
        
        return dayLogs.map((log, index) => {
             let total = 0, correct = 0;
             Object.values(log.categories).forEach((c: QuestionRecord) => { total += c.total; correct += c.correct; });
             const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
             
             return {
                 label: format(new Date(log.timestamp), 'HH:mm'),
                 fullTime: format(new Date(log.timestamp), 'HH:mm:ss'),
                 accuracy,
                 type: `第${index + 1}次`
             };
        });
    } else {
        // Multi Day: Aggregate by Day
        const data = [];
        const current = new Date(start);
        
        while (current <= end) {
            const dateStr = format(current, 'yyyy-MM-dd');
            const dayLogs = logs.filter(l => l.date === dateStr);
            
            let accuracy = 0;
            if (dayLogs.length > 0) {
                let total = 0, correct = 0;
                dayLogs.forEach(log => {
                    Object.values(log.categories).forEach((c: QuestionRecord) => { 
                        total += c.total; 
                        correct += c.correct; 
                    });
                });
                accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
            }
            
            // Push even if accuracy is 0 to show the timeline gap or 0 progress
            // But usually charts look better if we skip days? No, standard timeline includes them.
            // If 0 and no logs, maybe null? Let's keep 0 for simplicity.
            data.push({
                label: format(current, 'MM-dd'),
                fullDate: dateStr,
                accuracy
            });
            
            current.setDate(current.getDate() + 1);
        }
        return data;
    }
  }, [logs, startDate, endDate]);

  const getTotalQuestions = () => {
    return logs.reduce((acc, log) => {
        return acc + Object.values(log.categories).reduce((sum: number, cat: QuestionRecord) => sum + cat.total, 0);
    }, 0);
  };

  const getWeakestCategory = () => {
    if (logs.length === 0) return null;
    const totals: Record<string, {total: number, correct: number}> = {};
    
    logs.forEach(log => {
        Object.entries(log.categories).forEach(([key, val]) => {
            const v = val as QuestionRecord;
            if (!totals[key]) totals[key] = { total: 0, correct: 0 };
            totals[key].total += v.total;
            totals[key].correct += v.correct;
        });
    });

    let minAcc = 101;
    let weakestKey = null;

    Object.entries(totals).forEach(([key, val]) => {
        if (val.total > 10) { 
            const acc = (val.correct / val.total) * 100;
            if (acc < minAcc) {
                minAcc = acc;
                weakestKey = key;
            }
        }
    });

    return weakestKey ? CategoryMeta[weakestKey as CategoryId] : null;
  };

  const streak = calculateStreak();
  const totalQuestions = getTotalQuestions();
  const weakest = getWeakestCategory();

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
          <div className="bg-white p-3 border border-stone-200 shadow-xl rounded-lg text-xs z-50">
            <p className="text-stone-400 mb-1">
                {startDate === endDate ? data.type : data.fullDate}
                {startDate === endDate && <span className="ml-2">{data.fullTime}</span>}
            </p>
            <p className="text-stone-800 font-bold text-sm">
              正确率: <span className="text-stone-600 ml-1">{data.accuracy}%</span>
            </p>
          </div>
        );
      }
      return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto mt-8">
       {/* Card 1: Streak */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col justify-between h-40">
          <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">连续坚持</span>
              <Icon name="Flame" size={18} className="text-orange-400" />
          </div>
          <div>
              <span className="text-4xl font-bold text-stone-800 tracking-tight">{streak}</span>
              <span className="text-sm text-stone-400 ml-2">天</span>
          </div>
          <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
             <div className="bg-orange-400 h-full rounded-full" style={{ width: `${Math.min(streak * 5, 100)}%` }}></div>
          </div>
       </div>

       {/* Card 2: Total Questions */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col justify-between h-40">
          <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">刷题总量</span>
              <Icon name="Target" size={18} className="text-emerald-600" />
          </div>
          <div>
              <span className="text-4xl font-bold text-stone-800 tracking-tight">{totalQuestions}</span>
              <span className="text-sm text-stone-400 ml-2">题</span>
          </div>
          <div className="text-xs text-stone-400 mt-1">
             {weakest ? `建议加强: ${weakest.label}` : '保持节奏，稳步前行'}
          </div>
       </div>

       {/* Card 3: Trend Chart with Date Controls */}
       <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 md:col-span-1 col-span-1 flex flex-col h-auto min-h-[160px]">
          <div className="flex flex-col gap-2 mb-2">
              <div className="flex justify-between items-center">
                 <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">正确率趋势</span>
              </div>
              
              {/* Mini Date Picker */}
              <div className="flex items-center gap-1 bg-stone-50 p-1 rounded-lg border border-stone-100 self-start">
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-[10px] text-stone-600 focus:outline-none w-[80px]"
                    />
                    <span className="text-stone-300 text-[10px]">-</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-[10px] text-stone-600 focus:outline-none w-[80px]"
                    />
              </div>
          </div>

          <div className="flex-1 w-full min-h-[100px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{top: 5, right: 10, left: -20, bottom: 0}}>
                    <defs>
                        <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#57534e" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#57534e" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis 
                        dataKey="label" 
                        tick={{fontSize: 9, fill: '#a8a29e'}} 
                        axisLine={false} 
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis 
                        hide
                        domain={[0, 100]} 
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                        type="monotone" 
                        dataKey="accuracy" 
                        stroke="#57534e" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#colorAcc)"
                        dot={{ r: 3, fill: '#57534e', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#292524', stroke: '#fff', strokeWidth: 2 }}
                    />
                </AreaChart>
             </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};