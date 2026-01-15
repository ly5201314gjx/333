import React, { useState, useMemo } from 'react';
import { DailyLog, ReviewNote, QuestionRecord, CategoryId, CategoryMeta } from '../types';
import { Icon } from './Icons';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';

interface Props {
  logs: DailyLog[];
  reviews: ReviewNote[];
  onSaveReview: (content: string) => void;
}

// Helpers
const parseLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
};

const getStartOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getEndOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

export const ReviewSection: React.FC<Props> = ({ logs, reviews, onSaveReview }) => {
  // Default to last 7 days
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [noteContent, setNoteContent] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'ALL'>('ALL');

  // 1. Filter Data based on Custom Date Range
  const filteredData = useMemo(() => {
    const start = getStartOfDay(parseLocal(startDate));
    const end = getEndOfDay(parseLocal(endDate));
    
    // Filter Logs (use timestamp for range check if available, or date string)
    const periodLogs = logs.filter(log => {
      const logTs = log.timestamp || parseLocal(log.date).getTime();
      return logTs >= start.getTime() && logTs <= end.getTime();
    });

    // Filter Reviews (History)
    const periodReviews = reviews.filter(note => {
      const noteDate = new Date(note.timestamp);
      const t = noteDate.getTime();
      return t >= start.getTime() && t <= end.getTime();
    }).sort((a, b) => b.timestamp - a.timestamp);

    return { logs: periodLogs, reviews: periodReviews };
  }, [logs, reviews, startDate, endDate]);

  // 2. Dynamic Stats Calculation
  const viewStats = useMemo(() => {
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalDuration = 0;
    const uniqueDays = new Set(filteredData.logs.map(l => l.date)).size;

    filteredData.logs.forEach(log => {
        if (selectedCategory === 'ALL') {
            Object.values(log.categories).forEach((c: QuestionRecord) => {
                totalQuestions += c.total;
                totalCorrect += c.correct;
                totalDuration += c.duration;
            });
        } else {
            const c = log.categories[selectedCategory];
            if (c) {
                totalQuestions += c.total;
                totalCorrect += c.correct;
                totalDuration += c.duration;
            }
        }
    });

    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const avgTimePerQuestion = totalQuestions > 0 ? (totalDuration / totalQuestions).toFixed(1) : '0.0';

    return { totalQuestions, accuracy, totalDuration, avgTimePerQuestion, daysActive: uniqueDays };
  }, [filteredData.logs, selectedCategory]);

  // 3. Chart Data Logic (Aggregation)
  const chartData = useMemo(() => {
      const isSingleDay = startDate === endDate;

      if (isSingleDay) {
          // Single Day: Show every session
          return filteredData.logs
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((log, index) => {
                  let total = 0;
                  let correct = 0;
                  
                  if (selectedCategory === 'ALL') {
                       Object.values(log.categories).forEach((c: QuestionRecord) => {
                          total += c.total;
                          correct += c.correct;
                      });
                  } else {
                      const c = log.categories[selectedCategory];
                       if (c) {
                          total += c.total;
                          correct += c.correct;
                      }
                  }
                  
                  const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
                  
                  return {
                      label: format(new Date(log.timestamp), 'HH:mm'),
                      fullDate: `${log.date} 第${index+1}次`,
                      accuracy: acc,
                  };
              });
      } else {
          // Multi Day: Aggregate by Day
          // Generate all dates in range
          const start = parseLocal(startDate);
          const end = parseLocal(endDate);
          const data = [];
          
          for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = format(d, 'yyyy-MM-dd');
              const dayLogs = filteredData.logs.filter(l => l.date === dateStr);
              
              let accuracy = 0;
              if (dayLogs.length > 0) {
                  let total = 0, correct = 0;
                   dayLogs.forEach(log => {
                       if (selectedCategory === 'ALL') {
                           Object.values(log.categories).forEach((c: QuestionRecord) => {
                              total += c.total;
                              correct += c.correct;
                          });
                       } else {
                           const c = log.categories[selectedCategory];
                           if (c) {
                              total += c.total;
                              correct += c.correct;
                          }
                       }
                   });
                   accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
              }
              
              data.push({
                  label: format(d, 'MM-dd'),
                  fullDate: dateStr,
                  accuracy
              });
          }
          return data;
      }
  }, [filteredData.logs, selectedCategory, startDate, endDate]);

  const handleSave = () => {
    if (!noteContent.trim()) return;
    onSaveReview(noteContent);
    setNoteContent('');
  };

  const downloadFile = (content: string, mimeType: string, filename: string) => {
      const blob = new Blob(['\uFEFF' + content], { type: mimeType }); 
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportMenu(false);
  };

  const handleExportCSV = () => {
      let csvContent = "日期,时间,总题数,正确率,言语(对/总/时),判断(对/总/时),常识(对/总/时),逻辑(对/总/时),资料(对/总/时)\n";
      
      // Sort desc
      const sortedLogs = [...filteredData.logs].sort((a, b) => b.timestamp - a.timestamp);

      sortedLogs.forEach(log => {
          let row = [
              `"${log.date}"`,
              `"${format(new Date(log.timestamp), 'HH:mm:ss')}"`
          ];
          
          let total = 0, correct = 0;
          const cats = Object.values(log.categories);
          cats.forEach((c: any) => { total += c.total; correct += c.correct; });
          const acc = total > 0 ? Math.round((correct/total)*100) + '%' : '0%';
          row.push(total.toString(), acc);

          const catOrder = [CategoryId.Speech, CategoryId.Politics, CategoryId.Common, CategoryId.Logic, CategoryId.Data];
          catOrder.forEach(cid => {
              const d = log.categories[cid];
              row.push(`"${d.correct}/${d.total}/${d.duration||0}m"`);
          });

          csvContent += row.join(",") + "\n";
      });
      
      // Append Reviews Section at bottom
      if(filteredData.reviews.length > 0) {
          csvContent += "\n\n--- 复盘笔记 ---\n日期,时间,内容\n";
          filteredData.reviews.forEach(r => {
             csvContent += `"${r.date.split(' ')[0]}","${format(new Date(r.timestamp), 'HH:mm:ss')}","${r.content.replace(/"/g, '""')}"\n`;
          });
      }

      downloadFile(csvContent, 'text/csv;charset=utf-8;', `备考数据_${startDate}_${endDate}.csv`);
  };

  const handleExportWord = () => {
      let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>备考记录</title>
        <style>
            body { font-family: '宋体', sans-serif; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: center; }
            th { background-color: #f0f0f0; }
            .section-title { font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
            .note { text-align: left; background-color: #fafafa; padding: 10px; border: 1px dashed #ccc; margin-bottom: 10px; }
            h1 { text-align: center; }
        </style>
        </head><body>
        <h1>备考复盘记录 (${startDate} 至 ${endDate})</h1>
        
        <div class="section-title">一、刷题记录明细</div>
        <table>
            <thead>
                <tr>
                    <th>日期</th>
                    <th>时间</th>
                    <th>总刷题</th>
                    <th>正确率</th>
                    <th>言语理解</th>
                    <th>政治判断</th>
                    <th>常识判断</th>
                    <th>逻辑推理</th>
                    <th>资料分析</th>
                </tr>
            </thead>
            <tbody>
      `;

      const sortedLogs = [...filteredData.logs].sort((a, b) => b.timestamp - a.timestamp);

      sortedLogs.forEach(log => {
          let total = 0, correct = 0;
          Object.values(log.categories).forEach((c: any) => { total += c.total; correct += c.correct; });
          const acc = total > 0 ? Math.round((correct/total)*100) + '%' : '0%';
          
          html += `<tr>
            <td>${log.date}</td>
            <td>${format(new Date(log.timestamp), 'HH:mm')}</td>
            <td>${total}</td>
            <td>${acc}</td>`;

          const catOrder = [CategoryId.Speech, CategoryId.Politics, CategoryId.Common, CategoryId.Logic, CategoryId.Data];
          catOrder.forEach(cid => {
               const d = log.categories[cid];
               html += `<td>${d.correct}/${d.total} (${d.duration||0}分)</td>`;
          });
          html += `</tr>`;
      });
      html += `</tbody></table>`;

      if (filteredData.reviews.length > 0) {
          html += `<div class="section-title">二、复盘笔记</div>`;
          filteredData.reviews.forEach(r => {
             html += `
             <div class="note">
                <strong>${r.date} (${format(new Date(r.timestamp), 'HH:mm')}):</strong><br/>
                ${r.content}
             </div>`;
          });
      }

      html += `</body></html>`;
      downloadFile(html, 'application/msword', `备考记录_${startDate}_${endDate}.doc`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-stone-200 shadow-xl rounded-lg text-xs z-50">
          <p className="text-stone-400 mb-1">{data.fullDate}</p>
          <p className="text-stone-800 font-bold text-sm">
            {selectedCategory === 'ALL' ? '综合正确率' : CategoryMeta[selectedCategory as CategoryId].label}: 
            <span className="text-stone-600 ml-1">{data.accuracy}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-sm border border-stone-100 p-6 md:p-8 animate-fade-in relative">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded-lg text-stone-600">
            <Icon name="PenTool" size={20} />
          </div>
          <h2 className="text-xl font-semibold text-stone-800 tracking-tight">备考复盘</h2>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 self-start md:self-auto w-full md:w-auto">
            {/* Export Menu */}
            <div className="relative order-2 sm:order-1">
                <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                    <Icon name="Download" size={16} />
                    <span className="sm:inline">导出</span>
                </button>
                {showExportMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-20 animate-scale-in origin-top-right">
                        <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                            <Icon name="FileSpreadsheet" size={16} className="text-emerald-600"/> 导出 Excel/CSV
                        </button>
                        <button onClick={handleExportWord} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                            <Icon name="FileText" size={16} className="text-blue-600"/> 导出 Word
                        </button>
                    </div>
                )}
            </div>

            {/* Date Range Picker */}
            <div className="flex items-center gap-2 bg-stone-50 p-1.5 rounded-xl border border-stone-200/50 order-1 sm:order-2 w-full sm:w-auto justify-center">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-stone-100 rounded-md px-2 py-1 text-xs text-stone-600 focus:outline-none focus:border-stone-300"
                />
                <span className="text-stone-400 text-xs">至</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-stone-100 rounded-md px-2 py-1 text-xs text-stone-600 focus:outline-none focus:border-stone-300"
                />
            </div>
        </div>
      </div>

      {/* Category Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                  selectedCategory === 'ALL'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
              }`}
          >
              全部综合
          </button>
          {(Object.keys(CategoryMeta) as CategoryId[]).map(cat => (
              <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedCategory === cat
                          ? 'bg-stone-800 text-white border-stone-800'
                          : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                  }`}
              >
                  <Icon name={CategoryMeta[cat].icon as any} size={12} />
                  {CategoryMeta[cat].label}
              </button>
          ))}
      </div>

      {/* Trend Chart */}
      <div className="h-56 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                      <linearGradient id="colorAccReview" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#78716c" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#78716c" stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis 
                      dataKey="label" 
                      tick={{fontSize: 10, fill: '#a8a29e'}} 
                      axisLine={false} 
                      tickLine={false}
                      interval="preserveStartEnd"
                  />
                  <YAxis 
                      tick={{fontSize: 10, fill: '#a8a29e'}} 
                      axisLine={false} 
                      tickLine={false} 
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#57534e" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorAccReview)" 
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#292524' }}
                  />
              </AreaChart>
          </ResponsiveContainer>
      </div>

      {/* Stats Summary Cards (Dynamic) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-paper rounded-xl border border-stone-100/50 text-center flex flex-col justify-center">
            <p className="text-xs text-stone-400 mb-1">正确率</p>
            <p className="text-xl font-bold text-stone-800 tabular-nums">{viewStats.accuracy}<span className="text-sm font-normal text-stone-400 ml-0.5">%</span></p>
        </div>
        <div className="p-4 bg-paper rounded-xl border border-stone-100/50 text-center flex flex-col justify-center">
            <p className="text-xs text-stone-400 mb-1">累计题量</p>
            <p className="text-xl font-bold text-stone-800 tabular-nums">{viewStats.totalQuestions}</p>
        </div>
        <div className="p-4 bg-paper rounded-xl border border-stone-100/50 text-center flex flex-col justify-center">
            <p className="text-xs text-stone-400 mb-1">总用时</p>
            <p className="text-xl font-bold text-stone-800 tabular-nums">{viewStats.totalDuration}<span className="text-xs font-normal text-stone-400 ml-1">分</span></p>
        </div>
        <div className="p-4 bg-paper rounded-xl border border-stone-100/50 text-center flex flex-col justify-center">
            <p className="text-xs text-stone-400 mb-1">题均用时</p>
            <p className="text-xl font-bold text-stone-800 tabular-nums">{viewStats.avgTimePerQuestion}<span className="text-xs font-normal text-stone-400 ml-1">分</span></p>
        </div>
      </div>

      {/* Input Section */}
      <div className="relative mb-10">
        <label className="block text-sm font-medium text-stone-500 mb-3 flex items-center gap-2">
            <Icon name="Quote" size={14} />
            写下此刻的感悟
        </label>
        <div className="relative group">
            <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="记录错题反思、心态变化或新的解题技巧..."
            className="w-full h-32 bg-stone-50 border border-stone-200 rounded-xl p-4 text-stone-700 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-300 transition-all resize-none text-sm leading-relaxed"
            />
            <button 
                onClick={handleSave}
                disabled={!noteContent.trim()}
                className="absolute bottom-3 right-3 bg-stone-800 text-white p-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
                <Icon name="Send" size={16} />
            </button>
        </div>
      </div>

      {/* History Timeline */}
      {filteredData.reviews.length > 0 && (
          <div className="border-t border-stone-100 pt-6">
            <h3 className="text-sm font-medium text-stone-500 mb-4 flex items-center gap-2">
                <Icon name="History" size={16} />
                复盘记录 ({startDate} 至 {endDate})
            </h3>
            <div className="space-y-4">
                {filteredData.reviews.map((note) => (
                    <div key={note.id} className="group flex gap-4 items-start">
                        <div className="flex flex-col items-center mt-1">
                            <div className="w-2 h-2 rounded-full bg-stone-300 group-hover:bg-stone-500 transition-colors"></div>
                            <div className="w-px h-full bg-stone-100 my-1 group-last:hidden"></div>
                        </div>
                        <div className="flex-1 pb-2">
                            <p className="text-xs text-stone-400 font-mono mb-1">
                                {format(new Date(note.timestamp), 'MM月dd日 HH:mm')}
                            </p>
                            <div className="text-stone-700 text-sm leading-relaxed bg-stone-50/50 p-3 rounded-lg border border-transparent group-hover:border-stone-100 transition-all">
                                {note.content}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
      )}
    </div>
  );
};