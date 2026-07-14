import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, MapPin, ChevronRight, User } from 'lucide-react';

interface Team {
    id: string;
    name: string;
    flag: string;
    played: number;
    won: number;
    draw: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    points: number;
}

interface Group {
    id: string;
    name: string;
    teams: Team[];
}

const groupsData: Group[] = [
    {
        id: 'A',
        name: 'المجموعة الأولى',
        teams: [
            { id: 'ma', name: 'المغرب', flag: 'https://flagcdn.com/w80/ma.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'tn', name: 'تونس', flag: 'https://flagcdn.com/w80/tn.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'eg', name: 'مصر', flag: 'https://flagcdn.com/w80/eg.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'et', name: 'إثيوبيا', flag: 'https://flagcdn.com/w80/et.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
        ]
    },
    {
        id: 'B',
        name: 'المجموعة الثانية',
        teams: [
            { id: 'ci', name: 'كوت ديفوار', flag: 'https://flagcdn.com/w80/ci.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'cm', name: 'الكاميرون', flag: 'https://flagcdn.com/w80/cm.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'ug', name: 'أوغندا', flag: 'https://flagcdn.com/w80/ug.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'cd', name: 'الكونغو الديمقراطية', flag: 'https://flagcdn.com/w80/cd.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
        ]
    },
    {
        id: 'C',
        name: 'المجموعة الثالثة',
        teams: [
            { id: 'ml', name: 'مالي', flag: 'https://flagcdn.com/w80/ml.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'ao', name: 'أنغولا', flag: 'https://flagcdn.com/w80/ao.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'tz', name: 'تنزانيا', flag: 'https://flagcdn.com/w80/tz.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'mz', name: 'موزمبيق', flag: 'https://flagcdn.com/w80/mz.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
        ]
    },
    {
        id: 'D',
        name: 'المجموعة الرابعة',
        teams: [
            { id: 'sn', name: 'السنغال', flag: 'https://flagcdn.com/w80/sn.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'za', name: 'جنوب إفريقيا', flag: 'https://flagcdn.com/w80/za.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'dz', name: 'الجزائر', flag: 'https://flagcdn.com/w80/dz.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
            { id: 'gh', name: 'غانا', flag: 'https://flagcdn.com/w80/gh.png', played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
        ]
    },
];

const U17AfconStandings: React.FC<{ onBack?: () => void }> = () => {
    const [activeTab, setActiveTab] = useState<'standings' | 'knockout'>('standings');

    return (
        <div className="bg-[#f2f4f7] min-h-screen font-tajawal text-right flex flex-col items-center py-8 px-4 sm:px-6" dir="rtl">
            {/* Header Area */}
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm overflow-hidden mb-8 border border-gray-100">
                <div className="bg-[#071B3B] p-8 text-center relative overflow-hidden">
                    {/* Moroccan patterns overlay simulation */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                         <div className="grid grid-cols-8 gap-4">
                             {[...Array(64)].map((_, i) => (
                                 <div key={i} className="w-12 h-12 border border-white rotate-45"></div>
                             ))}
                         </div>
                    </div>

                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center mb-4 relative z-10">
                        <Trophy className="w-16 h-16 text-[#00E676]" />
                    </motion.div>
                    <h1 className="text-2xl md:text-4xl font-black text-white mb-2 relative z-10 tracking-tight">كأس إفريقيا لأقل من 17 سنة – المغرب 2026</h1>
                    <p className="text-[#00E676] font-bold relative z-10 text-lg">الترتيب الرسمي ومتابعة البطولة</p>
                    <div className="flex items-center justify-center gap-2 mt-4 text-white/50 text-sm font-medium">
                         <Calendar className="w-4 h-4" />
                         <span>13 مايو – 2 يونيو 2026</span>
                    </div>
                    
                    <div className="mt-12 flex justify-center gap-1 relative z-10">
                        <button 
                            onClick={() => setActiveTab('standings')}
                            className={`px-10 py-4 font-black rounded-t-2xl transition-all border-b-4 ${activeTab === 'standings' ? 'bg-[#f2f4f7] text-[#071B3B] border-[#00E676]' : 'text-white/40 border-transparent hover:text-white hover:bg-white/5'}`}
                        >
                            الترتيب
                        </button>
                        <button 
                            onClick={() => setActiveTab('knockout')}
                            className={`px-10 py-4 font-black rounded-t-2xl transition-all border-b-4 ${activeTab === 'knockout' ? 'bg-[#f2f4f7] text-[#071B3B] border-[#00E676]' : 'text-white/40 border-transparent hover:text-white hover:bg-white/5'}`}
                        >
                            الأدوار الإقصائية
                        </button>
                    </div>
                </div>

                <div className="p-6 md:p-10 bg-[#f2f4f7]">
                    <AnimatePresence mode="wait">
                        {activeTab === 'standings' ? (
                            <motion.div 
                                key="standings"
                                initial={{ opacity: 0, x: -20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-12"
                            >
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="divide-y divide-gray-100">
                                        {groupsData.map((group) => (
                                            <div key={group.name} className="overflow-hidden">
                                                <div className="bg-gray-50 border-b px-8 py-4 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                         <div className="w-1 h-5 bg-[#00E676] rounded-full"></div>
                                                         <h2 className="text-lg font-black text-gray-800">{group.name}</h2>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                                        <thead className="bg-[#f9fafb] text-gray-400 font-bold border-b text-[10px] uppercase">
                                                                            <tr className="text-center">
                                                                                <th className="px-3 py-4 w-10">م</th>
                                                                                <th className="px-4 py-4 text-right">المنتخب</th>
                                                                                <th className="px-2 py-4 text-center">ل</th>
                                                                                <th className="px-2 py-4 text-center">ف</th>
                                                                                <th className="px-2 py-4 text-center">ت</th>
                                                                                <th className="px-2 py-4 text-center">خ</th>
                                                                                <th className="px-2 py-4 text-center hidden sm:table-cell">له</th>
                                                                                <th className="px-2 py-4 text-center hidden sm:table-cell">عليه</th>
                                                                                <th className="px-2 py-4 text-center">فارق</th>
                                                                                <th className="px-2 py-4 text-center text-[#071B3B] font-black">نقاط</th>
                                                                                <th className="px-8 py-4 text-left hidden md:table-cell">وجهاً لوجه</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-50">
                                                                            {group.teams.map((team, idx) => (
                                                                                <tr key={team.id} className="hover:bg-gray-50/50 transition-colors group">
                                                                                    <td className="px-3 py-4 text-center">
                                                                                        <span className={`font-black text-xs ${idx < 2 ? 'text-[#00E676]' : 'text-gray-300'}`}>{idx + 1}</span>
                                                                                    </td>
                                                                                    <td className="px-4 py-4 flex items-center gap-3">
                                                                                        <img src={team.flag} alt={team.name} className="w-5 h-3 sm:w-6 sm:h-4 object-cover shadow-sm rounded-sm border border-gray-100" />
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-bold text-gray-700 text-[11px] sm:text-sm leading-tight">{team.name}</span>
                                                                                            <span className="text-[9px] text-gray-400 font-bold leading-tight">تحت 17</span>
                                                                                        </div>
                                                                                    </td>
                                                                            <td className="px-2 py-4 text-center font-bold text-gray-500 text-xs">{team.played}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-gray-500 text-xs">{team.won}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-gray-500 text-xs">{team.draw}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-gray-500 text-xs">{team.lost}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-gray-400 text-xs">{team.gf}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-gray-400 text-xs">{team.ga}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-gray-400 text-xs">{team.gd}</td>
                                                                    <td className="px-2 py-4 text-center font-black text-[#071B3B] text-lg">{team.points}</td>
                                                                    <td className="px-8 py-4 text-left font-medium text-gray-200 tracking-[4px] hidden md:table-cell text-[10px] select-none">- - - - -</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                                    <h3 className="text-xs font-black text-[#071B3B] mb-6 uppercase tracking-widest flex items-center gap-2">
                                         <div className="w-1.5 h-1.5 bg-[#00E676] rounded-full"></div>
                                         دليل الرموز والإحصائيات
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-4 gap-x-8 text-[11px] text-gray-500 font-bold">
                                         <div className="flex items-center gap-2"> <div className="w-2.5 h-2.5 rounded-full bg-[#00E676]"></div> يتأهل للمرحلة التالية</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">ل</span> لعب</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">ف</span> فوز</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">ت</span> تعادل</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">خ</span> هزيمة</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">له</span> أهداف له</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">عليه</span> عليه</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">فارق</span> فارق الأهداف</div>
                                         <div className="flex items-center gap-2"> <span className="text-gray-800 font-black">نقاط</span> النقاط</div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="knockout"
                                initial={{ opacity: 0, scale: 0.98 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                exit={{ opacity: 0, scale: 1.02 }}
                                className="overflow-x-auto no-scrollbar py-16 flex justify-center"
                            >
                                <div className="w-full max-w-4xl grid grid-cols-3 items-center gap-8 md:gap-16">
                                    {/* Semi Finals Column */}
                                    <div className="space-y-48">
                                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xl relative group hover:border-[#00E676] transition-all">
                                              <div className="absolute -top-3 right-4 bg-[#071B3B] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase italic">SF 1</div>
                                              <div className="space-y-4 pt-2">
                                                   <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                             <div className="w-6 h-4 bg-gray-200 rounded-sm"></div>
                                                             <span className="font-bold text-gray-400 text-sm">1A</span>
                                                        </div>
                                                        <span className="font-black text-gray-200">-</span>
                                                   </div>
                                                   <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                             <div className="w-6 h-4 bg-gray-200 rounded-sm"></div>
                                                             <span className="font-bold text-gray-400 text-sm">2B</span>
                                                        </div>
                                                        <span className="font-black text-gray-200">-</span>
                                                   </div>
                                              </div>
                                         </div>
                                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xl relative group hover:border-[#00E676] transition-all">
                                              <div className="absolute -top-3 right-4 bg-[#071B3B] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase italic">SF 2</div>
                                              <div className="space-y-4 pt-2">
                                                   <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                             <div className="w-6 h-4 bg-gray-200 rounded-sm"></div>
                                                             <span className="font-bold text-gray-400 text-sm">1C</span>
                                                        </div>
                                                        <span className="font-black text-gray-200">-</span>
                                                   </div>
                                                   <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                             <div className="w-6 h-4 bg-gray-200 rounded-sm"></div>
                                                             <span className="font-bold text-gray-400 text-sm">2D</span>
                                                        </div>
                                                        <span className="font-black text-gray-200">-</span>
                                                   </div>
                                              </div>
                                         </div>
                                    </div>

                                    {/* Grand Final Center Column */}
                                    <div className="flex flex-col items-center">
                                         <div className="mb-10 flex flex-col items-center">
                                              <Trophy className="w-20 h-20 text-[#00E676] mb-4 drop-shadow-[0_10px_20px_rgba(0,230,118,0.2)]" />
                                              <span className="bg-[#071B3B] text-[#00E676] text-[10px] font-black py-1 px-4 rounded-full uppercase tracking-widest shadow-lg">Grand Finale</span>
                                         </div>
                                         
                                         <div className="bg-white p-10 rounded-[40px] border-4 border-[#071B3B] w-[380px] shadow-[0_30px_60px_-15px_rgba(7,27,59,0.3)] relative overflow-hidden group">
                                              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00E676]/5 rounded-full blur-3xl group-hover:bg-[#00E676]/10 transition-all"></div>
                                              
                                              <div className="space-y-8 relative z-10">
                                                   <div className="flex justify-between items-center p-5 bg-[#f9fafb] rounded-3xl border border-gray-100 shadow-inner">
                                                        <div className="flex items-center gap-4">
                                                             <div className="w-12 h-8 bg-gray-200 rounded-md"></div>
                                                             <span className="font-black text-[#071B3B] text-lg">Winner SF1</span>
                                                        </div>
                                                        <span className="font-black text-gray-300 text-3xl">--</span>
                                                   </div>
                                                   
                                                   <div className="flex items-center gap-4 py-2">
                                                        <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-gray-200"></div>
                                                        <div className="text-4xl font-black text-gray-200 italic tracking-tighter select-none">FINAL</div>
                                                        <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-gray-200"></div>
                                                   </div>
                                                   
                                                   <div className="flex justify-between items-center p-5 bg-[#f9fafb] rounded-3xl border border-gray-100 shadow-inner">
                                                        <div className="flex items-center gap-4">
                                                             <div className="w-12 h-8 bg-gray-200 rounded-md"></div>
                                                             <span className="font-black text-[#071B3B] text-lg">Winner SF2</span>
                                                        </div>
                                                        <span className="font-black text-gray-300 text-3xl">--</span>
                                                   </div>
                                              </div>
                                              
                                              <div className="mt-12 pt-6 border-t-2 border-dashed border-gray-100 text-center">
                                                   <div className="flex items-center justify-center gap-2 mb-2">
                                                        <Calendar className="w-4 h-4 text-[#00E676]" />
                                                        <p className="text-[#071B3B] font-black text-lg">2 يونيو 2026 • 20:00</p>
                                                   </div>
                                                   <div className="flex items-center justify-center gap-2 text-gray-400 font-bold text-xs uppercase italic tracking-widest">
                                                        <MapPin className="w-3 h-3" />
                                                        <span>Stade Moulay Hassan, Rabat</span>
                                                   </div>
                                              </div>
                                              
                                              {/* Decorative floating balls or shapes could go here */}
                                         </div>
                                         
                                         <div className="mt-12 opacity-40">
                                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[10px]">AFCON U17</p>
                                         </div>
                                    </div>

                                    {/* Final Bracket Right Side Logic placeholder - though usually it flows one way */}
                                    <div className="hidden lg:flex flex-col items-center justify-center opacity-30 gap-8 grayscale">
                                         <div className="w-12 h-12 bg-[#071B3B] rounded-full flex items-center justify-center">
                                              <User className="text-white w-6 h-6" />
                                         </div>
                                         <div className="h-64 w-[2px] bg-gradient-to-b from-[#071B3B] to-transparent"></div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Sub-Footer */}
            <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between py-12 px-6 text-gray-400 text-[10px] font-black border-t border-gray-200 mt-12 gap-6">
                <span className="uppercase tracking-[5px]">TotalEnergies AFCON U17 Morocco 2026</span>
                <div className="flex gap-10">
                     <span className="hover:text-[#071B3B] transition-colors cursor-pointer">جدول المباريات كاملة</span>
                     <span className="hover:text-[#071B3B] transition-colors cursor-pointer">أرشيف البطولات</span>
                     <span className="hover:text-[#071B3B] transition-colors cursor-pointer">لوائح CAF</span>
                </div>
                <span className="text-[#071B3B]/10 tracking-widest">© ALL RIGHTS RESERVED 2026</span>
            </div>
        </div>
    );
};

export default U17AfconStandings;
