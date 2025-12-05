
import React, { useMemo } from 'react';
import { FamilyMember } from '../types';
import { X, Users, Activity, Briefcase, MapPin, Smile, TrendingUp, UserMinus, Layers } from 'lucide-react';

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
    const ageGroups = {
        '0-18': 0,
        '19-35': 0,
        '36-60': 0,
        '60+': 0
    };

    const currentYear = 1403; // Approximate current Persian year

    // Calculate Generations Depth
    let generations = 0;
    const systemRoot = members.find(m => m.relation === 'SystemRoot');
    if (systemRoot) {
        const getDepth = (node: FamilyMember): number => {
            if (!node.children || node.children.length === 0) return 1;
            return 1 + Math.max(...node.children.map(getDepth));
        };
        // Subtract 1 because SystemRoot is hidden/structural
        generations = Math.max(0, getDepth(systemRoot) - 1);
    }

    members.forEach(m => {
        // Gender
        if (m.gender === 'male') males++;
        else if (m.gender === 'female') females++;

        // Vital Status
        if (m.deathDate) {
            deceased++;
            // Calculate lifespan
            const birth = parseInt(m.birthDate?.split('/')[0] || '0');
            const death = parseInt(m.deathDate.split('/')[0] || '0');
            if (birth > 0 && death > 0) {
                totalAge += (death - birth);
                ageCount++;
            }
        } else {
            living++;
            // Calculate current age
            const birth = parseInt(m.birthDate?.split('/')[0] || '0');
            if (birth > 0) {
                const age = currentYear - birth;
                totalAge += age;
                ageCount++;

                // Age Groups
                if (age <= 18) ageGroups['0-18']++;
                else if (age <= 35) ageGroups['19-35']++;
                else if (age <= 60) ageGroups['36-60']++;
                else ageGroups['60+']++;
            }
        }

        // Occupations
        if (m.occupation) {
            occupationMap[m.occupation] = (occupationMap[m.occupation] || 0) + 1;
        }

        // Locations
        if (m.location) {
            // Normalize city names roughly
            const loc = m.location.split('،')[0].split('-')[0].trim(); 
            locationMap[loc] = (locationMap[loc] || 0) + 1;
        }
    });

    // Sort Top Lists
    const topOccupations = Object.entries(occupationMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
        
    const topLocations = Object.entries(locationMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const avgAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

    return {
        total,
        males,
        females,
        living,
        deceased,
        avgAge,
        generations,
        topOccupations,
        topLocations,
        ageGroups
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

        {/* Content - Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 shrink-0">
            {/* KPI Cards */}
            <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                    <Users size={64}/>
                </div>
                <span className="text-sm font-bold opacity-60">تعداد کل اعضا</span>
                <span className="text-4xl font-black text-teal-600 dark:text-teal-400">{stats.total}</span>
                <div className="text-[10px] opacity-50 font-mono">Total Members</div>
            </div>

            <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                 <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                    <Layers size={64}/>
                </div>
                <span className="text-sm font-bold opacity-60">تعداد نسل‌ها</span>
                <span className="text-4xl font-black text-indigo-500">{stats.generations}</span>
                <div className="text-[10px] opacity-50">Generations</div>
            </div>

            <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                 <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                    <Smile size={64}/>
                </div>
                <span className="text-sm font-bold opacity-60">در قید حیات</span>
                <span className="text-4xl font-black text-green-500">{stats.living}</span>
                <div className="text-[10px] opacity-50">
                    {stats.total > 0 ? Math.round((stats.living / stats.total) * 100) : 0}% کل خاندان
                </div>
            </div>

            <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                 <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                    <TrendingUp size={64}/>
                </div>
                <span className="text-sm font-bold opacity-60">میانگین عمر</span>
                <span className="text-4xl font-black text-amber-500">{stats.avgAge} <span className="text-sm font-normal text-slate-400">سال</span></span>
                <div className="text-[10px] opacity-50">Average Lifespan</div>
            </div>

            <div className={`p-5 rounded-3xl border ${cardBg} flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                 <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                    <UserMinus size={64}/>
                </div>
                <span className="text-sm font-bold opacity-60">فوت شده</span>
                <span className="text-4xl font-black text-slate-400">{stats.deceased}</span>
                <div className="text-[10px] opacity-50">Deceased</div>
            </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
            
            {/* 1. Gender Distribution (Donut Chart) */}
            <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                <h3 className="font-bold mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                    ترکیب جنسیتی
                </h3>
                <div className="flex-1 flex items-center justify-center relative">
                    <svg viewBox="0 0 100 100" className="w-48 h-48 -rotate-90">
                        {/* Background Circle */}
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} strokeWidth="12" />
                        
                        {/* Male Circle (Blue) */}
                        <circle 
                            cx="50" cy="50" r="40" 
                            fill="transparent" 
                            stroke="#3b82f6" 
                            strokeWidth="12" 
                            strokeDasharray={`${malePercent * 2.51} 251`}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                        {/* Female Circle (Pink) - Overlay offset */}
                        <circle 
                            cx="50" cy="50" r="25" 
                            fill="transparent" 
                            stroke="#ec4899" 
                            strokeWidth="12" 
                            strokeDasharray={`${femalePercent * 1.57} 157`}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out delay-200"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-xs font-bold text-blue-500 mb-1">♂ {Math.round(malePercent)}%</div>
                        <div className="text-xs font-bold text-pink-500">♀ {Math.round(femalePercent)}%</div>
                    </div>
                </div>
                <div className="mt-4 flex justify-around text-xs opacity-70">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> مردان ({stats.males})</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-pink-500 rounded-full"></div> زنان ({stats.females})</span>
                </div>
            </div>

            {/* 2. Age Demographics (Horizontal Bars) */}
            <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                <h3 className="font-bold mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-teal-500 rounded-full"></div>
                    هرم سنی (زندگان)
                </h3>
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
                            <div key={idx} className="w-full">
                                <div className="flex justify-between text-xs mb-1 opacity-80">
                                    <span>{group.label}</span>
                                    <span className="font-bold">{group.val} نفر</span>
                                </div>
                                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${group.color} rounded-full transition-all duration-1000 ease-out`}
                                        style={{ width: `${width}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. Top Lists (Occupations & Locations) */}
            <div className={`p-6 rounded-3xl border ${cardBg} flex flex-col`}>
                 <h3 className="font-bold mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                    ترین‌ها
                </h3>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    <div className="mb-6">
                        <h4 className="text-xs font-bold opacity-50 mb-3 flex items-center gap-1 uppercase tracking-wider"><Briefcase size={12}/> مشاغل پرتکرار</h4>
                        <div className="space-y-2">
                            {stats.topOccupations.length > 0 ? stats.topOccupations.map(([job, count], i) => (
                                <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <span>{job}</span>
                                    <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-bold">{count}</span>
                                </div>
                            )) : <div className="text-xs opacity-40 italic">اطلاعات شغلی ثبت نشده است</div>}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold opacity-50 mb-3 flex items-center gap-1 uppercase tracking-wider"><MapPin size={12}/> پراکندگی جغرافیایی</h4>
                        <div className="space-y-2">
                            {stats.topLocations.length > 0 ? stats.topLocations.map(([loc, count], i) => (
                                <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <span>{loc}</span>
                                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">{count}</span>
                                </div>
                            )) : <div className="text-xs opacity-40 italic">اطلاعات مکانی ثبت نشده است</div>}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default AnalyticsPanel;
