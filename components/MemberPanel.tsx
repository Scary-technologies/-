
import React, { useState, useEffect, useRef } from 'react';
import { FamilyMember, LifeEvent, Tag } from '../types';
import { User, Calendar, MapPin, Plus, Trash2, Save, Calculator, ArrowUp, GitBranch, Camera, Briefcase, Settings, Network, X, Heart, HeartHandshake, Copy, Printer, Route } from 'lucide-react';

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

type Tab = 'info' | 'events' | 'relations' | 'settings';

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
  const [newConnectionTarget, setNewConnectionTarget] = useState<string>('');
  const [newConnectionLabel, setNewConnectionLabel] = useState<string>('پسرعمو/دخترعمو');
  const [spouseTargetId, setSpouseTargetId] = useState<string>('');
  const [isAddSpouseMode, setIsAddSpouseMode] = useState(false);
  const [spouseType, setSpouseType] = useState<'new' | 'existing'>('new');
  
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newEvent, setNewEvent] = useState<Partial<LifeEvent>>({ title: '', date: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [calcTargetId, setCalcTargetId] = useState<string>('');
  const [calcResult, setCalcResult] = useState<string | null>(null);
  
  const isDark = document.body.classList.contains('theme-dark');
  
  const cardClass = isDark ? 'glass-card-dark text-slate-200' : 'glass-card';
  const inputClass = isDark 
    ? "w-full p-2 rounded-lg border border-slate-600 bg-slate-800/50 text-sm outline-none focus:ring-2 focus:ring-teal-500/50" 
    : "w-full p-2 rounded-lg border border-slate-200 bg-white/50 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500";

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
              const result = reader.result as string;
              handleChange('imageUrl', result);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleAddEvent = () => {
      if (!newEvent.title || !newEvent.date) return;
      const currentEvents = formData.events || [];
      const eventToAdd: LifeEvent = {
          id: Date.now().toString(),
          title: newEvent.title,
          date: newEvent.date,
          location: newEvent.location,
          description: newEvent.description
      };
      handleChange('events', [...currentEvents, eventToAdd]);
      setNewEvent({ title: '', date: '' });
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

  const handleCalcRelationship = () => {
      if (calcTargetId) {
          const res = calculateRelationship(member.id, calcTargetId);
          setCalcResult(res);
      }
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

  const handlePrint = () => {
    const content = `
گزارش شجره‌نامه
----------------
نام: ${formData.name}
تاریخ تولد: ${formData.birthDate || 'نامشخص'}
تاریخ وفات: ${formData.deathDate || '---'}
محل: ${formData.location || '---'}
کد شناسایی: ${formData.code || '---'}
    `.trim();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };
  
  const copyCode = () => {
      if(formData.code) {
          navigator.clipboard.writeText(formData.code);
          alert('کد کپی شد');
      }
  }
  
  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDeleteMember(member.id);
      onClose();
  };

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden relative rounded-2xl ${isDark ? 'glass-panel-dark' : 'glass-panel'}`}>
      
      {/* Hero Header */}
      <div className={`relative h-48 shrink-0 overflow-hidden ${member.gender === 'male' ? 'bg-gradient-to-br from-slate-800 to-blue-900' : 'bg-gradient-to-br from-slate-800 to-pink-900'}`}>
         {/* Background Pattern */}
         <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
         
         {/* Close Button */}
         <button onClick={onClose} className="absolute top-4 left-4 z-20 text-white/70 hover:text-white bg-black/20 hover:bg-red-500/80 p-2 rounded-full backdrop-blur-md transition-all">
             <X size={20} />
         </button>

         {/* Actions */}
         <div className="absolute top-4 right-4 z-20 flex gap-2">
             <button onClick={() => setEditMode(!editMode)} className="text-white/80 hover:text-white bg-black/20 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-all" title="ویرایش">
                {editMode ? <Save size={18} onClick={handleSave}/> : <Settings size={18}/>}
             </button>
             <button onClick={handlePrint} className="text-white/80 hover:text-white bg-black/20 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-all" title="چاپ">
                <Printer size={18}/>
             </button>
         </div>

         {/* Profile Content */}
         <div className="absolute bottom-0 left-0 w-full p-6 flex items-end gap-6 z-10">
             <div className="relative group shrink-0">
                <div className={`w-32 h-32 rounded-2xl border-4 ${isDark ? 'border-slate-800' : 'border-white/20'} shadow-2xl overflow-hidden bg-white/10 backdrop-blur-sm`}>
                    {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt={formData.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50">
                            <User size={56} />
                        </div>
                    )}
                </div>
                {editMode && (
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 left-2 p-2 bg-teal-600 text-white rounded-full hover:bg-teal-500 shadow-lg backdrop-blur-sm transition-transform hover:scale-110">
                        <Camera size={16} />
                    </button>
                )}
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleUploadImage(e)} accept="image/*" />
             </div>
             
             <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-1">
                      {editMode ? (
                          <input 
                            className="text-3xl font-bold bg-transparent border-b border-white/30 text-white w-full outline-none focus:border-teal-400"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                          />
                      ) : (
                          <h2 className="text-3xl font-black text-white drop-shadow-md">{formData.name}</h2>
                      )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center text-white/80 text-sm">
                      <span className="bg-black/30 px-2 py-0.5 rounded backdrop-blur-md flex items-center gap-1">
                          <Calendar size={12}/> {formData.birthDate || '؟'}
                      </span>
                      {formData.occupation && (
                          <span className="bg-black/30 px-2 py-0.5 rounded backdrop-blur-md flex items-center gap-1">
                              <Briefcase size={12}/> {formData.occupation}
                          </span>
                      )}
                      <div onClick={copyCode} className="bg-white/10 px-2 py-0.5 rounded backdrop-blur-md flex items-center gap-1 cursor-pointer hover:bg-white/20 font-mono" title="کپی کد">
                          <Copy size={10}/> {formData.code}
                      </div>
                  </div>
             </div>
         </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b overflow-x-auto no-scrollbar px-4 pt-2 sticky top-0 z-30 ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
          {[
              {id: 'info', label: 'اطلاعات پایه', icon: User},
              {id: 'events', label: 'تایم‌لاین', icon: Route},
              {id: 'relations', label: 'روابط', icon: Network},
              {id: 'settings', label: 'تنظیمات', icon: Settings},
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`relative flex items-center gap-2 px-5 py-4 text-sm font-bold transition-all whitespace-nowrap outline-none ${
                    activeTab === tab.id 
                    ? (isDark ? 'text-teal-400' : 'text-teal-700') 
                    : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700')
                }`}
              >
                 <tab.icon size={18} className={activeTab === tab.id ? "scale-110" : ""} /> {tab.label}
                 {activeTab === tab.id && (
                     <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 to-teal-600 rounded-t-full"></span>
                 )}
              </button>
          ))}
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-transparent">
          
          {/* INFO TAB */}
          {activeTab === 'info' && (
              <div className="space-y-6 animate-enter">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-2xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-2 uppercase tracking-wider">جنسیت</label>
                          {editMode ? (
                              <select 
                                className={`${inputClass} cursor-pointer`}
                                value={formData.gender}
                                onChange={(e) => handleChange('gender', e.target.value)}
                              >
                                  <option value="male">مرد</option>
                                  <option value="female">زن</option>
                              </select>
                          ) : (
                              <div className="font-medium flex items-center gap-2">
                                  {formData.gender === 'male' ? <span className="text-blue-500">♂ مرد</span> : <span className="text-pink-500">♀ زن</span>}
                              </div>
                          )}
                      </div>
                      
                      <div className={`p-4 rounded-2xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-2 uppercase tracking-wider">شغل / حرفه</label>
                          {editMode ? (
                              <input className={inputClass} value={formData.occupation || ''} onChange={(e) => handleChange('occupation', e.target.value)} />
                          ) : (
                              <div className="font-medium">{formData.occupation || '-'}</div>
                          )}
                      </div>

                      <div className={`p-4 rounded-2xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-2 uppercase tracking-wider">تاریخ تولد</label>
                          {editMode ? (
                              <input dir="ltr" className={`${inputClass} text-left font-mono`} value={formData.birthDate || ''} onChange={(e) => handleChange('birthDate', e.target.value)} placeholder="YYYY/MM/DD" />
                          ) : (
                              <div className="font-medium dir-ltr text-right font-mono">{formData.birthDate || '-'}</div>
                          )}
                      </div>

                      <div className={`p-4 rounded-2xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-2 uppercase tracking-wider">تاریخ وفات</label>
                          {editMode ? (
                              <input dir="ltr" className={`${inputClass} text-left font-mono`} value={formData.deathDate || ''} onChange={(e) => handleChange('deathDate', e.target.value)} placeholder="-" />
                          ) : (
                              <div className="font-medium dir-ltr text-right font-mono">{formData.deathDate || '-'}</div>
                          )}
                      </div>

                      <div className={`p-4 rounded-2xl ${cardClass} md:col-span-2`}>
                          <label className="text-xs font-bold opacity-50 block mb-2 uppercase tracking-wider flex items-center gap-1"><MapPin size={12}/> محل زندگی/تولد</label>
                          {editMode ? (
                              <input className={inputClass} value={formData.location || ''} onChange={(e) => handleChange('location', e.target.value)} placeholder="تهران، ایران" />
                          ) : (
                              <div className="font-medium">{formData.location || '-'}</div>
                          )}
                      </div>
                  </div>
                  
                  {editMode && (
                      <div className={`p-4 rounded-2xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50/80 border border-slate-100'}`}>
                          <label className="text-xs font-bold opacity-60 mb-2 block uppercase tracking-wider">برچسب‌های رنگی</label>
                          <div className="flex gap-2">
                              <input 
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                className={`${inputClass} flex-1`}
                                placeholder="عنوان برچسب (مثلاً: شاعر)"
                              />
                              <input 
                                type="color" 
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                className="w-10 h-10 p-1 rounded-lg border cursor-pointer bg-transparent"
                              />
                              <button onClick={handleAddTag} className="bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-500 shadow-lg"><Plus size={18}/></button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                              {formData.tags?.map(tag => (
                                 <span key={tag.id} style={{backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color}} className="border text-xs px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                                    {tag.label} 
                                    <X size={10} className="cursor-pointer" onClick={() => handleChange('tags', formData.tags?.filter(t => t.id !== tag.id))} />
                                 </span>
                              ))}
                          </div>
                      </div>
                  )}
                  {!editMode && formData.tags && formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                          {formData.tags.map(tag => (
                             <span key={tag.id} style={{backgroundColor: tag.color}} className="text-white text-xs px-3 py-1 rounded-full shadow-sm">
                                {tag.label}
                             </span>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
               <div className="space-y-6 animate-enter px-2">
                   {editMode && (
                       <div className={`p-5 rounded-2xl border space-y-4 mb-8 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/80 border-slate-200'}`}>
                           <h4 className="text-xs font-bold opacity-60 uppercase tracking-wider">افزودن رویداد جدید</h4>
                           <div className="grid grid-cols-2 gap-3">
                               <input placeholder="عنوان رویداد" className={inputClass} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                               <input dir="ltr" placeholder="تاریخ (YYYY)" className={`${inputClass} text-left`} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                           </div>
                           <input placeholder="مکان یا توضیحات کوتاه..." className={inputClass} value={newEvent.location || ''} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
                           <button onClick={handleAddEvent} className="w-full py-2 bg-teal-600 text-white rounded-xl text-sm font-bold shadow hover:bg-teal-500 transition-all">ثبت رویداد</button>
                       </div>
                   )}

                   <div className={`relative border-r-2 mr-4 space-y-10 pb-4 ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
                       {/* Birth */}
                       <div className="relative pr-8">
                           <div className="absolute -right-[9px] top-1.5 w-4 h-4 rounded-full bg-teal-500 ring-4 ring-white/20 shadow-md z-10"></div>
                           <span className="text-sm font-mono opacity-50 block mb-1 font-bold">{formData.birthDate || '---'}</span>
                           <div className="font-bold text-lg">تولد</div>
                           <div className="text-sm opacity-60 mt-1">{formData.location}</div>
                       </div>
                       
                       {/* Dynamic Events */}
                       {formData.events?.sort((a,b) => a.date.localeCompare(b.date)).map((event) => (
                           <div key={event.id} className="relative pr-8 group hover:translate-x-1 transition-transform cursor-default">
                               <div className="absolute -right-[9px] top-1.5 w-4 h-4 rounded-full bg-amber-400 ring-4 ring-white/20 shadow-md z-10 group-hover:scale-125 transition-transform"></div>
                               <span className="text-sm font-mono opacity-50 block mb-1 font-bold">{event.date}</span>
                               <div className="font-bold text-lg">{event.title}</div>
                               <div className="text-sm opacity-60 mt-1">{event.location}</div>
                               {editMode && <button onClick={() => handleChange('events', formData.events?.filter(e => e.id !== event.id))} className="text-red-400 text-xs mt-2 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">حذف</button>}
                           </div>
                       ))}

                       {/* Death */}
                       {formData.deathDate && (
                           <div className="relative pr-8">
                               <div className="absolute -right-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-500 ring-4 ring-white/20 shadow-md z-10"></div>
                               <span className="text-sm font-mono opacity-50 block mb-1 font-bold">{formData.deathDate}</span>
                               <div className="font-bold text-lg text-slate-500">وفات</div>
                           </div>
                       )}
                   </div>
               </div>
          )}

          {/* RELATIONS TAB */}
          {activeTab === 'relations' && (
            <div className="space-y-6 animate-enter">
                
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => onAddChild(member.id)} className={`${cardClass} p-4 rounded-2xl flex flex-col items-center gap-3 hover:border-teal-500 group transition-all`}>
                        <div className="bg-teal-100/20 p-3 rounded-full text-teal-600 group-hover:scale-110 transition-transform"><ArrowUp size={24} className="rotate-180"/></div>
                        <span className="text-sm font-bold">افزودن فرزند</span>
                    </button>
                    <button onClick={() => onAddSibling(member.id)} className={`${cardClass} p-4 rounded-2xl flex flex-col items-center gap-3 hover:border-blue-500 group transition-all`}>
                        <div className="bg-blue-100/20 p-3 rounded-full text-blue-600 group-hover:scale-110 transition-transform"><GitBranch size={24}/></div>
                        <span className="text-sm font-bold">افزودن هم‌سطح</span>
                    </button>
                    <button onClick={() => setIsAddSpouseMode(!isAddSpouseMode)} className={`${cardClass} col-span-2 p-4 rounded-2xl flex flex-row items-center justify-center gap-3 hover:border-pink-500 group transition-all`}>
                        <div className="bg-pink-100/20 p-2 rounded-full text-pink-600 group-hover:scale-110 transition-transform"><HeartHandshake size={24}/></div>
                        <span className="text-sm font-bold">مدیریت همسر / ازدواج</span>
                    </button>
                </div>

                {isAddSpouseMode && (
                    <div className="p-6 rounded-2xl border border-pink-200/50 bg-pink-50/50 backdrop-blur-sm animate-fade-in-scale">
                        <h4 className="text-sm font-bold text-pink-600 mb-4 flex items-center gap-2"><Heart size={18}/> ثبت ازدواج جدید</h4>
                        
                        <div className="flex gap-2 mb-4 bg-white/50 p-1.5 rounded-xl border border-pink-100">
                            <button onClick={() => setSpouseType('new')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${spouseType === 'new' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:bg-pink-100'}`}>شخص جدید</button>
                            <button onClick={() => setSpouseType('existing')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${spouseType === 'existing' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:bg-pink-100'}`}>ازدواج فامیلی</button>
                        </div>

                        {spouseType === 'existing' && (
                             <select 
                                className="w-full p-3 rounded-xl border border-pink-200 text-sm mb-4 bg-white/80 outline-none"
                                value={spouseTargetId}
                                onChange={(e) => setSpouseTargetId(e.target.value)}
                             >
                                 <option value="">انتخاب همسر از لیست اعضا...</option>
                                 {eligibleSpouses.map(m => (
                                     <option key={m.id} value={m.id}>{m.name} ({m.birthDate || '?'})</option>
                                 ))}
                             </select>
                        )}

                        <button onClick={handleAddSpouseSubmit} className="w-full py-3 bg-pink-600 text-white rounded-xl font-bold shadow-lg shadow-pink-300/50 hover:bg-pink-700 transition-all hover:scale-[1.01]">
                            تایید و ثبت همسر
                        </button>
                    </div>
                )}

                <div className={`${cardClass} p-6 rounded-2xl`}>
                    <h4 className="text-xs font-bold opacity-50 mb-4 uppercase tracking-wider">ارتباطات ویژه (غیر درختی)</h4>
                    <div className="space-y-3 mb-5">
                        {member.connections?.map((conn, idx) => {
                             const target = allMembers.find(m => m.id === conn.targetId);
                             return (
                                 <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border text-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-200'}`}>
                                     <div className="flex items-center gap-3">
                                         <span className="w-2 h-2 bg-amber-400 rounded-full shadow-sm shadow-amber-400/50"></span>
                                         <span className="opacity-70">{conn.label}: </span>
                                         <span className="font-bold text-base">{target?.name || 'ناشناس'}</span>
                                     </div>
                                     <button onClick={() => onRemoveConnection(member.id, conn.targetId)} className="text-red-400 hover:bg-red-100/20 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                 </div>
                             );
                        })}
                        {(!member.connections || member.connections.length === 0) && <p className="text-sm opacity-40 text-center italic py-4">هیچ ارتباط ویژه‌ای ثبت نشده است.</p>}
                    </div>
                    
                    <div className="flex gap-2">
                        <select 
                          className={`flex-1 p-3 rounded-xl border text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'}`}
                          value={newConnectionTarget}
                          onChange={(e) => setNewConnectionTarget(e.target.value)}
                        >
                             <option value="">انتخاب فرد...</option>
                             {allMembers.filter(m => m.id !== member.id).map(m => (
                                 <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                        </select>
                        <input 
                           className={`w-32 p-3 rounded-xl border text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'}`}
                           placeholder="عنوان رابطه"
                           value={newConnectionLabel}
                           onChange={(e) => setNewConnectionLabel(e.target.value)}
                        />
                        <button 
                           disabled={!newConnectionTarget}
                           onClick={() => { if(newConnectionTarget) onAddConnection(member.id, newConnectionTarget, newConnectionLabel); }} 
                           className="bg-amber-500 text-white px-4 rounded-xl shadow-lg shadow-amber-500/30 disabled:opacity-50 hover:bg-amber-600 transition-colors"
                        >
                            <Plus size={20}/>
                        </button>
                    </div>
                </div>
                
                <div className="p-6 rounded-2xl border border-teal-200/50 bg-teal-50/30 backdrop-blur-sm">
                    <h4 className="text-xs font-bold text-teal-700 mb-4 flex items-center gap-2 uppercase tracking-wider"><Calculator size={16}/> ماشین حساب پیشرفته نسبت‌ها</h4>
                    <div className="flex gap-2 mb-4">
                        <select 
                          className="w-full p-3 rounded-xl border border-teal-200 text-sm bg-white/80 outline-none focus:ring-1 focus:ring-teal-500"
                          value={calcTargetId}
                          onChange={(e) => { setCalcTargetId(e.target.value); setCalcResult(null); }}
                        >
                             <option value="">مقایسه با...</option>
                             {allMembers.filter(m => m.id !== member.id).map(m => (
                                 <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                        </select>
                        <button onClick={handleCalcRelationship} disabled={!calcTargetId} className="bg-teal-600 text-white px-6 rounded-xl font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50 hover:bg-teal-700 transition-all">
                            محاسبه
                        </button>
                    </div>
                    {calcResult && (
                        <div className="bg-white/90 p-4 rounded-xl border border-teal-200 text-center text-teal-800 font-bold text-lg animate-fade-in-scale shadow-sm flex items-center justify-center gap-2">
                           {calcResult}
                        </div>
                    )}
                </div>
            </div>
          )}
          
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
               <div className="space-y-6 animate-enter">
                    <div className={`${cardClass} p-6 rounded-2xl border-red-100`}>
                        <h4 className="text-xs font-bold opacity-50 mb-4 uppercase tracking-wider text-red-400">منطقه خطر</h4>
                        <button onClick={handleDeleteClick} className="w-full py-4 bg-red-50/50 text-red-600 border border-red-100 rounded-2xl text-sm font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm">
                           <Trash2 size={18}/> حذف دائمی عضو و زیرشاخه‌ها
                        </button>
                    </div>
               </div>
          )}
      </div>
    </div>
  );
};

export default MemberPanel;
