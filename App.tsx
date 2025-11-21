
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FamilyMember, AppTheme } from './types';
import FamilyTree from './components/FamilyTree';
import MemberPanel from './components/MemberPanel';
import { suggestResearch } from './services/geminiService';
import { Sparkles, Menu, X, Search, Download, Upload, BarChart3, Clock, User, Palette, AlertTriangle, Maximize, Minimize, FileText, Filter } from 'lucide-react';

// Historical Context Data (Persian/World History)
const historicalEvents = [
    { year: 1285, title: 'امضای فرمان مشروطیت' },
    { year: 1299, title: 'کودتای ۳ اسفند' },
    { year: 1304, title: 'تاسیس سلسله پهلوی' },
    { year: 1320, title: 'اشغال ایران در جنگ جهانی دوم' },
    { year: 1329, title: 'ملی شدن صنعت نفت' },
    { year: 1357, title: 'پیروزی انقلاب اسلامی' },
    { year: 1359, title: 'آغاز جنگ تحمیلی' },
    { year: 1367, title: 'پایان جنگ تحمیلی' },
];

// --- Complex Initial Data (3 Roots, 7 Generations) ---
const complexFamilyData: FamilyMember = {
  id: 'system_root',
  name: 'ریشه سیستم',
  relation: 'SystemRoot',
  gender: 'male',
  children: [
    // --- CLAN 1: BOZORGNIA (The Main Line - 7 Generations) ---
    {
      id: 'root_1',
      name: 'حاج رضا بزرگ‌نیا',
      relation: 'Root',
      gender: 'male',
      birthDate: '1250',
      deathDate: '1320',
      location: 'تبریز',
      occupation: 'تجار بزرگ بازار',
      bio: 'سر سلسله خاندان بزرگ‌نیا که تجارت فرش را از تبریز به تهران آورد.',
      tags: [{id: 't1', label: 'موسس', color: '#ca8a04'}],
      children: [
        {
          id: 'gen2_1',
          name: 'میرزا احمد',
          relation: 'Son',
          gender: 'male',
          birthDate: '1280',
          children: [
            {
              id: 'gen3_1',
              name: 'پروین',
              relation: 'Daughter',
              gender: 'female',
              birthDate: '1310',
              children: [
                {
                  id: 'gen4_1',
                  name: 'فرهاد',
                  relation: 'Son',
                  gender: 'male',
                  birthDate: '1335',
                  children: [
                    {
                      id: 'gen5_1',
                      name: 'آرش',
                      relation: 'Son',
                      gender: 'male',
                      birthDate: '1360',
                      occupation: 'مهندس نرم‌افزار',
                      children: [
                        {
                          id: 'gen6_1',
                          name: 'باران',
                          relation: 'Daughter',
                          gender: 'female',
                          birthDate: '1390',
                          children: [
                             {
                                id: 'gen7_1',
                                name: 'نیکان',
                                relation: 'Son',
                                gender: 'male',
                                birthDate: '1402',
                                tags: [{id: 'newborn', label: 'نسل هفتم', color: '#3b82f6'}]
                             }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'gen2_2',
          name: 'اقدس خانم',
          relation: 'Daughter',
          gender: 'female',
          birthDate: '1285',
          connections: [
             { targetId: 'root_3_son', label: 'همسر (از خاندان راد)' } // Marriage to Clan 3
          ],
          children: []
        }
      ]
    },

    // --- CLAN 2: HEKMAT (The Scholars) ---
    {
      id: 'root_2',
      name: 'میرزا یحیی حکمت',
      relation: 'Root',
      gender: 'male',
      birthDate: '1260',
      location: 'شیراز',
      occupation: 'خطاط و شاعر',
      tags: [{id: 'art', label: 'هنرمند', color: '#db2777'}],
      children: [
        {
          id: 'root_2_daughter',
          name: 'فروغ',
          relation: 'Daughter',
          gender: 'female',
          birthDate: '1290',
          children: [
             {
                id: 'gen3_hekmat',
                name: 'سیاوش',
                relation: 'Son',
                gender: 'male',
                birthDate: '1315',
                connections: [
                    { targetId: 'gen3_1', label: 'همسر (ازدواج با نوه بزرگ‌نیا)' } // Marriage to Clan 1
                ],
                children: [] // Their children would typically be listed under the father or cross-referenced
             }
          ]
        }
      ]
    },

    // --- CLAN 3: RAD (The Military Line) ---
    {
      id: 'root_3',
      name: 'سرهنگ راد',
      relation: 'Root',
      gender: 'male',
      birthDate: '1255',
      location: 'تهران',
      occupation: 'نظامی',
      tags: [{id: 'mil', label: 'نظامی', color: '#166534'}],
      children: [
         {
             id: 'root_3_son',
             name: 'جهانگیر خان',
             relation: 'Son',
             gender: 'male',
             birthDate: '1282',
             children: [
                 {
                     id: 'gen3_rad',
                     name: 'شیرین',
                     gender: 'female',
                     relation: 'Daughter',
                     birthDate: '1310',
                     children: []
                 }
             ]
         }
      ]
    }
  ]
};

const App: React.FC = () => {
  const [treeData, setTreeData] = useState<FamilyMember>(complexFamilyData);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'male' | 'female' | 'living' | 'deceased'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [theme, setTheme] = useState<AppTheme>('modern');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme to body class
  useEffect(() => {
      document.body.className = `theme-${theme}`;
  }, [theme]);

  // Helpers and logic same as before...
  const findNode = useCallback((node: FamilyMember, id: string): FamilyMember | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const findParent = useCallback((root: FamilyMember, targetId: string): FamilyMember | null => {
    if (root.children) {
      for (const child of root.children) {
        if (child.id === targetId) return root;
        const found = findParent(child, targetId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const updateNode = (node: FamilyMember, updated: FamilyMember): FamilyMember => {
    if (node.id === updated.id) return updated;
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => updateNode(child, updated))
      };
    }
    return node;
  };

  const addChildNode = (node: FamilyMember, parentId: string): FamilyMember => {
    if (node.id === parentId) {
      const newChild: FamilyMember = {
        id: Date.now().toString(),
        name: 'فرزند جدید',
        gender: 'male',
        relation: 'Child',
        children: []
      };
      return {
        ...node,
        children: [...(node.children || []), newChild]
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addChildNode(child, parentId))
      };
    }
    return node;
  };

  const addSiblingNode = (root: FamilyMember, siblingId: string): FamilyMember => {
    if (root.id === siblingId) {
      alert("نمی‌توانید برای ریشه اصلی، هم‌سطح ایجاد کنید (مگر اینکه والد اضافه کنید).");
      return root;
    }
    const parent = findParent(root, siblingId);
    if (parent) {
       return addChildNode(root, parent.id);
    }
    return root;
  };

  const addParentToRoot = (currentRoot: FamilyMember) => {
      if (currentRoot.relation === 'SystemRoot') {
           const newClanRoot: FamilyMember = {
              id: Date.now().toString(),
              name: 'سرشاخه جدید',
              gender: 'male',
              relation: 'Root',
              children: []
          };
          const newTree = {
              ...currentRoot,
              children: [...(currentRoot.children || []), newClanRoot]
          };
          setTreeData(newTree);
          return;
      }
      const newRoot: FamilyMember = {
        id: Date.now().toString(),
        name: 'بزرگ‌خاندان (جدید)',
        gender: 'male',
        relation: 'Root',
        children: [currentRoot]
      };
      setTreeData(newRoot);
  };

  const deleteNode = (node: FamilyMember, idToDelete: string): FamilyMember | null => {
    if (node.id === idToDelete) return null;
    if (node.children) {
      return {
        ...node,
        children: node.children
          .map(child => deleteNode(child, idToDelete))
          .filter((child): child is FamilyMember => child !== null)
      };
    }
    return node;
  };

  const addConnectionNode = (node: FamilyMember, sourceId: string, targetId: string, label: string): FamilyMember => {
    if (node.id === sourceId) {
      const existing = node.connections || [];
      if (existing.some(c => c.targetId === targetId)) return node;
      return { ...node, connections: [...existing, { targetId, label }] };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addConnectionNode(child, sourceId, targetId, label))
      };
    }
    return node;
  };

  const removeConnectionNode = (node: FamilyMember, sourceId: string, targetId: string): FamilyMember => {
    if (node.id === sourceId && node.connections) {
      return {
        ...node,
        connections: node.connections.filter(c => c.targetId !== targetId)
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => removeConnectionNode(child, sourceId, targetId))
      };
    }
    return node;
  };

  const handleAddSpouse = (memberId: string, existingSpouseId?: string) => {
      if (existingSpouseId) {
          let newTree = addConnectionNode(treeData, memberId, existingSpouseId, 'همسر');
          newTree = addConnectionNode(newTree, existingSpouseId, memberId, 'همسر');
          setTreeData(newTree);
          alert("ازدواج فامیلی ثبت شد.");
      } else {
          const member = findNode(treeData, memberId);
          const spouseGender = member?.gender === 'male' ? 'female' : 'male';
          const spouseName = member?.gender === 'male' ? 'همسر (خانم)' : 'همسر (آقا)';
          
          const newSpouse: FamilyMember = {
              id: Date.now().toString(),
              name: spouseName,
              gender: spouseGender,
              relation: 'Spouse',
              children: [] 
          };

          let newTree = treeData;
          if (treeData.relation === 'SystemRoot') {
               newTree = {
                   ...treeData,
                   children: [...(treeData.children || []), newSpouse]
               };
          } else {
              newTree = {
                  id: 'system_root_auto',
                  relation: 'SystemRoot',
                  name: 'System',
                  gender: 'male',
                  children: [treeData, newSpouse]
              };
          }
          newTree = addConnectionNode(newTree, memberId, newSpouse.id, 'همسر');
          newTree = addConnectionNode(newTree, newSpouse.id, memberId, 'همسر');
          setTreeData(newTree);
      }
  };

  const flattenTree = (node: FamilyMember): FamilyMember[] => {
    let list = [node];
    if (node.children) {
      node.children.forEach(child => {
        list = [...list, ...flattenTree(child)];
      });
    }
    return list;
  };

  const allMembers = useMemo(() => flattenTree(treeData), [treeData]);

  const validationWarnings = useMemo(() => {
      const warnings: string[] = [];
      if (selectedMember) {
          const parent = findParent(treeData, selectedMember.id);
          if (parent && parent.birthDate && selectedMember.birthDate) {
              if (selectedMember.birthDate < parent.birthDate) {
                  warnings.push(`هشدار: تاریخ تولد ${selectedMember.name} قبل از والدش (${parent.name}) ثبت شده است.`);
              }
          }
          if (selectedMember.deathDate && selectedMember.birthDate) {
              if (selectedMember.deathDate < selectedMember.birthDate) {
                  warnings.push('هشدار: تاریخ وفات قبل از تولد است.');
              }
          }
      }
      return warnings;
  }, [selectedMember, treeData, findParent]);

  const treeStats = useMemo(() => {
      const total = allMembers.length;
      const males = allMembers.filter(m => m.gender === 'male').length;
      const females = allMembers.filter(m => m.gender === 'female').length;
      const deceased = allMembers.filter(m => !!m.deathDate).length;
      const living = total - deceased;
      let totalAge = 0;
      let ageCount = 0;
      allMembers.forEach(m => {
          if (m.birthDate && m.deathDate) {
             const birth = parseInt(m.birthDate.slice(0,4));
             const death = parseInt(m.deathDate.slice(0,4));
             if(!isNaN(birth) && !isNaN(death)) {
                 totalAge += (death - birth);
                 ageCount++;
             }
          }
      });
      const avgLifespan = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;
      const locationMap: Record<string, number> = {};
      allMembers.forEach(m => {
          if (m.location) {
              const city = m.location.split('،')[0].trim();
              locationMap[city] = (locationMap[city] || 0) + 1;
          }
      });
      const topLocations = Object.entries(locationMap).sort((a,b) => b[1] - a[1]).slice(0, 3);
      const getDepth = (node: FamilyMember): number => {
          if (!node.children || node.children.length === 0) return 1;
          return 1 + Math.max(...node.children.map(getDepth));
      };
      const maxDepth = getDepth(treeData);
      return { total, males, females, deceased, living, avgLifespan, maxDepth, topLocations };
  }, [allMembers, treeData]);

  const timelineEvents = useMemo(() => {
      const events: {date: string, type: string, title: string, isHistory?: boolean, member?: FamilyMember}[] = [];
      allMembers.forEach(m => {
          if(m.birthDate) events.push({date: m.birthDate, type: 'تولد', title: `تولد ${m.name}`, member: m});
          if(m.deathDate) events.push({date: m.deathDate, type: 'وفات', title: `وفات ${m.name}`, member: m});
          if(m.events) {
              m.events.forEach(e => {
                  events.push({date: e.date, type: 'رویداد شخصی', title: `${e.title} (${m.name})`, member: m});
              });
          }
      });
      const minYear = Math.min(...events.map(e => parseInt(e.date.slice(0,4)) || 9999));
      const maxYear = Math.max(...events.map(e => parseInt(e.date.slice(0,4)) || 0));
      historicalEvents.forEach(h => {
          if(h.year >= minYear && h.year <= maxYear) {
              events.push({
                  date: `${h.year}/01/01`,
                  type: 'تاریخ ایران',
                  title: h.title,
                  isHistory: true
              });
          }
      });
      return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [allMembers]);

  const getPathToRoot = (root: FamilyMember, targetId: string): FamilyMember[] | null => {
    if (root.id === targetId) return [root];
    if (root.children) {
      for (const child of root.children) {
        const path = getPathToRoot(child, targetId);
        if (path) return [root, ...path];
      }
    }
    return null;
  };

  const calculateRelationship = (id1: string, id2: string): string => {
    if (id1 === id2) return "خود شخص";
    const path1 = getPathToRoot(treeData, id1);
    const path2 = getPathToRoot(treeData, id2);

    if (!path1 || !path2) {
        const member1 = findNode(treeData, id1);
        if (member1?.connections?.some(c => c.targetId === id2 && c.label.includes('همسر'))) return 'همسر';
        return "ارتباط مستقیم خونی یافت نشد";
    }

    let i = 0;
    while (i < path1.length && i < path2.length && path1[i].id === path2[i].id) i++;
    const lcaIndex = i - 1;
    
    if (path1[lcaIndex].relation === 'SystemRoot') return "از دو خاندان متفاوت (ارتباط سببی/ازدواج)";
    
    const dist1 = path1.length - 1 - lcaIndex; 
    const dist2 = path2.length - 1 - lcaIndex; 
    const target = path2[path2.length - 1]; 
    const targetGender = target.gender;

    if (dist1 > 0 && dist2 === 0) {
      if (dist1 === 1) return targetGender === 'male' ? 'پدر' : 'مادر';
      if (dist1 === 2) return targetGender === 'male' ? 'پدربزرگ' : 'مادربزرگ';
      return targetGender === 'male' ? `جد (${dist1 - 1} نسل قبل)` : `جده (${dist1 - 1} نسل قبل)`;
    }
    if (dist1 === 0 && dist2 > 0) {
      if (dist2 === 1) return targetGender === 'male' ? 'پسر' : 'دختر';
      if (dist2 === 2) return targetGender === 'male' ? 'نوه (پسر)' : 'نوه (دختر)';
      return targetGender === 'male' ? `نتیجه/نبیره (پسر)` : `نتیجه/نبیره (دختر)`;
    }
    if (dist1 === 1 && dist2 === 1) return targetGender === 'male' ? 'برادر' : 'خواهر';
    if (dist1 === 2 && dist2 === 1) {
      const sourceParent = path1[lcaIndex + 1]; 
      const isFatherSide = sourceParent.gender === 'male';
      if (isFatherSide) return targetGender === 'male' ? 'عمو' : 'عمه';
      else return targetGender === 'male' ? 'دایی' : 'خاله';
    }
    return `نسبت دور (فاصله: ${dist1} بالا، ${dist2} پایین)`;
  };

  const handleHighlightPath = (memberId: string, direction: 'ancestors' | 'descendants' | 'reset') => {
      if (direction === 'reset') { setHighlightedIds(new Set()); return; }
      const idsToHighlight = new Set<string>();
      idsToHighlight.add(memberId);
      if (direction === 'ancestors') {
          const path = getPathToRoot(treeData, memberId);
          if (path) path.forEach(p => idsToHighlight.add(p.id));
      } else if (direction === 'descendants') {
          const collectDescendants = (node: FamilyMember) => {
              idsToHighlight.add(node.id);
              if (node.children) node.children.forEach(collectDescendants);
          };
          const node = findNode(treeData, memberId);
          if (node) collectDescendants(node);
      }
      setHighlightedIds(idsToHighlight);
  };

  const handleNodeClick = useCallback((member: FamilyMember) => {
    setSelectedMember(member);
    setIsPanelOpen(true);
    setAiSuggestions(null); 
  }, []);

  const handleUpdateMember = (updatedMember: FamilyMember) => {
    const newTree = updateNode(treeData, updatedMember);
    setTreeData(newTree);
    setSelectedMember(updatedMember);
  };

  const handleAddChild = (parentId: string) => {
    const newTree = addChildNode(treeData, parentId);
    setTreeData(newTree);
  };

  const handleAddSibling = (siblingId: string) => {
    const newTree = addSiblingNode(treeData, siblingId);
    setTreeData(newTree);
  };

  const handleAddParent = () => addParentToRoot(treeData);
  
  const handleDeleteMember = (id: string) => {
    if (id === treeData.id) { alert("برای حذف ریشه اصلی، لطفا صفحه را رفرش کنید."); return; }
    const newTree = deleteNode(treeData, id);
    if (newTree) { setTreeData(newTree); setSelectedMember(null); }
  };

  const handleAddConnection = (sourceId: string, targetId: string, label: string) => {
    const newTree = addConnectionNode(treeData, sourceId, targetId, label);
    setTreeData(newTree);
    const updatedSource = findNode(newTree, sourceId);
    if (updatedSource) setSelectedMember(updatedSource);
  };

  const handleRemoveConnection = (sourceId: string, targetId: string) => {
    const newTree = removeConnectionNode(treeData, sourceId, targetId);
    setTreeData(newTree);
    const updatedSource = findNode(newTree, sourceId);
    if (updatedSource) setSelectedMember(updatedSource);
  };

  const handleGetSuggestions = async () => {
    setAiSuggestions("در حال تحلیل درخت خانواده...");
    const suggestion = await suggestResearch(JSON.stringify(treeData));
    setAiSuggestions(suggestion);
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return [];
    return allMembers.filter(m => {
        const matchesName = m.name.includes(searchQuery) || (m.tags && m.tags.some(t => t.label.includes(searchQuery)));
        if (!matchesName) return false;
        if (searchFilter === 'male') return m.gender === 'male';
        if (searchFilter === 'female') return m.gender === 'female';
        if (searchFilter === 'living') return !m.deathDate;
        if (searchFilter === 'deceased') return !!m.deathDate;
        return true;
    });
  }, [allMembers, searchQuery, searchFilter]);

  const handleExportJSON = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "nasab_family_tree.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleExportGEDCOM = () => {
      let gedcom = "0 HEAD\n1 CHAR UTF-8\n1 SOUR NASAB_APP\n0 SUBM @SUB1@\n";
      allMembers.forEach(m => {
          gedcom += `0 @I${m.id}@ INDI\n1 NAME ${m.name} //\n1 SEX ${m.gender === 'male' ? 'M' : 'F'}\n`;
          if (m.birthDate) { gedcom += `1 BIRT\n2 DATE ${m.birthDate}\n`; if(m.location) gedcom += `2 PLAC ${m.location}\n`; }
          if (m.deathDate) gedcom += `1 DEAT\n2 DATE ${m.deathDate}\n`;
      });
      gedcom += "0 TRLR";
      const blob = new Blob([gedcom], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "family_tree.ged";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileObj = event.target.files && event.target.files[0];
      if (!fileObj) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if(json.id && json.name) { setTreeData(json); setSelectedMember(null); alert("شجره‌نامه بارگذاری شد."); } 
              else alert("فایل نامعتبر است.");
          } catch (err) { alert("خطا در خواندن فایل."); }
      };
      reader.readAsText(fileObj);
      event.target.value = '';
  };
  
  const toggleFullScreen = () => {
      if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullScreen(true); } 
      else if (document.exitFullscreen) { document.exitFullscreen(); setIsFullScreen(false); }
  };

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : (theme === 'vintage' ? 'glass-panel-vintage' : 'glass-panel');

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
      <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={handleFileChange} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        {!isFullScreen && (
        <header className={`${glassClass} border-b-0 rounded-b-2xl mx-4 mt-2 px-4 py-3 flex justify-between items-center shadow-lg z-20 relative transition-all animate-fade-in-scale`}>
          <div className="flex items-center gap-4 lg:gap-6">
             <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${theme === 'vintage' ? 'bg-[#cb4b16]' : 'bg-gradient-to-br from-teal-500 to-teal-700'}`}>
                    <span className="text-xl">🌳</span> 
                </div>
                <div className="flex flex-col">
                    <h1 className={`text-lg font-bold tracking-tight leading-none ${theme === 'vintage' ? 'font-serif text-[#b58900]' : ''}`}>نسب‌نما</h1>
                    <span className={`text-[10px] tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>خانواده خود را جاودانه کنید</span>
                </div>
             </div>
             
             {/* Search */}
             <div className="relative hidden lg:block group">
                <div className={`flex items-center rounded-xl px-4 py-2 border w-96 transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50 hover:bg-white/60'}`}>
                   <Search size={18} className="text-slate-400 ml-2"/>
                   <input 
                     type="text" 
                     placeholder="نام، برچسب یا مکان..." 
                     className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
                     value={searchQuery}
                     onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                     onFocus={() => setIsSearchOpen(true)}
                   />
                   <button onClick={() => setIsSearchOpen(!isSearchOpen)} className={`mr-2 p-1 rounded hover:bg-black/5 ${searchFilter !== 'all' ? 'text-teal-600' : 'text-slate-400'}`}><Filter size={14} /></button>
                   {searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} className="text-slate-400 hover:text-red-400"/></button>}
                </div>
                
                {isSearchOpen && (searchQuery || searchFilter !== 'all') && (
                   <div className={`absolute top-full right-0 mt-3 w-96 rounded-xl shadow-2xl border overflow-hidden max-h-96 overflow-y-auto animate-in slide-in-from-top-2 z-50 ${theme === 'dark' ? 'glass-panel-dark border-slate-600' : 'glass-panel border-white/40'}`}>
                      <div className={`p-2 border-b flex gap-2 overflow-x-auto no-scrollbar ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200/50'}`}>
                          {['all', 'male', 'female', 'living', 'deceased'].map(filter => (
                             <button key={filter} onClick={() => setSearchFilter(filter as any)} className={`px-3 py-1 text-xs rounded-full border transition-colors ${searchFilter === filter ? 'bg-teal-500 text-white border-teal-600' : 'bg-transparent border-current opacity-60'}`}>{filter}</button>
                          ))}
                      </div>
                      {filteredMembers.length === 0 ? (
                        <div className="p-6 text-sm opacity-50 text-center flex flex-col items-center">
                            <span className="text-2xl mb-2">🔍</span> موردی یافت نشد
                        </div>
                      ) : (
                        filteredMembers.map(m => (
                          <button 
                            key={m.id}
                            onClick={() => { handleNodeClick(m); setIsSearchOpen(false); setSearchQuery(''); }}
                            className={`w-full text-right px-4 py-3 border-b last:border-0 text-sm flex items-center justify-between group transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50 border-slate-700' : 'hover:bg-white/30 border-slate-200/30'}`}
                          >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white shadow-md ${m.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`}>{m.name.charAt(0)}</div>
                                <div className="flex flex-col items-start">
                                    <span className="font-bold">{m.name}</span>
                                    <span className="text-[10px] opacity-60">{m.birthDate || '---'}</span>
                                </div>
                            </div>
                            <span className="text-xs opacity-50 bg-black/5 px-2 py-1 rounded-md">{m.relation || 'عضو'}</span>
                          </button>
                        ))
                      )}
                   </div>
                )}
             </div>
          </div>
          
          <div className="flex gap-3 items-center">
             {validationWarnings.length > 0 && (
                 <div className="group relative">
                     <button className="p-2 bg-amber-100/80 text-amber-600 rounded-lg animate-pulse shadow-sm"><AlertTriangle size={18} /></button>
                     <div className="absolute top-full left-0 mt-2 w-64 glass-panel p-3 rounded-xl shadow-xl text-xs hidden group-hover:block z-50 text-slate-700">
                         {validationWarnings.map((w, i) => <div key={i} className="mb-1 last:mb-0">• {w}</div>)}
                     </div>
                 </div>
             )}

             <div className={`flex p-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
                 {['modern', 'vintage', 'dark'].map((t) => (
                     <button key={t} onClick={() => setTheme(t as AppTheme)} className={`p-2 rounded-md transition-all ${theme === t ? 'bg-white/80 shadow text-teal-600' : 'opacity-50 hover:opacity-100'}`}>
                         {t === 'modern' ? <Palette size={16}/> : (t === 'vintage' ? '📜' : '🌙')}
                     </button>
                 ))}
             </div>

             <div className="h-6 w-px bg-current mx-1 hidden sm:block opacity-20"></div>

             <div className={`flex p-1 rounded-lg border hidden sm:flex ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
                 <button onClick={() => setShowTimeline(true)} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100"><Clock size={18} /></button>
                 <button onClick={() => setShowStats(true)} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100"><BarChart3 size={18} /></button>
                 <button onClick={toggleFullScreen} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100">{isFullScreen ? <Minimize size={18}/> : <Maximize size={18} />}</button>
             </div>

             <div className={`flex p-1 rounded-lg border hidden sm:flex ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
                 <button onClick={handleExportJSON} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100"><Download size={18} /></button>
                 <button onClick={handleExportGEDCOM} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100"><FileText size={18} /></button>
                 <button onClick={handleImportClick} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100"><Upload size={18} /></button>
             </div>

             <button onClick={handleGetSuggestions} className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-bold shadow-sm hover:shadow ${theme === 'vintage' ? 'bg-[#fdf6e3] text-[#b58900] border-[#d3c6aa]' : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'}`}>
               <Sparkles size={16} /> <span className="hidden md:inline">هوش مصنوعی</span>
            </button>
            {!isPanelOpen && (
              <button onClick={() => setIsPanelOpen(true)} className="p-2 glass-panel shadow-sm rounded-lg hover:bg-white/60 md:hidden">
                <Menu size={20} />
              </button>
            )}
          </div>
        </header>
        )}

        {/* Mobile Search */}
        <div className={`lg:hidden px-4 py-2 border-b ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white/50 border-slate-100'}`}>
           <div className={`flex items-center rounded-lg px-3 py-2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white/50'}`}>
               <Search size={16} className="opacity-50 ml-2"/>
               <input type="text" placeholder="جستجو..." className="bg-transparent outline-none text-sm w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
           </div>
        </div>

        {/* Stats Modal */}
        {showStats && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className={`${glassClass} rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden text-slate-800`}>
                    <div className="p-5 border-b border-white/20 flex justify-between items-center bg-white/10">
                        <h3 className={`font-bold text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}><BarChart3 size={20} className="text-teal-500"/> داشبورد آماری</h3>
                        <button onClick={() => setShowStats(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X size={20}/></button>
                    </div>
                    <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-2xl text-center border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/40'}`}>
                            <div className={`text-3xl font-black mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{treeStats.total}</div>
                            <div className="text-xs font-bold opacity-50 uppercase">کل اعضا</div>
                        </div>
                        <div className={`p-4 rounded-2xl text-center border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/40'}`}>
                             <div className="text-3xl font-black text-amber-500 mb-1">{treeStats.maxDepth}</div>
                             <div className="text-xs font-bold opacity-50 uppercase">نسل‌ها</div>
                        </div>
                        <div className={`p-4 rounded-2xl text-center border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/40'}`}>
                             <div className="text-3xl font-black text-purple-500 mb-1">{treeStats.avgLifespan} <span className="text-sm">سال</span></div>
                             <div className="text-xs font-bold opacity-50 uppercase">میانگین عمر</div>
                        </div>
                        <div className="bg-blue-500/10 p-4 rounded-2xl text-center border border-blue-500/20">
                             <div className="text-2xl font-bold text-blue-500">{treeStats.males}</div>
                             <div className="text-xs text-blue-400">مرد</div>
                        </div>
                        <div className="bg-pink-500/10 p-4 rounded-2xl text-center border border-pink-500/20">
                             <div className="text-2xl font-bold text-pink-500">{treeStats.females}</div>
                             <div className="text-xs text-pink-400">زن</div>
                        </div>
                        <div className="bg-green-500/10 p-4 rounded-2xl text-center border border-green-500/20">
                             <div className="text-2xl font-bold text-green-500">{treeStats.living}</div>
                             <div className="text-xs text-green-500">در قید حیات</div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Timeline Modal */}
        {showTimeline && (
             <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className={`${glassClass} rounded-3xl shadow-2xl max-w-2xl w-full h-[80vh] flex flex-col overflow-hidden text-slate-800`}>
                    <div className="p-5 border-b border-white/20 flex justify-between items-center shrink-0 bg-white/10">
                        <h3 className={`font-bold text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}><Clock size={20} className="text-teal-500"/> خط زمان</h3>
                        <button onClick={() => setShowTimeline(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
                        <div className="absolute top-0 bottom-0 right-8 w-0.5 bg-current opacity-10"></div>
                        {timelineEvents.length === 0 ? (
                             <div className="text-center opacity-50 mt-10">هیچ تاریخ تولد یا وفاتی ثبت نشده است.</div>
                        ) : (
                             timelineEvents.map((event, idx) => (
                                <div key={idx} className={`flex items-start mb-8 relative pr-8 group ${event.isHistory ? 'opacity-60 grayscale' : 'cursor-pointer'}`} onClick={() => { if(!event.isHistory && event.member) {handleNodeClick(event.member); setShowTimeline(false);} }}>
                                    <div className={`absolute right-[-5px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-md z-10 ${event.type === 'تولد' ? 'bg-teal-500' : (event.type === 'وفات' ? 'bg-slate-700' : 'bg-amber-500')}`}></div>
                                    <div className={`flex-1 border p-3 rounded-xl shadow-sm transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/60 border-white/50'} ${!event.isHistory && 'group-hover:scale-[1.02] group-hover:shadow-lg'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-black/5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{event.type}</span>
                                            <span className="font-mono text-sm font-bold opacity-50">{event.date}</span>
                                        </div>
                                        <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{event.title}</h4>
                                        {event.member?.location && !event.isHistory && <p className="text-xs opacity-50 mt-1">{event.member.location}</p>}
                                    </div>
                                </div>
                             ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Suggestions Overlay */}
        {aiSuggestions && (
          <div className="absolute top-20 right-6 z-30 glass-panel p-5 rounded-2xl shadow-xl max-w-md animate-in fade-in slide-in-from-top-5">
             <div className="flex justify-between items-start mb-3">
               <h3 className="font-bold text-amber-700 flex items-center gap-2">
                 <Sparkles size={18} className="text-amber-500"/> هوش مصنوعی
               </h3>
               <button onClick={() => setAiSuggestions(null)} className="opacity-50 hover:opacity-100"><X size={16}/></button>
             </div>
             <div className="text-sm leading-relaxed max-h-60 overflow-y-auto bg-white/40 p-3 rounded-lg border border-white/50">
                {aiSuggestions === "در حال تحلیل درخت خانواده..." ? (
                   <div className="flex items-center gap-2 text-amber-600 font-medium"><span className="animate-spin">✨</span> در حال بررسی روابط...</div>
                ) : <pre className="whitespace-pre-wrap font-sans text-xs leading-6">{aiSuggestions}</pre>}
             </div>
          </div>
        )}

        {/* Tree Visualization */}
        <div className="flex-1 p-6 overflow-hidden bg-transparent relative">
            {/* Layout Controls */}
            <div className={`absolute top-6 left-6 z-10 rounded-xl shadow-lg p-1.5 flex gap-1 ${theme === 'dark' ? 'glass-panel-dark' : 'glass-panel'}`}>
                <button onClick={() => setOrientation('horizontal')} className={`p-2.5 rounded-lg transition-all ${orientation === 'horizontal' ? 'bg-teal-600 text-white shadow-md' : 'opacity-50 hover:opacity-100'}`} title="نمای افقی">
                    <div className="w-5 h-4 border-2 border-current rounded-sm border-r-0 relative before:content-[''] before:absolute before:right-[-4px] before:top-0.5 before:w-0.5 before:h-1.5 before:bg-current"></div>
                </button>
                <button onClick={() => setOrientation('vertical')} className={`p-2.5 rounded-lg transition-all ${orientation === 'vertical' ? 'bg-teal-600 text-white shadow-md' : 'opacity-50 hover:opacity-100'}`} title="نمای عمودی">
                   <div className="h-5 w-4 border-2 border-current rounded-sm border-b-0 relative before:content-[''] before:absolute before:bottom-[-4px] before:left-0.5 before:h-0.5 before:w-1.5 before:bg-current"></div>
                </button>
            </div>

          <FamilyTree 
            data={treeData} 
            onNodeClick={handleNodeClick} 
            selectedId={selectedMember?.id}
            orientation={orientation}
            theme={theme}
            highlightedIds={highlightedIds}
            onAddChild={handleAddChild}
            onAddSibling={handleAddSibling}
          />
        </div>
      </div>

      {/* Sidebar Panel */}
      {(!isFullScreen || isPanelOpen) && (
      <div className={`fixed inset-y-0 left-0 w-full md:w-[28rem] shadow-2xl transform transition-transform duration-500 cubic-bezier(0.32, 0.72, 0, 1) z-40 ${isPanelOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 border-r ${theme === 'dark' ? 'glass-panel-dark border-slate-700' : 'glass-panel border-white/40'}`}>
        <div className="absolute top-4 left-4 md:hidden z-50">
           <button onClick={() => setIsPanelOpen(false)} className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg"><X size={20} /></button>
        </div>
        <MemberPanel 
          member={selectedMember} 
          allMembers={allMembers}
          onUpdateMember={handleUpdateMember}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onAddParent={handleAddParent}
          onDeleteMember={handleDeleteMember}
          onAddConnection={handleAddConnection}
          onRemoveConnection={handleRemoveConnection}
          calculateRelationship={calculateRelationship}
          onHighlightPath={handleHighlightPath}
          onAddSpouse={handleAddSpouse}
        />
      </div>
      )}
    </div>
  );
};

export default App;
