
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FamilyMember, AppTheme } from './types';
import FamilyTree from './components/FamilyTree';
import MemberPanel from './components/MemberPanel';
import { Menu, X, Search, Download, Upload, Palette, Maximize, Minimize, Save, CheckCircle2, RefreshCcw, Plus, Moon, ListFilter, Clock, ScanEye, ArrowUpFromLine, ArrowDownToLine, RotateCcw, Keyboard, Command, AlertTriangle, Info, CheckCircle } from 'lucide-react';

// Historical Context Data
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

// Helper to generate unique 6-char code
const generateUniqueCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const defaultFamilyData: FamilyMember = {
  id: 'system_root',
  name: 'ریشه سیستم',
  relation: 'SystemRoot',
  gender: 'male',
  children: [
    {
      id: 'root_1',
      name: 'بزرگ‌خاندان',
      relation: 'Root',
      gender: 'male',
      code: 'A10001',
      birthDate: '1300',
      location: 'تهران',
      children: []
    }
  ]
};

// --- PURE TREE LOGIC FUNCTIONS (Outside Component) ---

const findNode = (node: FamilyMember, id: string): FamilyMember | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
};

const findParent = (root: FamilyMember, targetId: string): FamilyMember | null => {
  if (root.children) {
    for (const child of root.children) {
      if (child.id === targetId) return root;
      const found = findParent(child, targetId);
      if (found) return found;
    }
  }
  return null;
};

// Removes a node AND cleans up any connections pointing to it in the entire tree
const removeNodeAndConnections = (root: FamilyMember, idToDelete: string): FamilyMember | null => {
    // Recursive function to rebuild tree excluding the deleted node
    // and filtering connections in preserved nodes
    const rebuild = (node: FamilyMember): FamilyMember | null => {
        if (node.id === idToDelete) return null;

        let newChildren: FamilyMember[] | undefined = undefined;
        if (node.children) {
            newChildren = node.children
                .map(child => rebuild(child))
                .filter((child): child is FamilyMember => child !== null);
        }

        let newConnections = node.connections;
        if (node.connections) {
            // Remove any connection that points to the deleted ID
            newConnections = node.connections.filter(c => c.targetId !== idToDelete);
        }

        return {
            ...node,
            children: newChildren,
            connections: newConnections
        };
    };

    return rebuild(root);
};

const updateNodeInTree = (node: FamilyMember, updated: FamilyMember): FamilyMember => {
  if (node.id === updated.id) return updated;
  if (node.children) {
    return {
      ...node,
      children: node.children.map(child => updateNodeInTree(child, updated))
    };
  }
  return node;
};

const addChildToNode = (node: FamilyMember, parentId: string, gender: 'male' | 'female' = 'male'): FamilyMember => {
  if (node.id === parentId) {
    const newChild: FamilyMember = {
      id: Date.now().toString(),
      name: gender === 'male' ? 'پسر جدید' : 'دختر جدید',
      gender: gender,
      relation: 'Child',
      code: generateUniqueCode(),
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
      children: node.children.map(child => addChildToNode(child, parentId, gender))
    };
  }
  return node;
};

const addSiblingToNode = (root: FamilyMember, siblingId: string, onError: (msg: string) => void): FamilyMember => {
    if (root.id === siblingId) {
      onError("نمی‌توانید برای ریشه اصلی، هم‌سطح ایجاد کنید.");
      return root;
    }
    const parent = findParent(root, siblingId);
    if (parent) {
       return addChildToNode(root, parent.id, 'male');
    }
    return root;
};

const addConnectionToNode = (node: FamilyMember, sourceId: string, targetId: string, label: string): FamilyMember => {
    if (node.id === sourceId) {
      const existing = node.connections || [];
      if (existing.some(c => c.targetId === targetId)) return node;
      return { ...node, connections: [...existing, { targetId, label }] };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addConnectionToNode(child, sourceId, targetId, label))
      };
    }
    return node;
};

const removeConnectionFromNode = (node: FamilyMember, sourceId: string, targetId: string): FamilyMember => {
    if (node.id === sourceId && node.connections) {
      return {
        ...node,
        connections: node.connections.filter(c => c.targetId !== targetId)
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => removeConnectionFromNode(child, sourceId, targetId))
      };
    }
    return node;
};

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

