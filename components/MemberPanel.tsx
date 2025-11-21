
import React, { useState, useEffect, useRef } from 'react';
import { FamilyMember, LifeEvent, Tag, VoiceNote } from '../types';
import { generateBiography } from '../services/geminiService';
import { User, Calendar, MapPin, Sparkles, Plus, Trash2, Save, Calculator, ArrowUp, GitBranch, Camera, Briefcase, Settings, Network, Flag, Eye, EyeOff, Route, Image as ImageIcon, Mic, Tag as TagIcon, FileText, Play, X, Heart, HeartHandshake } from 'lucide-react';

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
  onHighlightPath: (memberId: string, direction: 'ancestors' | 'descendants' | 'reset') => void;
  onAddSpouse: (memberId: string, existingSpouseId?: string) => void;
}

type Tab = 'info' | 'events' | 'bio' | 'gallery' | 'relations' | 'settings';

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
  onHighlightPath,
  onAddSpouse
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<FamilyMember>>({});
  const [newConnectionTarget, setNewConnectionTarget] = useState<string>('');
  const [newConnectionLabel, setNewConnectionLabel] = useState<string>('پسرعمو/دخترعمو');
  const [spouseTargetId, setSpouseTargetId] = useState<string>('');
  const [isAddSpouseMode, setIsAddSpouseMode] = useState(false);
  const [spouseType, setSpouseType] = useState<'new' | 'existing'>('new');
  
  // New Feature States
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newEvent, setNewEvent] = useState<Partial<LifeEvent>>({ title: '', date: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  // Relationship Calculator State
  const [calcTargetId, setCalcTargetId] = useState<string>('');
  const [calcResult, setCalcResult] = useState<string | null>(null);
  
  const isDark = document.body.classList.contains('theme-dark');
  const isVintage = document.body.classList.contains('theme-vintage');
  
  const cardClass = isDark ? 'glass-card-dark text-slate-200' : (isVintage ? 'glass-panel-vintage' : 'glass-card');
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

  if (!member) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-enter">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 animate-pulse ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-white/50 text-slate-400 shadow-lg'}`}>
            <Network size={48} className="opacity-50"/>
        </div>
        <p className="text-lg font-medium opacity-70">عضوی انتخاب نشده است</p>
        <p className="text-sm mt-2 opacity-50">برای مشاهده جزئیات، روی یکی از افراد در نمودار کلیک کنید.</p>
        <div className="mt-8 pt-8 border-t border-dashed border-current opacity-20 w-full max-w-xs"></div>
        <button 
            onClick={onAddParent} 
            className="mt-4 w-full max-w-xs py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
        >
            <Plus size={18}/> ایجاد خاندان جدید
        </button>
      </div>
    );
  }

  const handleSave = () => {
    if (formData.id) {
      onUpdateMember(formData as FamilyMember);
      setEditMode(false);
    }
  };

  const handleChange = (field: keyof FamilyMember, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateBio = async () => {
    setIsGenerating(true);
    const bio = await generateBiography({
      name: formData.name || '',
      birthDate: formData.birthDate,
      location: formData.location,
      relation: formData.relation,
      extraContext: `Occupation: ${formData.occupation}. Gender: ${formData.gender}`
    });
    setFormData(prev => ({ ...prev, bio }));
    setIsGenerating(false);
    setEditMode(true);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>, isGallery = false) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              if (isGallery) {
                  const currentGallery = formData.gallery || [];
                  handleChange('gallery', [...currentGallery, result]);
              } else {
                  handleChange('imageUrl', result);
              }
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
    // Print logic remains same
    const content = `گزارش شجره‌نامه\n----------------\nنام: ${formData.name}\n...`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="h-full flex flex-col backdrop-blur-xl bg-transparent">
      {/* Hero Header */}
      <div className={`relative h-40 ${member.gender === 'male' ? 'bg-gradient-to-r from-blue-600/80 to-blue-400/80' : 'bg-gradient-to-r from-pink-600/80 to-pink-400/80'} shrink-0 overflow-hidden`}>
         <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
         
         <div className="absolute -bottom-12 right-6 flex items-end z-10">
             <div className="relative group">
                <div className={`w-28 h-28 rounded-2xl border-4 ${isDark ? 'border-slate-800' : 'border-white'} shadow-xl overflow-hidden bg-white/10 backdrop-blur-md`}>
                    {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt={formData.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/20 text-white/80">
                            <User size={48} />
                        </div>
                    )}
                </div>
                {editMode && (
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 left-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 backdrop-blur-sm transition-transform hover:scale-110">
                        <Camera size={16} />
                    </button>
                )}
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleUploadImage(e)} accept="image/*" />
             </div>
         </div>
         
         <div className="absolute top-4 right-4 text-white/90 cursor-pointer hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full" onClick={() => setEditMode(!editMode)}>
            {editMode ? <Save size={20} onClick={handleSave}/> : <Settings size={20}/>}
         </div>
         
         <div className="absolute top-4 left-4 text-white/70 font-mono text-xs bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm">
            ID: {formData.id?.substring(0,6)}...
         </div>
      </div>

      {/* Name & Meta */}
      <div className={`pt-14 px-6 pb-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-100/50'}`}>
          {editMode ? (
              <input 
                className={`text-2xl font-bold w-full border-b border-slate-300 focus:border-teal-500 outline-none bg-transparent mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
          ) : (
              <h2 className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{formData.name}</h2>
          )}
          
          <div className="flex flex-wrap gap-2 mt-2">
             <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md shadow-sm ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white/60 text-slate-600'}`}>
                <Calendar size={12}/> {formData.birthDate || '؟'} - {formData.deathDate || (editMode ? '' : 'اکنون')}
             </span>
             {formData.occupation && (
                 <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border shadow-sm ${isDark ? 'bg-amber-900/30 text-amber-400 border-amber-900/50' : 'bg-amber-50/80 text-amber-700 border-amber-100'}`}>
                    <Briefcase size={12}/> {formData.occupation}
                 </span>
             )}
             {formData.tags?.map(tag => (
                 <span key={tag.id} style={{backgroundColor: tag.color + 'aa'}} className="text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm">
                    {tag.label} 
                    {editMode && <X size={10} className="cursor-pointer" onClick={() => handleChange('tags', formData.tags?.filter(t => t.id !== tag.id))} />}
                 </span>
             ))}
          </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b overflow-x-auto no-scrollbar px-2 sticky top-0 z-20 backdrop-blur-md ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white/40 border-slate-200/50'}`}>
          {[
              {id: 'info', label: 'اطلاعات', icon: User},
              {id: 'bio', label: 'سرگذشت', icon: FileText},
              {id: 'events', label: 'رویدادها', icon: Route},
              {id: 'gallery', label: 'نگارخانه', icon: ImageIcon},
              {id: 'relations', label: 'روابط', icon: Network},
              {id: 'settings', label: 'ابزارها', icon: Settings},
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                    ? (isDark ? 'text-teal-400' : 'text-teal-700') 
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
                }`}
              >
                 <tab.icon size={16} /> {tab.label}
                 {activeTab === tab.id && (
                     <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-500 to-transparent"></span>
                 )}
              </button>
          ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* INFO TAB */}
          {activeTab === 'info' && (
              <div className="space-y-5 animate-enter">
                  <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded-xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-1">جنسیت</label>
                          {editMode ? (
                              <select 
                                className={inputClass}
                                value={formData.gender}
                                onChange={(e) => handleChange('gender', e.target.value)}
                              >
                                  <option value="male">مرد</option>
                                  <option value="female">زن</option>
                              </select>
                          ) : (
                              <div className="font-medium">{formData.gender === 'male' ? 'مرد' : 'زن'}</div>
                          )}
                      </div>
                      <div className={`p-3 rounded-xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-1">شغل / حرفه</label>
                          {editMode ? (
                              <input className={inputClass} value={formData.occupation || ''} onChange={(e) => handleChange('occupation', e.target.value)} placeholder="مثلا: معلم" />
                          ) : (
                              <div className="font-medium">{formData.occupation || '-'}</div>
                          )}
                      </div>
                      <div className={`p-3 rounded-xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-1">تاریخ تولد</label>
                          {editMode ? (
                              <input className={`${inputClass} text-left ltr`} value={formData.birthDate || ''} onChange={(e) => handleChange('birthDate', e.target.value)} placeholder="1360/01/01" />
                          ) : (
                              <div className="font-medium dir-ltr text-right">{formData.birthDate || '-'}</div>
                          )}
                      </div>
                      <div className={`p-3 rounded-xl ${cardClass}`}>
                          <label className="text-xs font-bold opacity-50 block mb-1">تاریخ وفات</label>
                          {editMode ? (
                              <input className={`${inputClass} text-left ltr`} value={formData.deathDate || ''} onChange={(e) => handleChange('deathDate', e.target.value)} placeholder="-" />
                          ) : (
                              <div className="font-medium dir-ltr text-right">{formData.deathDate || '-'}</div>
                          )}
                      </div>
                  </div>

                  <div className={`p-3 rounded-xl ${cardClass}`}>
                      <label className="text-xs font-bold opacity-50 block mb-1 flex items-center gap-1"><MapPin size={12}/> محل زندگی/تولد</label>
                      {editMode ? (
                          <input className={inputClass} value={formData.location || ''} onChange={(e) => handleChange('location', e.target.value)} placeholder="تهران، ایران" />
                      ) : (
                          <div className="font-medium">{formData.location || '-'}</div>
                      )}
                  </div>
                  
                  {editMode && (
                      <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50/80 border border-slate-100'}`}>
                          <label className="text-xs font-bold opacity-60 mb-2 block">مدیریت برچسب‌ها</label>
                          <div className="flex gap-2">
                              <input 
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                className={`${inputClass} flex-1`}
                                placeholder="عنوان برچسب"
                              />
                              <input 
                                type="color" 
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                className="w-10 h-10 p-1 rounded-lg border cursor-pointer bg-transparent"
                              />
                              <button onClick={handleAddTag} className="bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-500 shadow-lg"><Plus size={18}/></button>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* BIO TAB */}
          {activeTab === 'bio' && (
              <div className="space-y-4 animate-enter">
                  {editMode ? (
                      <div className="space-y-3">
                           <textarea 
                             className={`w-full h-64 p-4 rounded-xl border text-sm leading-7 outline-none focus:border-teal-500 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white/50 border-slate-200'}`}
                             value={formData.bio || ''}
                             onChange={(e) => handleChange('bio', e.target.value)}
                             placeholder="زندگینامه را اینجا بنویسید..."
                           />
                           <button 
                             onClick={handleGenerateBio}
                             disabled={isGenerating}
                             className="w-full py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50 hover:scale-[1.02] transition-all"
                           >
                               {isGenerating ? <span className="animate-spin">⏳</span> : <Sparkles size={16}/>}
                               نگارش هوشمند با هوش مصنوعی
                           </button>
                      </div>
                  ) : (
                      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700 text-slate-300' : 'bg-white/60 border-white/50 text-slate-600 shadow-sm'} leading-8 text-justify relative overflow-hidden`}>
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-amber-400 to-pink-400 opacity-50"></div>
                          {formData.bio ? formData.bio : <p className="opacity-50 italic text-center">هنوز زندگینامه‌ای ثبت نشده است.</p>}
                      </div>
                  )}
                  
                  {/* Voice Notes Placeholder */}
                  <div className="mt-6 pt-6 border-t border-dashed border-current opacity-20"></div>
                  <div className={`rounded-xl p-4 flex items-center justify-center border border-dashed ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-300 bg-slate-50/50'}`}>
                      <button className="flex flex-col items-center gap-2 hover:text-teal-500 transition-colors group">
                          <div className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-sm transition-all group-hover:scale-110 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}><Mic size={20}/></div>
                          <span className="text-xs font-medium opacity-60">ضبط صدا (به زودی)</span>
                      </button>
                  </div>
              </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
               <div className="space-y-6 animate-enter">
                   {editMode && (
                       <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/80 border-slate-200'}`}>
                           <h4 className="text-xs font-bold opacity-60">افزودن رویداد جدید</h4>
                           <div className="grid grid-cols-2 gap-2">
                               <input placeholder="عنوان" className={inputClass} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                               <input placeholder="تاریخ" className={inputClass} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                           </div>
                           <input placeholder="توضیحات..." className={inputClass} value={newEvent.location || ''} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
                           <button onClick={handleAddEvent} className="w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-bold shadow hover:bg-teal-500 transition-all">افزودن</button>
                       </div>
                   )}

                   <div className={`relative border-r-2 mr-2 space-y-8 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                       {/* Birth */}
                       <div className="relative pr-6">
                           <div className="absolute -right-[9px] top-1 w-4 h-4 rounded-full bg-teal-500 ring-4 ring-white/20 shadow-sm"></div>
                           <span className="text-xs font-mono opacity-50 block mb-1">{formData.birthDate || '---'}</span>
                           <div className="font-bold">تولد</div>
                           <div className="text-xs opacity-60">{formData.location}</div>
                       </div>
                       
                       {/* Custom Events */}
                       {formData.events?.sort((a,b) => a.date.localeCompare(b.date)).map((event) => (
                           <div key={event.id} className="relative pr-6 group hover:translate-x-1 transition-transform">
                               <div className="absolute -right-[9px] top-1 w-4 h-4 rounded-full bg-amber-400 ring-4 ring-white/20 shadow-sm group-hover:scale-125 transition-transform"></div>
                               <span className="text-xs font-mono opacity-50 block mb-1">{event.date}</span>
                               <div className="font-bold">{event.title}</div>
                               <div className="text-xs opacity-60">{event.location}</div>
                               {editMode && <button onClick={() => handleChange('events', formData.events?.filter(e => e.id !== event.id))} className="text-red-400 text-[10px] mt-1 hover:underline">حذف</button>}
                           </div>
                       ))}

                       {/* Death */}
                       {formData.deathDate && (
                           <div className="relative pr-6">
                               <div className="absolute -right-[9px] top-1 w-4 h-4 rounded-full bg-slate-500 ring-4 ring-white/20 shadow-sm"></div>
                               <span className="text-xs font-mono opacity-50 block mb-1">{formData.deathDate}</span>
                               <div className="font-bold">وفات</div>
                           </div>
                       )}
                   </div>
               </div>
          )}

          {/* GALLERY TAB */}
          {activeTab === 'gallery' && (
               <div className="animate-enter">
                   <div className="grid grid-cols-2 gap-3">
                       {formData.gallery?.map((img, idx) => (
                           <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group shadow-md border border-white/10">
                               <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={`Gallery ${idx}`} />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                               {editMode && (
                                   <button 
                                     onClick={() => handleChange('gallery', formData.gallery?.filter((_, i) => i !== idx))}
                                     className="absolute top-2 right-2 bg-red-500/80 backdrop-blur text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                   >
                                       <Trash2 size={14}/>
                                   </button>
                               )}
                           </div>
                       ))}
                       <div 
                         onClick={() => galleryInputRef.current?.click()}
                         className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.02] ${isDark ? 'border-slate-700 text-slate-500 hover:border-teal-500 hover:text-teal-400' : 'border-slate-300 text-slate-400 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50/50'}`}
                       >
                           <Plus size={32} className="mb-2 opacity-50" />
                           <span className="text-xs font-bold">افزودن تصویر</span>
                       </div>
                   </div>
                   <input type="file" ref={galleryInputRef} className="hidden" onChange={(e) => handleUploadImage(e, true)} accept="image/*" />
               </div>
          )}

          {/* RELATIONS TAB */}
          {activeTab === 'relations' && (
            <div className="space-y-6 animate-enter">
                
                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => onAddChild(member.id)} className={`${cardClass} p-3 flex flex-col items-center gap-2 hover:border-teal-500 group`}>
                        <div className="bg-teal-100/20 p-2 rounded-full text-teal-600 group-hover:scale-110 transition-transform"><ArrowUp size={20} className="rotate-180"/></div>
                        <span className="text-xs font-bold">افزودن فرزند</span>
                    </button>
                    <button onClick={() => onAddSibling(member.id)} className={`${cardClass} p-3 flex flex-col items-center gap-2 hover:border-blue-500 group`}>
                        <div className="bg-blue-100/20 p-2 rounded-full text-blue-600 group-hover:scale-110 transition-transform"><GitBranch size={20}/></div>
                        <span className="text-xs font-bold">افزودن هم‌سطح</span>
                    </button>
                    <button onClick={() => setIsAddSpouseMode(!isAddSpouseMode)} className={`${cardClass} col-span-2 p-3 flex flex-col items-center gap-2 hover:border-pink-500 group`}>
                        <div className="bg-pink-100/20 p-2 rounded-full text-pink-600 group-hover:scale-110 transition-transform"><HeartHandshake size={20}/></div>
                        <span className="text-xs font-bold">افزودن / مدیریت همسر</span>
                    </button>
                </div>

                {/* Add Spouse Form */}
                {isAddSpouseMode && (
                    <div className="p-4 rounded-xl border border-pink-200/50 bg-pink-50/50 backdrop-blur-sm animate-fade-in-scale">
                        <h4 className="text-sm font-bold text-pink-600 mb-3 flex items-center gap-2"><Heart size={16}/> ثبت ازدواج</h4>
                        
                        <div className="flex gap-2 mb-4 bg-white/50 p-1 rounded-lg border border-pink-100">
                            <button onClick={() => setSpouseType('new')} className={`flex-1 py-1 text-xs rounded-md transition-all ${spouseType === 'new' ? 'bg-pink-500 text-white shadow' : 'text-slate-500'}`}>شخص جدید</button>
                            <button onClick={() => setSpouseType('existing')} className={`flex-1 py-1 text-xs rounded-md transition-all ${spouseType === 'existing' ? 'bg-pink-500 text-white shadow' : 'text-slate-500'}`}>ازدواج فامیلی</button>
                        </div>

                        {spouseType === 'existing' && (
                             <select 
                                className="w-full p-2 rounded-lg border border-pink-200 text-sm mb-3 bg-white/80 outline-none"
                                value={spouseTargetId}
                                onChange={(e) => setSpouseTargetId(e.target.value)}
                             >
                                 <option value="">انتخاب همسر از لیست اعضا...</option>
                                 {eligibleSpouses.map(m => (
                                     <option key={m.id} value={m.id}>{m.name} ({m.birthDate || '?'})</option>
                                 ))}
                             </select>
                        )}

                        <button onClick={handleAddSpouseSubmit} className="w-full py-2 bg-pink-600 text-white rounded-lg font-bold shadow-lg shadow-pink-300/50 hover:bg-pink-700 transition-all hover:scale-[1.01]">
                            ثبت همسر
                        </button>
                    </div>
                )}

                {/* Connections List */}
                <div className={`${cardClass} p-4 rounded-xl`}>
                    <h4 className="text-xs font-bold opacity-50 mb-3">ارتباطات ویژه (غیر درختی)</h4>
                    <div className="space-y-2 mb-4">
                        {member.connections?.map((conn, idx) => {
                             const target = allMembers.find(m => m.id === conn.targetId);
                             return (
                                 <div key={idx} className={`flex justify-between items-center p-2 rounded-lg border text-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-200'}`}>
                                     <div className="flex items-center gap-2">
                                         <span className="w-2 h-2 bg-amber-400 rounded-full shadow-sm shadow-amber-400/50"></span>
                                         <span className="opacity-70">{conn.label}: </span>
                                         <span className="font-bold">{target?.name || 'ناشناس'}</span>
                                     </div>
                                     <button onClick={() => onRemoveConnection(member.id, conn.targetId)} className="text-red-400 hover:bg-red-100/20 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                                 </div>
                             );
                        })}
                        {(!member.connections || member.connections.length === 0) && <p className="text-xs opacity-40 text-center italic">هیچ ارتباط ویژه‌ای ثبت نشده است.</p>}
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                        <select 
                          className={`flex-1 p-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'}`}
                          value={newConnectionTarget}
                          onChange={(e) => setNewConnectionTarget(e.target.value)}
                        >
                             <option value="">انتخاب فرد...</option>
                             {allMembers.filter(m => m.id !== member.id).map(m => (
                                 <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                        </select>
                        <input 
                           className={`w-24 p-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white/80 border-slate-200'}`}
                           placeholder="عنوان"
                           value={newConnectionLabel}
                           onChange={(e) => setNewConnectionLabel(e.target.value)}
                        />
                        <button 
                           disabled={!newConnectionTarget}
                           onClick={() => { if(newConnectionTarget) onAddConnection(member.id, newConnectionTarget, newConnectionLabel); }} 
                           className="bg-amber-500 text-white p-2 rounded-lg shadow-lg shadow-amber-500/30 disabled:opacity-50 hover:bg-amber-600 transition-colors"
                        >
                            <Plus size={16}/>
                        </button>
                    </div>
                </div>
                
                {/* Calculator */}
                <div className="p-4 rounded-xl border border-teal-200/50 bg-teal-50/30 backdrop-blur-sm">
                    <h4 className="text-xs font-bold text-teal-700 mb-3 flex items-center gap-2"><Calculator size={14}/> ماشین حساب نسبت‌ها</h4>
                    <div className="flex gap-2 mb-3">
                        <select 
                          className="w-full p-2 rounded-lg border border-teal-200 text-sm bg-white/80 outline-none focus:ring-1 focus:ring-teal-500"
                          value={calcTargetId}
                          onChange={(e) => { setCalcTargetId(e.target.value); setCalcResult(null); }}
                        >
                             <option value="">مقایسه با...</option>
                             {allMembers.filter(m => m.id !== member.id).map(m => (
                                 <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                        </select>
                        <button onClick={handleCalcRelationship} disabled={!calcTargetId} className="bg-teal-600 text-white px-4 rounded-lg font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50 hover:bg-teal-700">
                            محاسبه
                        </button>
                    </div>
                    {calcResult && (
                        <div className="bg-white/90 p-3 rounded-lg border border-teal-200 text-center text-teal-700 font-bold text-sm animate-fade-in-scale shadow-sm">
                            {calcResult}
                        </div>
                    )}
                </div>
            </div>
          )}
          
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
               <div className="space-y-6 animate-enter">
                    <div className={`${cardClass} p-4 rounded-xl`}>
                        <h4 className="text-xs font-bold opacity-50 mb-3 flex items-center gap-2"><Eye size={16}/> ابزارهای بصری</h4>
                        <div className="space-y-2">
                            <button onClick={() => onHighlightPath(member.id, 'ancestors')} className={`w-full py-2 border rounded-lg text-sm transition-colors flex justify-between px-4 ${isDark ? 'bg-slate-800 border-slate-600 hover:border-teal-500' : 'bg-white/60 border-slate-200 hover:border-teal-500 hover:text-teal-600'}`}>
                                <span>نمایش اجداد (Ancestors)</span>
                                <ArrowUp size={16}/>
                            </button>
                            <button onClick={() => onHighlightPath(member.id, 'descendants')} className={`w-full py-2 border rounded-lg text-sm transition-colors flex justify-between px-4 ${isDark ? 'bg-slate-800 border-slate-600 hover:border-teal-500' : 'bg-white/60 border-slate-200 hover:border-teal-500 hover:text-teal-600'}`}>
                                <span>نمایش نوادگان (Descendants)</span>
                                <ArrowUp size={16} className="rotate-180"/>
                            </button>
                             <button onClick={() => onHighlightPath(member.id, 'reset')} className={`w-full py-2 rounded-lg text-sm transition-colors flex justify-between px-4 ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                                <span>بازنشانی حالت نمایش</span>
                                <EyeOff size={16}/>
                            </button>
                        </div>
                    </div>
                    
                    <div className={`${cardClass} p-4 rounded-xl`}>
                        <h4 className="text-xs font-bold opacity-50 mb-3">عملیات پیشرفته</h4>
                        <div className="space-y-3">
                             <button onClick={handlePrint} className="w-full py-2 bg-blue-50/50 text-blue-600 border border-blue-100 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                                <FileText size={16}/> چاپ گزارش کامل فرد
                             </button>
                             
                             <hr className="border-current opacity-10"/>
                             
                             <button onClick={() => { if(window.confirm('آیا از حذف این عضو و تمام زیرمجموعه‌هایش اطمینان دارید؟')) onDeleteMember(member.id); }} className="w-full py-3 bg-red-50/50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                                <Trash2 size={16}/> حذف عضو از درخت
                             </button>
                        </div>
                    </div>
               </div>
          )}
      </div>
    </div>
  );
};

export default MemberPanel;
