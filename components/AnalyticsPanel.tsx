
import React, { useMemo } from 'react';
import { FamilyMember } from '../types';
import { X, Users, Activity, Briefcase, MapPin, Smile, TrendingUp, UserMinus, Layers, Trophy, Calendar, Star, BarChart2 } from 'lucide-react';

interface AnalyticsPanelProps {
  members: FamilyMember[];
  onClose: () => void;
  theme: 'modern' | 'dark';
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ members, onClose, theme }) => {
  
  // --- 1. STATISTICS CALCULATION ---
  const stats = useMemo(() => {
    const total = members.length;
    let males = 0;
    let females = 0;
    let living = 0;
    let deceased = 0;
    let totalAge = 0;
    let ageCount = 0;
    
    const occupationMap: Record<string, number> = {};
    const locationMap: Record<string, number> = {};
    const nameMap: Record<string, number> = {};
    const birthDecades: Record<string, number> = {};
    const birthMonths: Record<string, number> = {}; // 1 to 12

    const ageGroups = {
        '0-18': 0,
        '19-35': 0,
        '36-60': 0,
        '60+': 0
    };

    // Records
    let oldestMember = { name: '', age: 0 };
    let mostChildrenMember = { name: '', count: 0 };
    
    const currentYear = 1403; // Approximate current Persian year

    // Calculate Generations Depth
    let generations = 0;
    const systemRoot = members.find(m => m.relation === 'SystemRoot');
    if (systemRoot) {
        const getDepth = (node: FamilyMember): number => {
            if (!node.children || node.children.length === 0) return 1;
            return 1 + Math.max(...node.children.map(getDepth));
        };
        generations = Math.max(0, getDepth(systemRoot) - 1);
    }

    members.forEach(m => {
        if (m.relation === 'SystemRoot') return;

        // Gender
        if (m.gender === 'male') males++;
        else if (m.gender === 'female') females++;

        // Most Children Record
        const childrenCount = m.children?.length || 0;
        if (childrenCount > mostChildrenMember.count) {
            mostChildrenMember = { name: m.name, count: childrenCount };
        }

        // Names Analysis (First Name only roughly)
        const firstName = m.name.split(' ')[0];
        if (firstName) nameMap[firstName] = (nameMap[firstName] || 0) + 1;

        // Vital Status & Age
        let age = 0;
        const birthPart = m.birthDate?.split('/')[0];
        const birthYear = parseInt(birthPart || '0');
        
        // Month Stats
        const birthMonthPart = m.birthDate?.split('/')[1];
        if (birthMonthPart) {
            const month = parseInt(birthMonthPart);
            if (!isNaN(month) && month >= 1 && month <= 12) {
                birthMonths[month] = (birthMonths[month] || 0) + 1;
            }
        }

        // Decade Stats
        if (birthYear > 1000) {
            const decade = Math.floor(birthYear / 10) * 10;
            birthDecades[decade] = (birthDecades[decade] || 0) + 1;
        }

        if (m.deathDate) {
            deceased++;
            const deathYear = parseInt(m.deathDate.split('/')[0] || '0');
            if (birthYear > 0 && deathYear > 0) {
                age = deathYear - birthYear;
                totalAge += age;
                ageCount++;
            }
        } else {
            living++;
            if (birthYear > 0) {
                age = currentYear - birthYear;
                totalAge += age;
                ageCount++;

                // Age Groups
                if (age <= 18) ageGroups['0-18']++;
                else if (age <= 35) ageGroups['19-35']++;
                else if (age <= 60) ageGroups['36-60']++;
                else ageGroups['60+']++;
            }
        }

        // Oldest Record
        if (age > oldestMember.age) {
            oldestMember = { name: m.name, age: age };
        }

        // Occupations
        if (m.occupation) {
            occupationMap[m.occupation] = (occupationMap[m.occupation] || 0) + 1;
        }

        // Locations
        if (m.location) {
            const loc = m.location.split('،')[0].split('-')[0].trim(); 
            locationMap[loc] = (locationMap[loc] || 0) + 1;
        }
    });

    // Sort Lists
    const topOccupations = Object.entries(occupationMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topLocations = Object.entries(locationMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topNames = Object.entries(nameMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    // Sort Decades
    const sortedDecades = Object.entries(birthDecades).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
    // Process Months (Zodiacish)
    const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    const sortedMonths = Object.entries(birthMonths).map(([m, c]) => ({ name: monthNames[parseInt(m)-1], count: c, index: parseInt(m) })).sort((a, b) => b.count - a.count).slice(0, 4);

    const avgAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

    return {
        total, males, females, living, deceased, avgAge, generations,
        topOccupations, topLocations, topNames, ageGroups,
        oldestMember, mostChildrenMember,
        sortedDecades, sortedMonths
    };
  }, [members]);

  const glassClass = theme === 'dark' ? 'bg-slate-900/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800';
  const cardBg = theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200';
  const malePercent = stats.total > 0 ? (stats.males / stats.total) * 100 : 0;
  const femalePercent = stats.total > 0 ? (stats.females / stats.total) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col p-6 animate-slide-up">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-lg shadow-amber-500/20">
                    <Activity size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black">داشبورد آماری</h2>
                    <p className="text-sm opacity-60">تحلیل داده‌های شجره‌نامه در یک نگاه</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
                <X size={24}/>
            </button>
        </div>

        {/* Content - Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10 space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110"><Users size={64}/></div>
                    <span className="text-sm font-bold opacity-60">تعداد کل اعضا</span>
                    <span className="text-4xl font-black text-teal-600 dark:text-teal-400">{stats.total}</span>
                    <div className="text-[10px] opacity-50 font-mono">Total Members</div>
                </div>
                <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110"><Layers size={64}/></div>
                    <span className="text-sm font-bold opacity-60">تعداد نسل‌ها</span>
                    <span className="text-4xl font-black text-indigo-500">{stats.generations}</span>
                    <div className="text-[10px] opacity-50">Generations</div>
                </div>
                <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110"><Smile size={64}/></div>
                    <span className="text-sm font-bold opacity-60">در قید حیات</span>
                    <span className="text-4xl font-black text-green-500">{stats.living}</span>
                    <div className="text-[10px] opacity-50">{stats.total > 0 ? Math.round((stats.living / stats.total) * 100) : 0}% کل خاندان</div>
                </div>
                <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110"><TrendingUp size={64}/></div>
                    <span className="text-sm font-bold opacity-60">میانگین عمر</span>
                    <span className="text-4xl font-black text-amber-500">{stats.avgAge} <span className="text-sm font-normal text-slate-400">سال</span></span>
                    <div className="text-[10px] opacity-50">Average Lifespan</div>
                </div>
                <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110"><UserMinus size={64}/></div>
                    <span className="text-sm font-bold opacity-60">فوت شده</span>
                    <span className="text-4xl font-black text-slate-400">{stats.deceased}</span>
                    <div className="text-[10px] opacity-50">Deceased</div>
                </div>
            </div>

            {/* --- NEW: HALL OF FAME (Records) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-5 rounded-3xl border ${cardBg} relative overflow-hidden`}>
                     <h4 className="text-xs font-bold opacity-60 flex items-center gap-2 mb-2"><Trophy size={14} className="text-amber-500"/> مسن‌ترین عضو خاندان</h4>
                     <div className="text-xl font-black truncate">{stats.oldestMember.name || '---'}</div>
                     <div className="text-sm opacity-50">{stats.oldestMember.age} سال</div>
                </div>
                <div className={`p-5 rounded-3xl border ${cardBg} relative overflow-hidden`}>
                     <h4 className="text-xs font-bold opacity-60 flex items-center gap-2 mb-2"><Users size={14} className="text-blue-500"/> پرجمعیت‌ترین خانواده</h4>
                     <div className="text-xl font-black truncate">{stats.mostChildrenMember.name || '---'}</div>
                     <div className="text-sm opacity-50">{stats.mostChildrenMember.count} فرزند</div>
                </div>
                 <div className={`p-5 rounded-3xl border ${cardBg} relative overflow-hidden`}>
                     <h4 className="text-xs font-bold opacity-60 flex items-center gap-2 mb-2"><Star size={14} className="text-purple-500"/> نام پرتکرار</h4>
                     <div className="text-xl font-black truncate">{stats.topNames[0] ? stats.topNames[0][0] : '---'}</div>
                     <div className="text-sm opacity-50">{stats.topNames[0] ? stats.topNames[0][1] : 0} تکرار</div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Gender Distribution (Donut) */}
                <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                    <h3 className="font-bold mb-6 flex items-center gap-2"><div className="w-1.5 h-6 bg-blue-500 rounded-full"></div> ترکیب جنسیتی</h3>
                    <div className="flex-1 flex items-center justify-center relative min-h-[180px]">
                        <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90">
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} strokeWidth="12" />
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#3b82f6" strokeWidth="12" strokeDasharray={`${malePercent * 2.51} 251`} strokeLinecap="round" className="transition-all duration-1000 ease-out"/>
                            <circle cx="50" cy="50" r="25" fill="transparent" stroke="#ec4899" strokeWidth="12" strokeDasharray={`${femalePercent * 1.57} 157`} strokeLinecap="round" className="transition-all duration-1000 ease-out delay-200"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-xs font-bold text-blue-500 mb-1">♂ {Math.round(malePercent)}%</div>
                            <div className="text-xs font-bold text-pink-500">♀ {Math.round(femalePercent)}%</div>
                        </div>
                    </div>
                </div>

                {/* Age Demographics (Bars) */}
                <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col col-span-1 lg:col-span-2`}>
                    <h3 className="font-bold mb-6 flex items-center gap-2"><div className="w-1.5 h-6 bg-teal-500 rounded-full"></div> هرم سنی (زندگان)</h3>
                    <div className="flex-1 flex flex-col justify-center gap-5">
                        {[
                            { label: 'کودک و نوجوان (0-18)', val: stats.ageGroups['0-18'], color: 'bg-emerald-400' },
                            { label: 'جوان (19-35)', val: stats.ageGroups['19-35'], color: 'bg-teal-500' },
                            { label: 'میانسال (36-60)', val: stats.ageGroups['36-60'], color: 'bg-amber-500' },
                            { label: 'سالمند (+60)', val: stats.ageGroups['60+'], color: 'bg-rose-500' },
                        ].map((group, idx) => {
                            const maxVal = Math.max(...Object.values(stats.ageGroups));
                            const width = maxVal > 0 ? (group.val / maxVal) * 100 : 0;
                            return (
                                <div key={idx} className="w-full flex items-center gap-3">
                                    <div className="w-32 text-xs opacity-80 shrink-0">{group.label}</div>
                                    <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${group.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${width}%` }}></div>
                                    </div>
                                    <div className="w-10 text-xs font-bold text-left">{group.val}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* --- NEW: BIRTH TREND CHART --- */}
            {stats.sortedDecades.length > 0 && (
                <div className={`p-6 rounded-3xl border ${cardBg}`}>
                    <h3 className="font-bold mb-6 flex items-center gap-2"><div className="w-1.5 h-6 bg-cyan-500 rounded-full"></div> روند زاد و ولد در دهه‌های مختلف</h3>
                    <div className="flex items-end gap-2 h-40 pt-4 px-2">
                        {stats.sortedDecades.map(([decade, count], idx) => {
                             const max = Math.max(...stats.sortedDecades.map(d => d[1]));
                             const height = (count / max) * 100;
                             return (
                                 <div key={idx} className="flex-1 flex flex-col justify-end items-center group">
                                     <div className="text-[10px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-y-2">{count}</div>
                                     <div 
                                        style={{height: `${height}%`}} 
                                        className="w-full max-w-[40px] bg-cyan-500/50 hover:bg-cyan-500 rounded-t-lg transition-all duration-500 relative"
                                     ></div>
                                     <div className="text-[10px] mt-2 opacity-60 rotate-0 md:rotate-0">دهه {decade.slice(2)}</div>
                                 </div>
                             )
                        })}
                    </div>
                </div>
            )}

            {/* Bottom Row Lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                     <h3 className="font-bold mb-4 flex items-center gap-2"><div className="w-1.5 h-6 bg-purple-500 rounded-full"></div> مشاغل پرتکرار</h3>
                     <div className="space-y-3">
                        {stats.topOccupations.length > 0 ? stats.topOccupations.map(([job, count], i) => (
                            <div key={i} className="flex justify-between items-center text-sm"><span className="opacity-80">{job}</span><span className="font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-2 rounded-md">{count}</span></div>
                        )) : <span className="text-xs opacity-40">داده‌ای نیست</span>}
                     </div>
                </div>

                <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                     <h3 className="font-bold mb-4 flex items-center gap-2"><div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div> شهرها</h3>
                     <div className="space-y-3">
                        {stats.topLocations.length > 0 ? stats.topLocations.map(([loc, count], i) => (
                            <div key={i} className="flex justify-between items-center text-sm"><span className="opacity-80">{loc}</span><span className="font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-2 rounded-md">{count}</span></div>
                        )) : <span className="text-xs opacity-40">داده‌ای نیست</span>}
                     </div>
                </div>

                <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                     <h3 className="font-bold mb-4 flex items-center gap-2"><div className="w-1.5 h-6 bg-orange-500 rounded-full"></div> ماه‌های تولد</h3>
                     <div className="space-y-3">
                        {stats.sortedMonths.length > 0 ? stats.sortedMonths.map((m, i) => (
                            <div key={i} className="flex justify-between items-center text-sm"><span className="opacity-80">{m.name}</span><span className="font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-2 rounded-md">{m.count}</span></div>
                        )) : <span className="text-xs opacity-40">داده‌ای نیست</span>}
                     </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default AnalyticsPanel;
