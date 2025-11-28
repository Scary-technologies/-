
import React, { useState, useEffect, useRef } from 'react';
import { FamilyMember, Tag } from '../types';
import { User, Calendar, MapPin, Plus, Trash2, Save, Calculator, ArrowUp, ArrowDown, GitBranch, Camera, Briefcase, Settings, Network, X, Heart, Printer, Copy, Baby, Link } from 'lucide-react';

interface MemberPanelProps {
  member: FamilyMember | null;
  allMembers: FamilyMember[];
  onUpdateMember: (updatedMember: FamilyMember) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (memberId: string) => void;
  onAddParent: () => void;
  onDeleteMember: (id: string) => void;
  onAddConnection: (sourceId: string, targetId: string, label: string) => void;
  onRemoveConnection: (sourceId: string, targetId: string) => void;
  calculateRelationship: (id1: string, id2: string) => string;
  onAddSpouse: (memberId: string, existingSpouseId?: string) => void;
  onClose: () => void;
}

type Tab = 'info' | 'relations' | 'settings';

const MemberPanel: React.FC<MemberPanelProps> = ({ 
  member, 
  allMembers,
  onUpdateMember, 
  onAddChild, 
  onAddSibling,
  onAddParent,
  onDeleteMember,
  onAddConnection,
  onRemoveConnection,
  calculateRelationship,
  onAddSpouse,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<FamilyMember>>({});
  
  // Relations State
  const [newConnectionTarget, setNewConnectionTarget] = useState<string>('');
  const [newConnectionLabel, setNewConnectionLabel] = useState<string>('پسرعمو/دخترعمو');
  const [spouseTargetId, setSpouseTargetId] = useState<string>('');
  const [isAddSpouseMode, setIsAddSpouseMode] = useState(false);
  const [spouseType, setSpouseType] = useState<'new' | 'existing'>('new');
  
  // Data Entry State
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0f766e');
  const [calcTargetId, setCalcTargetId] = useState<string>('');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = document.body.classList.contains('theme-dark');

  // Styles
  const glassPanelClass = isDark ? 'bg-slate-900/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800';
  const sectionBg = isDark ? 'bg-slate-800/50' : 'bg-slate-50';
  const inputClass = isDark 
    ? "w-full p-2.5 rounded-xl border border-slate-600 bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-teal-500/50 transition-all" 
    : "w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all";
  
  const labelClass = "text-[10px] font-bold opacity-50 uppercase tracking-wider mb-1.5 block";

  useEffect(() => {
    if (member) {
      setFormData(member);
      setEditMode(false);
      setNewConnectionTarget('');
      setCalcResult(null);
      setIsAddSpouseMode(false);
    }
  }, [member]);

  if (!member) return null;

  const handleSave = () => {
    if (formData.id) {
      onUpdateMember(formData as FamilyMember);
      setEditMode(false);
    }
  };

  const handleChange = (field: keyof FamilyMember, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              handleChange('imageUrl', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleAddTag = () => {
      if(!newTag) return;
      const currentTags = formData.tags || [];
      const tagToAdd: Tag = {
          id: Date.now().toString(),
          label: newTag,
          color: newTagColor
      };
      handleChange('tags', [...currentTags, tagToAdd]);
      setNewTag('');
  };

  const handleAddSpouseSubmit = () => {
      if (spouseType === 'new') {
          onAddSpouse(member.id);
      } else if (spouseType === 'existing' && spouseTargetId) {
          onAddSpouse(member.id, spouseTargetId);
      }
      setIsAddSpouseMode(false);
  };
  
  const eligibleSpouses = allMembers.filter(m => 
    m.id !== member.id && 
    !member.connections?.some(c => c.targetId === m.id)
  );

  const copyCode = () => {
      if(formData.code) {
          navigator.clipboard.writeText(formData.code);
          // Could add a toast notification here
      }
  };

  return (
    <div className={`w-full h-full flex flex-col relative rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md border ${glassPanelClass}`}>
      
      {/* 1. COMPACT HEADER */}
      <div className={`relative h-40 shrink-0 ${member.gender === 'male' ? 'bg-gradient-to-r from-cyan-600 to-blue-700' : 'bg-gradient-to-r from-pink-500 to-rose-600'}`}>
         {/* Texture Overlay */}
         <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
         
         {/* Toolbar */}
         <div className="absolute top-0 w-full p-4 flex justify-between items-start z-20">
             <button onClick={onClose} className="bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                 <X size={20} />
             </button>
             <div className="flex gap-2">
                 <button onClick={() => setEditMode(!editMode)} className={`p-2 rounded-full backdrop-blur-sm transition-colors ${editMode ? 'bg-white text-teal-600 shadow-lg' : 'bg-black/20 text-white hover:bg-white/20'}`}>
                    {editMode ? <Save size={18} onClick={handleSave}/> : <Settings size={18}/>}
                 </button>
             </div>
         </div>
      </div>

      {/* 2. PROFILE SECTION (Overlapping) */}
      <div className="px-8 -mt-16 relative z-10 flex flex-col md:flex-row items-end md:items-end gap-6 pb-6 border-b border-dashed border-slate-300 dark:border-slate-700">
          {/* Avatar */}
          <div className="relative group shrink-0">
             <div className={`w-32 h-32 rounded-full border-[6px] ${isDark ? 'border-slate-900 bg-slate-800' : 'border-white bg-slate-100'} shadow-xl overflow-hidden relative`}>
                 {formData.imageUrl ? (
                     <img src={formData.imageUrl} alt={formData.name} className="w-full h-full object-cover" />
                 ) : (
                     <div className="w-full h-full flex items-center justify-center opacity-30">
                         <User size={64} />
                     </div>
                 )}
                 {editMode && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                    >
                        <Camera className="text-white" />
                    </div>
                 )}
             </div>
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadImage} accept="image/*" />
          </div>

          {/* Name & Basic Info */}
          <div className="flex-1 pb-1 w-full text-center md:text-right">
              {editMode ? (
                  <input 
                    className="text-3xl font-black bg-transparent border-b-2 border-teal-500 w-full text-center md:text-right outline-none mb-2"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="نام و نام خانوادگی"
                  />
              ) : (
                  <h1 className="text-3xl font-black mb-2">{formData.name}</h1>
              )}
              
              <div className="flex flex-wrap gap-3 justify-center md:justify-start items-center opacity-70 text-sm">
                  <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                      {formData.gender === 'male' ? <span className="text-blue-500">مرد</span> : <span className="text-pink-500">زن</span>}
                  </span>
                  {formData.occupation && (
                      <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                          <Briefcase size={14}/> {formData.occupation}
                      </span>
                  )}
                  <button onClick={copyCode} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors font-mono" title="کپی کد">
                      <span className="opacity-50">#</span>{formData.code} <Copy size={12}/>
                  </button>
              </div>
          </div>
      </div>

      {/* 3. NAVIGATION (Pills) */}
      <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {[
              {id: 'info', label: 'مشخصات', icon: User},
              {id: 'relations', label: 'روابط خانوادگی', icon: Network},
              {id: 'settings', label: 'تنظیمات', icon: Settings},
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' 
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                 <tab.icon size={16} /> {tab.label}
              </button>
          ))}
      </div>

      {/* 4. CONTENT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-0">
          
          {/* --- INFO TAB --- */}
          {activeTab === 'info' && (
              <div className="space-y-6 animate-slide-up max-w-3xl mx-auto" style={{animationDelay: '0.1s'}}>
                  
                  {/* Vital Stats Section */}
                  <div className={`p-6 rounded-3xl ${sectionBg}`}>
                      <h3 className="text-sm font-bold opacity-70 mb-5 flex items-center gap-2">
                          <div className="w-1 h-4 bg-teal-500 rounded-full"></div>
                          اطلاعات پایه
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className={labelClass}>تاریخ تولد</label>
                              {editMode ? (
                                  <input dir="ltr" className={`${inputClass} font-mono text-center`} value={formData.birthDate || ''} onChange={(e) => handleChange('birthDate', e.target.value)} placeholder="1300/01/01" />
                              ) : (
                                  <div className="text-lg font-bold flex items-center gap-2">
                                      <Calendar size={18} className="text-teal-500 opacity-70"/> 
                                      {formData.birthDate || 'نامشخص'}
                                  </div>
                              )}
                          </div>
                          
                          <div>
                              <label className={labelClass}>محل تولد / زندگی</label>
                              {editMode ? (
                                  <input className={inputClass} value={formData.location || ''} onChange={(e) => handleChange('location', e.target.value)} placeholder="شهر، کشور" />
                              ) : (
                                  <div className="text-lg font-bold flex items-center gap-2">
                                      <MapPin size={18} className="text-teal-500 opacity-70"/> 
                                      {formData.location || 'نامشخص'}
                                  </div>
                              )}
                          </div>

                          <div>
                              <label className={labelClass}>تاریخ وفات</label>
                              {editMode ? (
                                  <input dir="ltr" className={`${inputClass} font-mono text-center`} value={formData.deathDate || ''} onChange={(e) => handleChange('deathDate', e.target.value)} placeholder="-" />
                              ) : (
                                  <div className={`text-lg font-bold flex items-center gap-2 ${formData.deathDate ? 'text-slate-700 dark:text-slate-300' : 'opacity-40'}`}>
                                      <span className="text-xl leading-none">✝</span>
                                      {formData.deathDate || 'در قید حیات'}
                                  </div>
                              )}
                          </div>

                          <div>
                              <label className={labelClass}>شغل</label>
                              {editMode ? (
                                  <input className={inputClass} value={formData.occupation || ''} onChange={(e) => handleChange('occupation', e.target.value)} />
                              ) : (
                                  <div className="text-lg font-bold flex items-center gap-2">
                                      <Briefcase size={18} className="text-teal-500 opacity-70"/> 
                                      {formData.occupation || 'ثبت نشده'}
                                  </div>
                              )}
                          </div>
                          
                          {editMode && (
                             <div>
                                <label className={labelClass}>جنسیت</label>
                                <select className={inputClass} value={formData.gender} onChange={(e) => handleChange('gender', e.target.value)}>
                                    <option value="male">مرد</option>
                                    <option value="female">زن</option>
                                </select>
                             </div>
                          )}
                      </div>
                  </div>

                  {/* Tags Section */}
                  <div className={`p-6 rounded-3xl ${sectionBg}`}>
                      <h3 className="text-sm font-bold opacity-70 mb-5 flex items-center gap-2">
                          <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                          برچسب‌ها و ویژگی‌ها
                      </h3>
                      
                      {editMode && (
                          <div className="flex gap-2 mb-4">
                              <input 
                                value={newTag} onChange={(e) => setNewTag(e.target.value)}
                                className={inputClass} placeholder="برچسب جدید..."
                              />
                              <input 
                                type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)}
                                className="h-full w-12 p-1 rounded-xl border bg-transparent cursor-pointer"
                              />
                              <button onClick={handleAddTag} className="bg-teal-500 text-white p-3 rounded-xl hover:bg-teal-600"><Plus size={20}/></button>
                          </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                          {formData.tags?.map(tag => (
                             <span key={tag.id} style={{backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '40'}} className="border px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                                {tag.label}
                                {editMode && <button onClick={() => handleChange('tags', formData.tags?.filter(t => t.id !== tag.id))}><X size={12}/></button>}
                             </span>
                          ))}
                          {(!formData.tags || formData.tags.length === 0) && <span className="opacity-40 text-sm italic">بدون برچسب</span>}
                      </div>
                  </div>
              </div>
          )}

          {/* --- RELATIONS TAB --- */}
          {activeTab === 'relations' && (
              <div className="space-y-8 animate-slide-up max-w-3xl mx-auto" style={{animationDelay: '0.1s'}}>
                  
                  {/* Quick Actions Grid (Clean Version) */}
                  <div>
                      <h3 className={labelClass}>افزودن و مدیریت روابط</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                          <button onClick={onAddParent} className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all">
                              <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform"/>
                              <span className="text-xs font-bold">والد [P]</span>
                          </button>
                          <button onClick={() => setIsAddSpouseMode(!isAddSpouseMode)} className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-all">
                              <Heart size={24} className="group-hover:scale-110 transition-transform"/>
                              <span className="text-xs font-bold">همسر [M]</span>
                          </button>
                          <button onClick={() => onAddSibling(member.id)} className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all">
                              <GitBranch size={24} className="group-hover:rotate-12 transition-transform"/>
                              <span className="text-xs font-bold">هم‌سطح [S]</span>
                          </button>
                          <button onClick={() => onAddChild(member.id)} className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all">
                              <Baby size={24} className="group-hover:translate-y-1 transition-transform"/>
                              <span className="text-xs font-bold">فرزند [C]</span>
                          </button>
                      </div>
                  </div>

                  {/* Add Spouse Form */}
                  {isAddSpouseMode && (
                      <div className="bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-800 p-5 rounded-2xl animate-fade-in-scale">
                          <h4 className="text-sm font-bold text-pink-600 mb-3">ثبت ازدواج</h4>
                          <div className="flex gap-2 mb-3">
                              <button onClick={() => setSpouseType('new')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${spouseType === 'new' ? 'bg-pink-500 text-white' : 'bg-white dark:bg-slate-800'}`}>شخص جدید</button>
                              <button onClick={() => setSpouseType('existing')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${spouseType === 'existing' ? 'bg-pink-500 text-white' : 'bg-white dark:bg-slate-800'}`}>انتخاب از لیست</button>
                          </div>
                          {spouseType === 'existing' && (
                             <select className={inputClass} value={spouseTargetId} onChange={(e) => setSpouseTargetId(e.target.value)}>
                                 <option value="">انتخاب همسر...</option>
                                 {eligibleSpouses.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                             </select>
                          )}
                          <button onClick={handleAddSpouseSubmit} className="w-full mt-2 py-2 bg-pink-500 text-white rounded-xl text-sm font-bold">ثبت نهایی</button>
                      </div>
                  )}

                  {/* Manual Connections List */}
                  <div className={`rounded-3xl border p-6 ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
                      <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center justify-between">
                          <span>ارتباطات غیر درختی (لینک‌ها)</span>
                          <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{member.connections?.length || 0}</span>
                      </h3>
                      
                      <div className="space-y-2">
                          {member.connections?.map((conn, idx) => {
                              const target = allMembers.find(m => m.id === conn.targetId);
                              return (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                      <div className="flex items-center gap-3">
                                          <Link size={16} className="text-slate-400"/>
                                          <div>
                                              <span className="font-bold text-sm block">{target?.name}</span>
                                              <span className="text-xs opacity-50">{conn.label}</span>
                                          </div>
                                      </div>
                                      <button onClick={() => onRemoveConnection(member.id, conn.targetId)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                  </div>
                              )
                          })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-dashed border-slate-300 dark:border-slate-700">
                           <div className="flex gap-2">
                               <select className={inputClass} value={newConnectionTarget} onChange={(e) => setNewConnectionTarget(e.target.value)}>
                                   <option value="">فرد مرتبط...</option>
                                   {allMembers.filter(m => m.id !== member.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                               </select>
                               <input className={inputClass} placeholder="عنوان (مثلاً: دوست)" value={newConnectionLabel} onChange={(e) => setNewConnectionLabel(e.target.value)} />
                               <button onClick={() => {if(newConnectionTarget) onAddConnection(member.id, newConnectionTarget, newConnectionLabel)}} className="bg-slate-800 text-white px-4 rounded-xl hover:bg-black"><Plus size={18}/></button>
                           </div>
                      </div>
                  </div>
                  
                  {/* Relationship Calculator */}
                  <div className={`p-6 rounded-3xl ${sectionBg}`}>
                      <h3 className={labelClass}>محاسبه نسبت فامیلی</h3>
                      <div className="flex gap-2 mt-2">
                          <select className={inputClass} value={calcTargetId} onChange={(e) => { setCalcTargetId(e.target.value); setCalcResult(null); }}>
                              <option value="">مقایسه با...</option>
                              {allMembers.filter(m => m.id !== member.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <button onClick={() => calcTargetId && setCalcResult(calculateRelationship(member.id, calcTargetId))} className="bg-teal-500 text-white px-5 rounded-xl font-bold text-sm hover:bg-teal-600 whitespace-nowrap"><Calculator size={18}/></button>
                      </div>
                      {calcResult && <div className="mt-3 p-3 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 rounded-xl text-center font-bold text-sm border border-teal-200 dark:border-teal-800">{calcResult}</div>}
                  </div>
              </div>
          )}

          {/* --- SETTINGS TAB --- */}
          {activeTab === 'settings' && (
              <div className="max-w-xl mx-auto pt-10 animate-slide-up" style={{animationDelay: '0.1s'}}>
                   <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-6 rounded-3xl text-center">
                       <Trash2 size={32} className="text-red-500 mx-auto mb-4 opacity-50"/>
                       <h3 className="text-red-600 font-bold mb-2">منطقه خطر</h3>
                       <p className="text-xs text-red-400 mb-6 px-4">با حذف این عضو، تمام زیرشاخه‌ها و اطلاعات مربوطه به صورت دائمی از سیستم حذف خواهند شد.</p>
                       <button onClick={(e) => { onDeleteMember(member.id); onClose(); }} className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all w-full">
                           تایید و حذف عضو
                       </button>
                   </div>
              </div>
          )}

      </div>
    </div>
  );
};

export default MemberPanel;