const flattenTree = (node: FamilyMember): FamilyMember[] => {
    let list = [node];
    if (node.children) {
      node.children.forEach(child => {
        list = [...list, ...flattenTree(child)];
      });
    }
    return list;
};

// --- MAIN COMPONENT ---

// This key acts as the "filename" in the browser's local database
const STORAGE_KEY = 'niyakan_family_tree_db_json';

const App: React.FC = () => {
  const [treeData, setTreeData] = useState<FamilyMember>(defaultFamilyData);
  
  // Selection & Modal State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailsMember, setDetailsMember] = useState<FamilyMember | null>(null);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  
  // Filter State
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({
      startYear: '',
      endYear: '',
      occupation: '',
      tag: ''
  });

  // Focus Menu State
  const [isFocusMenuOpen, setIsFocusMenuOpen] = useState(false);

  // Time-Lapse State
  const [minYear, setMinYear] = useState(1300);
  const [maxYear, setMaxYear] = useState(1405);
  const [currentYear, setCurrentYear] = useState(1405);
  const [isTimeSliderVisible, setIsTimeSliderVisible] = useState(false);

  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [theme, setTheme] = useState<AppTheme>('modern');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme
  useEffect(() => {
      document.body.className = `theme-${theme}`;
  }, [theme]);

  // Auto Load (Simulating loading the JSON DB file on startup)
  useEffect(() => {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
          try {
              const parsed = JSON.parse(savedData);
              if (parsed && (parsed.id || parsed.children)) {
                  setTreeData(parsed);
                  console.log('Database loaded successfully');
              }
          } catch (e) {
              console.error('Failed to load database', e);
          }
      }
  }, []);

  // Real-time Auto Save (Simulating writing to JSON DB file)
  useEffect(() => {
      setSaveStatus('saving');
      // Reduced delay to 500ms for "Real-time" (Bi-derang) feel
      const timer = setTimeout(() => {
          try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(treeData));
              setSaveStatus('saved');
          } catch (e) {
              setSaveStatus('unsaved');
              console.error('Database write failed', e);
          }
      }, 500);

      return () => clearTimeout(timer);
  }, [treeData]);

  const allMembers = useMemo(() => flattenTree(treeData), [treeData]);

  // Update Year Range for Time-Lapse
  useEffect(() => {
      let min = 1400;
      let max = 1300;
      allMembers.forEach(m => {
          if (m.birthDate) {
              const y = parseInt(m.birthDate.split('/')[0]);
              if (!isNaN(y)) {
                  if (y < min) min = y;
                  if (y > max) max = y;
              }
          }
      });
      // Add buffer
      if (min === 1400 && max === 1300) { // No valid dates found
           min = 1300; max = 1405;
      } else {
           min -= 10; max += 5;
      }
      
      setMinYear(min);
      setMaxYear(max);
      if (!isTimeSliderVisible) setCurrentYear(max); // Reset to max if slider not active
  }, [allMembers, isTimeSliderVisible]);


  // Search Logic with Filters
  const filteredMembers = useMemo(() => {
      if (!searchQuery && !filterCriteria.startYear && !filterCriteria.endYear && !filterCriteria.occupation && !filterCriteria.tag) {
          return [];
      }

      return allMembers.filter(m => {
          if (m.relation === 'SystemRoot') return false;

          // 1. Text Search (Name or Code)
          if (searchQuery) {
              const query = searchQuery.toLowerCase();
              const nameMatch = m.name.toLowerCase().includes(query);
              const codeMatch = m.code && m.code.toLowerCase().includes(query);
              if (!nameMatch && !codeMatch) return false;
          }

          // 2. Occupation Filter
          if (filterCriteria.occupation) {
              if (!m.occupation || !m.occupation.includes(filterCriteria.occupation)) return false;
          }

          // 3. Tag Filter
          if (filterCriteria.tag) {
              if (!m.tags || !m.tags.some(t => t.label.includes(filterCriteria.tag))) return false;
          }

          // 4. Date Range Filter
          if (filterCriteria.startYear || filterCriteria.endYear) {
              const birthYear = m.birthDate ? parseInt(m.birthDate.split('/')[0]) : null;
              
              if (!birthYear) return false; // Exclude if no birth year defined

              if (filterCriteria.startYear) {
                  if (birthYear < parseInt(filterCriteria.startYear)) return false;
              }
              if (filterCriteria.endYear) {
                  if (birthYear > parseInt(filterCriteria.endYear)) return false;
              }
          }

          return true;
      });
  }, [allMembers, searchQuery, filterCriteria]);


  // --- HANDLERS ---

  const handleNodeClick = useCallback((member: FamilyMember) => {
    setSelectedNodeId(member.id);
  }, []);

  const handleOpenDetails = useCallback((member: FamilyMember) => {
    setDetailsMember(member);
  }, []);

  const handleUpdateMember = (updatedMember: FamilyMember) => {
    setTreeData(prev => updateNodeInTree(prev, updatedMember));
    setDetailsMember(updatedMember);
    // Alert feedback removed or can be added back if needed
  };

  const handleAddChild = (parentId: string, gender: 'male' | 'female' = 'male') => {
    setTreeData(prev => addChildToNode(prev, parentId, gender));
  };

  const handleAddSibling = (siblingId: string) => {
    setTreeData(prev => addSiblingToNode(prev, siblingId, (msg) => alert(msg)));
  };

  const handleAddParent = () => {
    setTreeData(prev => {
        const newClanRoot: FamilyMember = {
            id: Date.now().toString(),
            name: 'سرشاخه جدید',
            gender: 'male',
            relation: 'Root',
            code: generateUniqueCode(),
            children: []
        };

        if (prev.relation === 'SystemRoot') {
            return {
                ...prev,
                children: [...(prev.children || []), newClanRoot]
            };
        } else {
            return {
                id: 'system_root',
                name: 'System Root',
                relation: 'SystemRoot',
                gender: 'male',
                children: [prev, newClanRoot]
            };
        }
    });
  };
  
  const handleDeleteMember = (id: string) => {
    if (id === treeData.id) { 
        alert("برای حذف ریشه اصلی سیستم، لطفا از دکمه شروع تازه استفاده کنید."); 
        return; 
    }
    
    const newTree = removeNodeAndConnections(treeData, id);
    
    if (newTree) { 
        setTreeData(newTree); 
        // Close modal and clear selection if the deleted member was active
        if (detailsMember?.id === id) setDetailsMember(null);
        if (selectedNodeId === id) setSelectedNodeId(null);
    } else {
        alert("خطا در حذف عضو.");
    }
  };

  const handleAddConnection = (sourceId: string, targetId: string, label: string) => {
    setTreeData(prev => addConnectionToNode(prev, sourceId, targetId, label));
    // Update modal if needed
    const updatedSource = findNode(addConnectionToNode(treeData, sourceId, targetId, label), sourceId);
    if (updatedSource && detailsMember?.id === sourceId) setDetailsMember(updatedSource);
  };

  const handleRemoveConnection = (sourceId: string, targetId: string) => {
    setTreeData(prev => removeConnectionFromNode(prev, sourceId, targetId));
    // Update modal if needed
    const updatedSource = findNode(removeConnectionFromNode(treeData, sourceId, targetId), sourceId);
    if (updatedSource && detailsMember?.id === sourceId) setDetailsMember(updatedSource);
  };

  const handleAddSpouse = (memberId: string, existingSpouseId?: string) => {
      setTreeData(prev => {
          let newTree = prev;
          if (existingSpouseId) {
              newTree = addConnectionToNode(newTree, memberId, existingSpouseId, 'همسر');
              newTree = addConnectionToNode(newTree, existingSpouseId, memberId, 'همسر');
          } else {
              const member = findNode(newTree, memberId);
              const spouseGender = member?.gender === 'male' ? 'female' : 'male';
              const spouseName = member?.gender === 'male' ? 'همسر (خانم)' : 'همسر (آقا)';
              
              const newSpouse: FamilyMember = {
                  id: Date.now().toString(),
                  name: spouseName,
                  gender: spouseGender,
                  relation: 'Spouse',
                  code: generateUniqueCode(),
                  children: [] 
              };

              // Attach new spouse to system root to make it a "Forest" node
              if (newTree.relation === 'SystemRoot') {
                   newTree = {
                       ...newTree,
                       children: [...(newTree.children || []), newSpouse]
                   };
              } else {
                  // Wrap single root into system root if not already
                  newTree = {
                      id: 'system_root_auto',
                      relation: 'SystemRoot',
                      name: 'System',
                      gender: 'male',
                      children: [newTree, newSpouse]
                  };
              }
              newTree = addConnectionToNode(newTree, memberId, newSpouse.id, 'همسر');
              newTree = addConnectionToNode(newTree, newSpouse.id, memberId, 'همسر');
          }
          return newTree;
      });
  };

  const calculateRelationship = (id1: string, id2: string): string => {
    if (id1 === id2) return "خود شخص";
    const member1 = findNode(treeData, id1);
    const member2 = findNode(treeData, id2);
    if (!member1 || !member2) return "فرد یافت نشد";

    if (member1.connections?.some(c => c.targetId === id2 && c.label.includes('همسر'))) return "همسر";
    if (member2.connections?.some(c => c.targetId === id1 && c.label.includes('همسر'))) return "همسر";

    const path1 = getPathToRoot(treeData, id1);
    const path2 = getPathToRoot(treeData, id2);

    if (!path1 || !path2 || path1[0].id !== path2[0].id) {
        return "ارتباط خونی مستقیم یافت نشد";
    }

    let lcaIndex = 0;
    while (
        lcaIndex < path1.length && 
        lcaIndex < path2.length && 
        path1[lcaIndex].id === path2[lcaIndex].id
    ) {
        lcaIndex++;
    }
    lcaIndex--; 
    
    const d1 = path1.length - 1 - lcaIndex;
    const d2 = path2.length - 1 - lcaIndex;
    const gender2 = member2.gender;

    if (d1 === 0) {
        if (d2 === 1) return gender2 === 'male' ? "فرزند (پسر)" : "فرزند (دختر)";
        if (d2 === 2) return gender2 === 'male' ? "نوه (پسر)" : "نوه (دختر)";
        return `نواده (${d2} نسل بعد)`;
    }
    if (d2 === 0) {
        if (d1 === 1) return gender2 === 'male' ? "پدر" : "مادر";
        if (d1 === 2) return gender2 === 'male' ? "پدربزرگ" : "مادربزرگ";
        return `جد (${d1} نسل قبل)`;
    }

    if (d1 === 1 && d2 === 1) return gender2 === 'male' ? "برادر" : "خواهر";

    if (d1 === 1 && d2 === 2) {
        const m2Parent = path2[path2.length - 2];
        const relationType = m2Parent.gender === 'male' ? "برادر" : "خواهر";
        return gender2 === 'male' ? `پسر ${relationType}` : `دختر ${relationType}`;
    }
    if (d1 === 2 && d2 === 1) {
        const m1Parent = path1[path1.length - 2];
        if (m1Parent.gender === 'male') return gender2 === 'male' ? "عمو" : "عمه";
        return gender2 === 'male' ? "دایی" : "خاله";
    }

    if (d1 === 2 && d2 === 2) {
        const m1Parent = path1[path1.length - 2];
        const m2Parent = path2[path2.length - 2];
        if (m1Parent.gender === 'male') {
            if (m2Parent.gender === 'male') return gender2 === 'male' ? "پسرعمو" : "دخترعمو";
            else return gender2 === 'male' ? "پسرعمه" : "دخترعمه";
        } else {
            if (m2Parent.gender === 'male') return gender2 === 'male' ? "پسردایی" : "دختردایی";
            else return gender2 === 'male' ? "پسرخاله" : "دخترخاله";
        }
    }

    return `ارتباط فامیلی دور (فاصله ${d1} - ${d2})`;
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

  const handleExportJSON = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "niyakan_family_tree.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportClick = () => fileInputRef.current?.click();
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileObj = event.target.files && event.target.files[0];
      if (!fileObj) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if(json.id && json.name) { 
                  setTreeData(json); 
                  setDetailsMember(null); 
                  setSelectedNodeId(null); 
                  alert("شجره‌نامه با موفقیت بارگذاری شد"); 
              } 
              else alert("ساختار فایل نامعتبر است");
          } catch (err) { alert("خطا در خواندن فایل"); }
      };
      reader.readAsText(fileObj);
      event.target.value = '';
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Global Shortcuts
      
      // Ctrl+S: Save (Visual Feedback)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSaveStatus('saving');
        setTimeout(() => setSaveStatus('saved'), 500);
        return;
      }

      // Ctrl+F: Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="جستجو..."]') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            setIsSearchOpen(true);
        }
        return;
      }

      // Escape: Close Modals/Menus/Selection
      if (e.key === 'Escape') {
         if (detailsMember) { setDetailsMember(null); return; }
         if (isShortcutsOpen) { setIsShortcutsOpen(false); return; }
         if (isSearchOpen) { setIsSearchOpen(false); return; }
         if (isFilterPanelOpen) { setIsFilterPanelOpen(false); return; }
         if (isFocusMenuOpen) { setIsFocusMenuOpen(false); return; }
         if (selectedNodeId) { setSelectedNodeId(null); return; }
      }

      // Shortcuts Help (?)
      if (e.key === '?' && e.shiftKey) {
          setIsShortcutsOpen(prev => !prev);
          return;
      }

      // 2. Context Sensitive (Ignore if typing in input)
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (selectedNodeId && !detailsMember) {
          switch(e.key.toLowerCase()) {
              case 'c': // Child (Default Male)
                  handleAddChild(selectedNodeId, 'male');
                  break;
              case 'v': // Daughter (Female Child)
                  handleAddChild(selectedNodeId, 'female');
                  break;
              case 's': // Sibling
                  handleAddSibling(selectedNodeId);
                  break;
              case 'm': // Marriage
                  handleAddSpouse(selectedNodeId);
                  break;
              case 'p': // Parent (Triggers Add Parent/Root)
                   handleAddParent();
                   break;
              case 'delete': // Delete
              case 'backspace':
                  handleDeleteMember(selectedNodeId);
                  break;
              case 'enter': // View
                  const member = findNode(treeData, selectedNodeId);
                  if (member) handleOpenDetails(member);
                  break;
              case ' ': // Space for Fit/Focus
                  e.preventDefault(); 
                  // handled in FamilyTree component
                  break;
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, detailsMember, isShortcutsOpen, isSearchOpen, isFilterPanelOpen, isFocusMenuOpen, treeData]);


  const glassClass = theme === 'dark' ? 'glass-panel-dark' : 'glass-panel';

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-500 relative ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
      <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={handleFileChange} />

      {/* Header */}
      {!isFullScreen && (
      <header className={`absolute top-0 left-0 right-0 ${glassClass} border-b-0 rounded-b-2xl mx-4 mt-2 px-4 py-3 flex justify-between items-center shadow-lg z-20 transition-all animate-slide-down`}>
        <div className="flex items-center gap-4 lg:gap-6">
           <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-teal-500 to-teal-700`}>
                  <span className="text-xl">🌳</span> 
              </div>
              <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight leading-none">نیاکان</h1>
                  <div className="flex items-center gap-1 text-[10px] tracking-wider opacity-70">
                      {saveStatus === 'saving' && <><RefreshCcw size={10} className="animate-spin text-amber-500"/> ذخیره بی‌درنگ...</>}
                      {saveStatus === 'saved' && <><CheckCircle2 size={10} className="text-teal-500"/> بانک اطلاعاتی بروز</>}
                      {saveStatus === 'unsaved' && <span className="text-red-500">خطا در ذخیره</span>}
                  </div>
              </div>
           </div>
           
           <button onClick={handleAddParent} className="hidden md:flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
               <Plus size={14} /> ایجاد خاندان جدید
           </button>
           
           {/* Search & Filters */}
           <div className="relative hidden lg:block group">
              <div className="flex items-center gap-2">
                  <div className={`flex items-center rounded-xl px-4 py-2 border w-64 focus-within:w-80 transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50 hover:bg-white/60'}`}>
                     <Search size={18} className="text-slate-400 ml-2"/>
                     <input 
                       type="text" 
                       placeholder="جستجو..." 
                       className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
                       value={searchQuery}
                       onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                       onFocus={() => setIsSearchOpen(true)}
                     />
                  </div>
                  
                  {/* Filter Toggle Button */}
                  <button 
                    onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                    className={`p-2 rounded-xl border transition-all ${isFilterPanelOpen || (filterCriteria.startYear || filterCriteria.endYear || filterCriteria.occupation || filterCriteria.tag) ? 'bg-teal-500 text-white border-teal-500' : (theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white/40 border-white/50 text-slate-500 hover:text-slate-800')}`}
                    title="فیلترهای پیشرفته"
                  >
                      <ListFilter size={20} />
                  </button>

                  {/* Focus Button */}
                  <button 
                    onClick={() => { if(selectedNodeId) setIsFocusMenuOpen(!isFocusMenuOpen); }}
                    disabled={!selectedNodeId}
                    className={`p-2 rounded-xl border transition-all ${isFocusMenuOpen || highlightedIds.size > 0 ? 'bg-teal-500 text-white border-teal-500' : (theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white/40 border-white/50 text-slate-500 hover:text-slate-800')} ${!selectedNodeId ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title={selectedNodeId ? "تمرکز و مسیریابی (نیازمند انتخاب عضو)" : "برای استفاده از تمرکز، یک عضو را انتخاب کنید"}
                  >
                      <ScanEye size={20} />
                  </button>
              </div>

              {/* Advanced Filter Panel */}
              {isFilterPanelOpen && (
                  <div className={`absolute top-full right-0 mt-2 w-72 rounded-xl shadow-xl z-50 p-4 space-y-3 animate-slide-up ${theme === 'dark' ? 'glass-panel-dark border-slate-700' : 'glass-panel border-white/50'}`}>
                      <h4 className="text-xs font-bold opacity-70 mb-2">فیلترهای پیشرفته</h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                          <input 
                            placeholder="از سال (مثلاً 1350)" 
                            className={`w-full p-2 text-xs rounded-lg border outline-none ${theme === 'dark' ? 'bg-slate-900/50 border-slate-600' : 'bg-white/50 border-slate-200'}`}
                            value={filterCriteria.startYear}
                            onChange={(e) => setFilterCriteria({...filterCriteria, startYear: e.target.value})}
                          />
                          <input 
                            placeholder="تا سال" 
                            className={`w-full p-2 text-xs rounded-lg border outline-none ${theme === 'dark' ? 'bg-slate-900/50 border-slate-600' : 'bg-white/50 border-slate-200'}`}
                            value={filterCriteria.endYear}
                            onChange={(e) => setFilterCriteria({...filterCriteria, endYear: e.target.value})}
                          />
                      </div>

                      <input 
                        placeholder="شغل / حرفه" 
                        className={`w-full p-2 text-xs rounded-lg border outline-none ${theme === 'dark' ? 'bg-slate-900/50 border-slate-600' : 'bg-white/50 border-slate-200'}`}
                        value={filterCriteria.occupation}
                        onChange={(e) => setFilterCriteria({...filterCriteria, occupation: e.target.value})}
                      />

                      <input 
                        placeholder="برچسب (Tag)" 
                        className={`w-full p-2 text-xs rounded-lg border outline-none ${theme === 'dark' ? 'bg-slate-900/50 border-slate-600' : 'bg-white/50 border-slate-200'}`}
                        value={filterCriteria.tag}
                        onChange={(e) => setFilterCriteria({...filterCriteria, tag: e.target.value})}
                      />
                      
                      <button 
                        onClick={() => setFilterCriteria({startYear: '', endYear: '', occupation: '', tag: ''})}
                        className="w-full text-xs text-red-400 hover:text-red-500 mt-2 text-center"
                      >
                          پاک کردن فیلترها
                      </button>
                  </div>
              )}

              {/* Focus Menu Panel */}
              {isFocusMenuOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-64 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-slide-up ${theme === 'dark' ? 'glass-panel-dark border-slate-700' : 'glass-panel border-white/50'}`}>
                      <h4 className="text-xs font-bold opacity-70 mb-2 px-2 pt-2">تمرکز و مسیریابی</h4>
                      
                      <button 
                        onClick={() => selectedNodeId && handleHighlightPath(selectedNodeId, 'ancestors')}
                        disabled={!selectedNodeId}
                        className={`w-full text-right px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm transition-colors ${!selectedNodeId ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5')}`}
                      >
                          <ArrowUpFromLine size={16} className="text-teal-500"/>
                          <span>نمایش اجداد و نیاکان</span>
                      </button>

                      <button 
                        onClick={() => selectedNodeId && handleHighlightPath(selectedNodeId, 'descendants')}
                        disabled={!selectedNodeId}
                        className={`w-full text-right px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm transition-colors ${!selectedNodeId ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5')}`}
                      >
                          <ArrowDownToLine size={16} className="text-blue-500"/>
                          <span>نمایش نوادگان و فرزندان</span>
                      </button>

                      <div className={`h-px my-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                      <button 
                        onClick={() => handleHighlightPath('', 'reset')}
                        className={`w-full text-right px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-black/5 text-slate-600'}`}
                      >
                          <RotateCcw size={16}/>
                          <span>بازنشانی (حالت عادی)</span>
                      </button>
                  </div>
              )}

              {/* Search Results Dropdown */}
              {(isSearchOpen && (searchQuery || filteredMembers.length > 0)) && (
                  <div className={`absolute top-full left-0 w-80 mt-2 rounded-xl shadow-xl overflow-hidden z-40 max-h-64 overflow-y-auto custom-scrollbar animate-slide-up ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100'}`}>
                      {filteredMembers.length > 0 ? (
                          filteredMembers.slice(0, 10).map(result => (
                              <button 
                                key={result.id} 
                                className={`w-full text-right px-4 py-2.5 text-sm flex justify-between items-center border-b border-dashed border-slate-100 last:border-0 ${theme === 'dark' ? 'hover:bg-white/5 text-slate-300 border-slate-700' : 'text-slate-700 hover:bg-teal-50'}`}
                                onClick={() => {
                                    setSelectedNodeId(result.id);
                                    setIsSearchOpen(false);
                                    setSearchQuery('');
                                }}
                              >
                                  <div className="flex flex-col">
                                      <span className="font-bold">{result.name}</span>
                                      <div className="flex gap-2 text-[10px] opacity-60">
                                          <span>{result.birthDate || '؟'}</span>
                                          {result.occupation && <span>• {result.occupation}</span>}
                                      </div>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 opacity-70">{result.relation}</span>
                              </button>
                          ))
                      ) : (
                          <div className="p-4 text-center text-sm opacity-50">موردی یافت نشد.</div>
                      )}
                  </div>
              )}
           </div>
        </div>
        
        <div className="flex gap-3 items-center">
           
           {/* Keyboard Shortcuts Toggle */}
           <button 
             onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
             className={`p-2 rounded-lg border transition-all ${isShortcutsOpen ? 'bg-teal-500 text-white border-teal-500' : (theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:text-white' : 'bg-white/40 border-white/50 hover:bg-white/60')}`}
             title="میانبرهای صفحه کلید (?)"
           >
               <Keyboard size={18} />
           </button>

           {/* Time-Lapse Toggle */}
           <button 
             onClick={() => setIsTimeSliderVisible(!isTimeSliderVisible)}
             className={`p-2 rounded-lg border transition-all ${isTimeSliderVisible ? 'bg-amber-100 border-amber-300 text-amber-700' : (theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:text-white' : 'bg-white/40 border-white/50 hover:bg-white/60')}`}
             title="مرور زمان"
           >
               <Clock size={18} />
           </button>

           {/* Theme Toggles */}
           <div className={`flex p-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
               {['modern', 'dark'].map((t) => (
                   <button key={t} onClick={() => setTheme(t as AppTheme)} className={`p-2 rounded-md transition-all ${theme === t ? 'bg-white/80 shadow text-teal-600' : 'opacity-50 hover:opacity-100'}`}>
                       {t === 'modern' ? <Palette size={16}/> : <Moon size={16}/>}
                   </button>
               ))}
           </div>

           <div className="h-6 w-px bg-current mx-1 hidden sm:block opacity-20"></div>

           {/* File Controls */}
           <div className={`flex p-1 rounded-lg border hidden sm:flex ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
               <button onClick={handleExportJSON} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100 text-blue-600" title="دانلود فایل JSON"><Download size={18} /></button>
               <button onClick={handleImportClick} className="p-2 rounded-md transition-all hover:bg-white/50 hover:shadow-sm opacity-70 hover:opacity-100 text-teal-600" title="بارگذاری فایل JSON"><Upload size={18} /></button>
           </div>
        </div>
      </header>
      )}

      {/* Main Content (Full Screen Tree) */}
      <div className="w-full h-full bg-transparent">
        <FamilyTree 
          data={treeData} 
          onNodeClick={handleNodeClick}
          onOpenDetails={handleOpenDetails}
          selectedId={selectedNodeId}
          orientation={orientation}
          onOrientationChange={setOrientation}
          theme={theme}
          highlightedIds={highlightedIds}
          onAddChild={(id) => handleAddChild(id, 'male')} // Default handler for UI click
          onAddSibling={handleAddSibling}
          onAddSpouse={handleAddSpouse}
          onDeleteMember={handleDeleteMember}
          currentYear={isTimeSliderVisible ? currentYear : undefined}
        />
      </div>

      {/* Time-Lapse Slider Panel */}
      {isTimeSliderVisible && (
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 p-4 rounded-2xl shadow-2xl backdrop-blur-lg border animate-slide-up ${theme === 'dark' ? 'bg-slate-900/80 border-slate-700 text-slate-200' : 'bg-white/80 border-white/50 text-slate-800'}`}>
              <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold opacity-60">اسلایدر مرور زمان</span>
                  <span className="text-lg font-mono font-bold text-amber-500">{currentYear}</span>
              </div>
              <input 
                type="range" 
                min={minYear} 
                max={maxYear} 
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] opacity-40 mt-1 font-mono">
                  <span>{minYear}</span>
                  <span>{maxYear}</span>
              </div>
          </div>
      )}

      {/* Shortcuts Help Modal */}
      {isShortcutsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop-in" onClick={() => setIsShortcutsOpen(false)}>
              <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}`} onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4 border-b pb-2 opacity-70">
                      <h3 className="text-lg font-bold flex items-center gap-2"><Keyboard size={20}/> میانبرهای صفحه کلید</h3>
                      <button onClick={() => setIsShortcutsOpen(false)}><X size={20}/></button>
                  </div>
                  <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>ذخیره تغییرات</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">Ctrl + S</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>جستجو</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">Ctrl + F</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>وسط چین / تمرکز</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">Space</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>بستن پنجره / لغو انتخاب</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">Esc</kbd>
                      </div>
                      <div className="h-px bg-current opacity-10 my-2"></div>
                      <p className="text-xs opacity-50 px-2">وقتی عضوی انتخاب شده باشد:</p>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>افزودن فرزند (پسر)</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">C</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>افزودن فرزند (دختر)</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">V</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>افزودن هم‌سطح (برادر/خواهر)</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">S</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>ثبت همسر / ازدواج</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">M</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>افزودن والد (سرشاخه جدید)</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">P</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5">
                          <span>مشاهده پروفایل</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">Enter</kbd>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-black/5 text-red-500">
                          <span>حذف عضو</span>
                          <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">Delete</kbd>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal / Popup for Member Details */}
      {detailsMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-pop-in" onClick={() => setDetailsMember(null)}>
            <div 
              className={`w-full max-w-4xl h-[85vh] shadow-2xl rounded-2xl overflow-hidden transform transition-all relative ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
              onClick={(e) => e.stopPropagation()}
            >
                <MemberPanel 
                  member={detailsMember} 
                  allMembers={allMembers}
                  onUpdateMember={handleUpdateMember}
                  onAddChild={(pid) => handleAddChild(pid, 'male')}
                  onAddSibling={handleAddSibling}
                  onAddParent={handleAddParent}
                  onDeleteMember={handleDeleteMember}
                  onAddConnection={handleAddConnection}
                  onRemoveConnection={handleRemoveConnection}
                  calculateRelationship={calculateRelationship}
                  onAddSpouse={handleAddSpouse}
                  onClose={() => setDetailsMember(null)}
                />
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
