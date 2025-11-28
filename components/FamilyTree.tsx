
import React, { useEffect, useRef, useState } from 'react';
import { 
  select, 
  zoom as d3Zoom, 
  zoomIdentity, 
  tree as d3Tree, 
  hierarchy,
  schemeCategory10
} from 'd3';
import { FamilyMember, AppTheme, TreeSettings } from '../types';
import { Maximize, ZoomIn, ZoomOut, ArrowDown, ArrowRight, Heart, User, Plus, Trash2, GitBranch, GitMerge, XCircle } from 'lucide-react';

// Define loose types for d3 structures to avoid compilation errors if @types/d3 is missing or incompatible
type HierarchyPointNode<T> = any;
type ZoomBehavior<Element, Datum> = any;

// SVG Paths for Gender Icons (Material Design Style)
const MALE_ICON = "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z";
const FEMALE_ICON = "M12,4A4,4 0 0,1 16,8C16,9.95 14.6,11.58 12.75,11.93L12.75,12.09C12.75,12.09 16,13.67 16,18V20H8V18C8,13.9 11.25,12.09 11.25,12.09L11.25,11.93C9.4,11.58 8,9.95 8,8A4,4 0 0,1 12,4Z";

// Branch Colors Palette (Teal, Amber, Rose, Indigo, Cyan, Violet)
const BRANCH_COLORS = ['#0d9488', '#d97706', '#e11d48', '#4f46e5', '#0891b2', '#7c3aed'];

interface FamilyTreeProps {
  data: FamilyMember;
  onNodeClick: (member: FamilyMember) => void;
  onOpenDetails: (member: FamilyMember) => void;
  selectedId?: string | null;
  orientation: 'horizontal' | 'vertical';
  onOrientationChange: (orientation: 'horizontal' | 'vertical') => void;
  theme: AppTheme;
  highlightedIds: Set<string>;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (memberId: string) => void;
  onAddSpouse?: (memberId: string) => void;
  onDeleteMember?: (id: string) => void;
  currentYear?: number;
  treeSettings?: TreeSettings;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ 
  data, 
  onNodeClick, 
  onOpenDetails,
  selectedId, 
  orientation,
  onOrientationChange,
  theme,
  highlightedIds,
  onAddChild,
  onAddSibling,
  onAddSpouse,
  onDeleteMember,
  currentYear,
  treeSettings
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomTransform, setZoomTransform] = useState(zoomIdentity.translate(120, 80));
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  // Link styles: 'curved' (Bezier), 'step' (Orthogonal), 'straight' (Direct)
  const [linkStyle, setLinkStyle] = useState<'curved' | 'step' | 'straight'>('curved');
  const [preventOverlap, setPreventOverlap] = useState(false);
  const [selectedNodePos, setSelectedNodePos] = useState<{x: number, y: number} | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, member: FamilyMember} | null>(null);
  
  const nodeMapRef = useRef<Map<string, HierarchyPointNode<FamilyMember>>>(new Map());

  // Helper to extract year from date string
  const getBirthYear = (dateStr?: string): number => {
      if (!dateStr) return -1;
      const part = dateStr.split('/')[0];
      const year = parseInt(part);
      return isNaN(year) ? -1 : year;
  };

  const calculateAge = (birthDate?: string, deathDate?: string): string => {
      if (!birthDate) return '';
      const bYear = getBirthYear(birthDate);
      if (bYear === -1) return '';

      // If dead
      if (deathDate) {
          const dYear = getBirthYear(deathDate);
          if (dYear !== -1) return `(${dYear - bYear} سال)`;
          return '(فوت شده)';
      }

      // If alive, use current system year (approximate Persian year logic)
      const now = new Date();
      // Simple approx: Gregorian Year - 621 = Shamsi Year
      const currentShamsiYear = currentYear || (now.getFullYear() - 621);
      
      const age = currentShamsiYear - bYear;
      if (age < 0) return '';
      return `(${age} ساله)`;
  };

  // Helper to check visibility based on time-lapse
  const isVisibleInTime = (d: FamilyMember) => {
      if (!currentYear) return true;
      const year = getBirthYear(d.birthDate);
      if (year === -1) return true; 
      return year <= currentYear;
  };

  const getThemeColors = (theme: AppTheme) => {
    switch (theme) {
      case 'dark':
        return {
          link: '#475569',
          linkExtra: '#f59e0b',
          linkSpouse: '#ec4899',
          nodeFill: '#1e293b', 
          maleIcon: '#60a5fa',
          femaleIcon: '#f472b6',
          text: '#f1f5f9',
          textSecondary: '#94a3b8',
          nodeStroke: '#334155',
          selectedRing: '#2dd4bf'
        };
      case 'modern':
      default:
        return {
          link: '#94a3b8',
          linkExtra: '#f59e0b',
          linkSpouse: '#db2777',
          nodeFill: '#f8fafc', 
          maleIcon: '#3b82f6',
          femaleIcon: '#db2777',
          text: '#1e293b',
          textSecondary: '#64748b',
          nodeStroke: '#e2e8f0',
          selectedRing: '#0f766e'
        };
    }
  };

  // Enhanced organizeData to handle spouse placement
  const organizeData = (inputData: FamilyMember) => {
    // Deep clone to safely manipulate for visualization
    const clonedData = JSON.parse(JSON.stringify(inputData));
    
    // We only perform logic if there is a structure to traverse
    if (!clonedData.children) return clonedData;

    // 1. Map all nodes to find partners deep in the tree
    const idMap = new Map<string, any>();
    const parentMap = new Map<string, any>();

    const traverse = (node: any, parent: any) => {
        idMap.set(node.id, node);
        if (parent) parentMap.set(node.id, parent);
        if (node.children) {
            node.children.forEach((c: any) => traverse(c, node));
        }
    };
    traverse(clonedData, null);

    // 2. Identify "Floating Spouses" in SystemRoot and move them next to their deep-tree partners
    if (clonedData.relation === 'SystemRoot') {
        const rootChildren = [...(clonedData.children || [])];
        const nodesToRemoveFromRoot = new Set<string>();

        rootChildren.forEach((rootChild: any) => {
            const spouseConn = rootChild.connections?.find((c: any) => c.label === 'همسر');
            if (spouseConn) {
                const partnerId = spouseConn.targetId;
                const partner = idMap.get(partnerId);
                const partnerParent = parentMap.get(partnerId);

                if (partner && partnerParent && partnerParent.id !== clonedData.id) {
                    if (!partnerParent.children) partnerParent.children = [];
                    const idx = partnerParent.children.findIndex((c: any) => c.id === partnerId);
                    if (idx !== -1) {
                        partnerParent.children.splice(idx + 1, 0, rootChild);
                    } else {
                        partnerParent.children.push(rootChild);
                    }
                    rootChild._isMoved = true;
                    nodesToRemoveFromRoot.add(rootChild.id);
                }
            }
        });
        clonedData.children = clonedData.children.filter((c: any) => !nodesToRemoveFromRoot.has(c.id));
    }

    // 3. Recursive Sort to ensure spouses are always adjacent
    const recursiveSort = (node: any) => {
        if (node.children && node.children.length > 0) {
            const sorted: any[] = [];
            const visited = new Set<string>();
            const childMap = new Map(node.children.map((c: any) => [c.id, c]));

            node.children.forEach((child: any) => {
                if (visited.has(child.id)) return;
                sorted.push(child);
                visited.add(child.id);

                if (child.connections) {
                    child.connections.forEach((conn: any) => {
                        if (conn.label === 'همسر' && childMap.has(conn.targetId) && !visited.has(conn.targetId)) {
                            sorted.push(childMap.get(conn.targetId));
                            visited.add(conn.targetId);
                        }
                    });
                }
            });
            node.children = sorted;
            node.children.forEach(recursiveSort);
        }
    };

    recursiveSort(clonedData);
    return clonedData;
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Keyboard shortcut for Space (Fit)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              const activeTag = document.activeElement?.tagName;
              if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
              e.preventDefault();
              handleFit();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomTransform]);

  useEffect(() => {
      if (selectedId && nodeMapRef.current.has(selectedId) && !contextMenu) {
        const sNode = nodeMapRef.current.get(selectedId);
        if (sNode) {
            const t = zoomTransform;
            const x = orientation === 'horizontal' ? sNode.y : sNode.x;
            const y = orientation === 'horizontal' ? sNode.x : sNode.y;
            const finalX = t.x + x * t.k; 
            const finalY = t.y + y * t.k;
            setSelectedNodePos({ x: finalX, y: finalY });
        }
      } else {
        setSelectedNodePos(null);
      }
  }, [selectedId, zoomTransform, orientation, dimensions, contextMenu]);

  // Main Graph Drawing
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const colors = getThemeColors(theme);
    const hasHighlight = highlightedIds.size > 0;
    const isCompact = treeSettings?.isCompact || false;
    const isClassicFont = treeSettings?.fontStyle === 'classic';
    const fontFamily = isClassicFont ? '"Noto Naskh Arabic", serif' : '"Vazirmatn", sans-serif';

    select(svgRef.current).selectAll("*").remove();

    const organizedData = organizeData(data);

    const svg = select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .on("click", () => {
          setContextMenu(null);
          if (selectedId) onNodeClick({} as any);
      });

    const g = svg.append("g")
      .attr("transform", zoomTransform.toString());

    const zoom = d3Zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          if (event.transform.k === zoomTransform.k && 
              event.transform.x === zoomTransform.x && 
              event.transform.y === zoomTransform.y) return;
          g.attr("transform", event.transform);
          setZoomTransform(event.transform);
          setContextMenu(null);
        });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Node Sizes for Compact vs Normal Mode
    const nodeWidth = isCompact ? 50 : 90;
    const nodeHeight = isCompact ? 120 : 240;
    const verticalNodeSize: [number, number] = isCompact ? [80, 80] : [160, 160];

    let treemap;
    if (orientation === 'horizontal') {
        treemap = d3Tree<FamilyMember>()
            .nodeSize([nodeWidth, nodeHeight]) 
            .separation((a: any, b: any) => {
                const isSpouse = a.data.connections?.some((c: any) => c.targetId === b.data.id && c.label === 'همسر') ||
                                 b.data.connections?.some((c: any) => c.targetId === a.data.id && c.label === 'همسر');
                return isSpouse ? 0.65 : (a.parent === b.parent ? 1.1 : 2.2);
            });
    } else {
        treemap = d3Tree<FamilyMember>()
            .nodeSize(verticalNodeSize)
            .separation((a: any, b: any) => {
                const isSpouse = a.data.connections?.some((c: any) => c.targetId === b.data.id && c.label === 'همسر') ||
                                 b.data.connections?.some((c: any) => c.targetId === a.data.id && c.label === 'همسر');
                return isSpouse ? 0.65 : (a.parent === b.parent ? 1.1 : 2.2);
            });
    }

    const root = hierarchy(organizedData, (d) => d.children);
    // @ts-ignore
    const nodes = treemap(root);

    nodeMapRef.current.clear();
    
    // Assign Branch Colors & Generation Info
    nodes.descendants().forEach((d: any) => {
        // Depth Calculation for Generation Labels
        // d.depth is already available

        // Branch Coloring Logic
        if (treeSettings?.colorMode === 'branch') {
            if (d.depth === 0) {
                d._branchColor = colors.nodeStroke;
            } else if (d.depth === 1) {
                // Assign color based on index among siblings
                // We use the index in parent's children array
                const index = d.parent.children.indexOf(d);
                d._branchColor = BRANCH_COLORS[index % BRANCH_COLORS.length];
                d._branchIndex = index;
            } else {
                // Inherit from parent
                d._branchColor = d.parent._branchColor;
                d._branchIndex = d.parent._branchIndex;
            }
        }

        nodeMapRef.current.set(d.data.id, d);
    });

    // --- Generation Labels (Background Layer) ---
    if (treeSettings?.showGenerationLabels) {
        const depths = new Set(nodes.descendants().map((d: any) => d.depth));
        const depthArray = Array.from(depths).sort((a: any, b: any) => a - b);
        
        const labelsG = g.append("g").attr("class", "generation-labels");
        
        depthArray.forEach((depth: any) => {
            // Ignore SystemRoot (depth 0) for labels. 
            // We want "Root" (depth 1) to be Generation 1.
            if (depth === 0) return;

            const nodesAtDepth = nodes.descendants().filter((d: any) => d.depth === depth);
            if (nodesAtDepth.length === 0) return;

            // Find average position
            let avgPos = 0;
            if (orientation === 'horizontal') {
                avgPos = nodesAtDepth[0].y; // Y in D3 tree is X on screen for horizontal
                
                labelsG.append("text")
                    .attr("x", avgPos)
                    .attr("y", -dimensions.height / 2 + 50) // Top of screen roughly
                    .attr("text-anchor", "middle")
                    .text(`نسل ${depth}`) // Display depth directly (e.g. depth 1 is Gen 1)
                    .style("font-family", fontFamily)
                    .style("font-size", "24px")
                    .style("font-weight", "bold")
                    .style("opacity", 0.1)
                    .style("fill", colors.text);
                    
                // Draw vertical line background
                labelsG.append("line")
                    .attr("x1", avgPos)
                    .attr("y1", -5000)
                    .attr("x2", avgPos)
                    .attr("y2", 5000)
                    .style("stroke", colors.text)
                    .style("stroke-width", 1)
                    .style("stroke-dasharray", "10,10")
                    .style("opacity", 0.05);

            } else {
                avgPos = nodesAtDepth[0].y; // Y is Y on screen
                
                labelsG.append("text")
                    .attr("x", -dimensions.width / 2 + 50)
                    .attr("y", avgPos)
                    .attr("text-anchor", "start")
                    .attr("alignment-baseline", "middle")
                    .text(`نسل ${depth}`) // Display depth directly
                    .style("font-family", fontFamily)
                    .style("font-size", "24px")
                    .style("font-weight", "bold")
                    .style("opacity", 0.1)
                    .style("fill", colors.text);

                // Draw horizontal line background
                labelsG.append("line")
                    .attr("x1", -5000)
                    .attr("y1", avgPos)
                    .attr("x2", 5000)
                    .attr("y2", avgPos)
                    .style("stroke", colors.text)
                    .style("stroke-width", 1)
                    .style("stroke-dasharray", "10,10")
                    .style("opacity", 0.05);
            }
        });
    }
    
    // Extra Links (Connections)
    const extraLinks: any[] = [];
    nodes.descendants().forEach((sourceNode: any) => {
      if (sourceNode.data.connections) {
        sourceNode.data.connections.forEach((conn: any) => {
          const targetNode = nodeMapRef.current.get(conn.targetId);
          if (targetNode) {
            extraLinks.push({
              source: sourceNode,
              target: targetNode,
              label: conn.label
            });
          }
        });
      }
    });

    const customLinkGenerator = (d: any) => {
        let s = d.source;
        let t = d.target;
        
        if (s.data.connections && s.data.connections.some((c: any) => c.label === 'همسر')) {
            const spouseConn = s.data.connections.find((c: any) => c.label === 'همسر');
            const spouseNode = nodeMapRef.current.get(spouseConn.targetId);
            if (spouseNode) {
                 const midX = (s.x + spouseNode.x) / 2;
                 const midY = (s.y + spouseNode.y) / 2;
                 s = { x: midX, y: midY };
            }
        }

        if (linkStyle === 'straight') {
             if (orientation === 'horizontal') {
                return `M${s.y},${s.x} L${s.y},${t.x} L${t.y},${t.x}`; 
             } else {
                return `M${s.x},${s.y} L${t.x},${s.y} L${t.x},${t.y}`;
             }
        }

        if (linkStyle === 'step') {
            if (orientation === 'horizontal') {
                const midY = (s.y + t.y) / 2;
                return `M${s.y},${s.x} L${midY},${s.x} L${midY},${t.x} L${t.y},${t.x}`;
            } else {
                const midY = (s.y + t.y) / 2;
                return `M${s.x},${s.y} L${s.x},${midY} L${t.x},${midY} L${t.x},${t.y}`;
            }
        }

        let offset = 0;
        if (preventOverlap) {
            const idVal = t.data.id ? t.data.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 0;
            offset = ((idVal % 3) - 1) * 20; 
        }

        if (orientation === 'horizontal') {
            const mx = (s.y + t.y) / 2;
            return `M ${s.y} ${s.x} 
                    C ${mx} ${s.x + offset}, 
                      ${mx} ${t.x + offset}, 
                      ${t.y} ${t.x}`;
        } else {
            const my = (s.y + t.y) / 2;
            return `M ${s.x} ${s.y} 
                    C ${s.x + offset} ${my}, 
                      ${t.x + offset} ${my}, 
                      ${t.x} ${t.y}`;
        }
    };

    const gContent = g.append("g");

    const visibleExtraLinks = extraLinks.filter(d => {
        if (d.label === 'همسر' && treeSettings && !treeSettings.showSpouseConnections) return false;
        return true;
    });

    gContent.selectAll(".extra-link")
      .data(visibleExtraLinks)
      .enter().append("path")
      .attr("class", "extra-link")
      .attr("d", (d: any) => {
          const s = d.source;
          const t = d.target;
          const dist = Math.sqrt(Math.pow(s.x - t.x, 2) + Math.pow(s.y - t.y, 2));
          
          if (dist < 180) { 
             return orientation === 'horizontal' 
                 ? `M ${s.y} ${s.x} L ${t.y} ${t.x}` 
                 : `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
          }

          if (orientation === 'horizontal') {
              const mx = (s.y + t.y) / 2;
              return `M ${s.y} ${s.x} C ${mx} ${s.x}, ${mx} ${t.x}, ${t.y} ${t.x}`;
          } else {
              const my = (s.y + t.y) / 2;
              return `M ${s.x} ${s.y} C ${s.x} ${my}, ${t.x} ${my}, ${t.x} ${t.y}`;
          }
      })
      .attr("fill", "none")
      .attr("stroke", (d: any) => d.label === 'همسر' ? colors.linkSpouse : colors.linkExtra)
      .attr("stroke-width", "2px")
      .attr("stroke-dasharray", (d: any) => d.label === 'همسر' ? "0" : "5,5")
      .attr("opacity", (d: any) => {
         if (!isVisibleInTime(d.source.data) || !isVisibleInTime(d.target.data)) return 0;
         if (!hasHighlight) return 0.6;
         const srcHi = highlightedIds.has(d.source.data.id);
         const tgtHi = highlightedIds.has(d.target.data.id);
         return (srcHi && tgtHi) ? 1 : 0.1;
      });

    const visibleLinks = nodes.links().filter((d: any) => {
        if (d.source.data.relation === 'SystemRoot') return false;
        if (treeSettings && !treeSettings.showParentChildConnections) return false;
        // @ts-ignore
        if (d.target.data._isMoved) return false; 
        return true;
    });

    gContent.selectAll(".link")
      .data(visibleLinks)
      .enter().append("path")
      .attr("class", "link")
      .attr("d", customLinkGenerator)
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
          if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return colors.selectedRing;
          
          // Use Branch Color for Link if enabled
          if (treeSettings?.colorMode === 'branch' && d.target._branchColor) {
              return d.target._branchColor;
          }

          return colors.link;
      })
      .attr("stroke-width", (d: any) => {
         if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return "3px";
         return "1.5px";
      })
      .style("opacity", (d: any) => {
         if (!isVisibleInTime(d.source.data) || !isVisibleInTime(d.target.data)) return 0;
         if (!hasHighlight) return 1;
         if (highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return 1;
         return 0.1;
      });

    const node = gContent.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => orientation === 'horizontal' ? `translate(${d.y},${d.x})` : `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (event: any, d: HierarchyPointNode<FamilyMember>) => {
        if(d.data.relation === 'SystemRoot') return;
        event.stopPropagation();
        onNodeClick(d.data);
      })
      .on("dblclick", (event: any, d: HierarchyPointNode<FamilyMember>) => {
          if(d.data.relation === 'SystemRoot') return;
          event.stopPropagation();
          onOpenDetails(d.data);
      })
      .on("contextmenu", (event: any, d: HierarchyPointNode<FamilyMember>) => {
          event.preventDefault();
          event.stopPropagation();
          if(d.data.relation === 'SystemRoot') return;
          onNodeClick(d.data);
          setContextMenu({ 
              x: event.clientX, 
              y: event.clientY, 
              member: d.data 
          });
      })
      .style("opacity", (d: HierarchyPointNode<FamilyMember>) => {
         if (!isVisibleInTime(d.data)) return 0.05;
         if (d.data.relation === 'SystemRoot') return 0;
         if (!hasHighlight) return 1;
         return highlightedIds.has(d.data.id) ? 1 : 0.2; 
      });

    const animatedNode = node.append("g")
      .attr("class", "animate-fade-in-scale");

    animatedNode.each(function(d: any) {
        if (selectedId === d.data.id) {
            const el = select(this);
            el.append("circle")
              .attr("r", isCompact ? 20 : 30)
              .attr("fill", "none")
              .attr("stroke", colors.selectedRing)
              .attr("stroke-width", "2px")
              .attr("class", "animate-pulse-ring opacity-50");
        }
    });

    animatedNode.append("circle")
      .attr("r", isCompact ? 20 : 30)
      .attr("fill", colors.nodeFill)
      .attr("stroke", (d: any) => {
          if (selectedId === d.data.id) return colors.selectedRing;
          if (treeSettings?.colorMode === 'branch' && d._branchColor) return d._branchColor;
          return colors.nodeStroke;
      })
      .attr("stroke-width", (d: any) => selectedId === d.data.id ? "4px" : "2px")
      .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.1))")
      .style("transition", "all 0.3s ease");

    const clipPathId = (d: any) => `clip-${d.data.id}`;
    animatedNode.append("clipPath")
      .attr("id", clipPathId)
      .append("circle")
      .attr("r", isCompact ? 18 : 28);

    animatedNode.each(function(d: HierarchyPointNode<FamilyMember>) {
        const el = select(this);
        const shouldShowAvatar = (treeSettings?.showAvatars ?? true) && !isCompact;
        
        if (d.data.imageUrl && shouldShowAvatar) {
            el.append("image")
              .attr("xlink:href", d.data.imageUrl)
              .attr("x", isCompact ? -18 : -28)
              .attr("y", isCompact ? -18 : -28)
              .attr("width", isCompact ? 36 : 56)
              .attr("height", isCompact ? 36 : 56)
              .attr("clip-path", `url(#${clipPathId(d)})`)
              .attr("preserveAspectRatio", "xMidYMid slice");
        } else {
            const iconScale = isCompact ? 1.0 : 1.5; 
            const iconSize = 24 * iconScale;
            const offset = -iconSize / 2;
            
            let iconPath = MALE_ICON; 
            let iconColor = colors.maleIcon;

            // Use Branch Color for Icon if no image in Branch Mode
            if (treeSettings?.colorMode === 'branch' && d._branchColor) {
                iconColor = d._branchColor;
            } else {
                if (d.data.gender === 'female') {
                    iconPath = FEMALE_ICON;
                    iconColor = colors.femaleIcon;
                } else if (d.data.gender === 'other') {
                    iconPath = MALE_ICON;
                    iconColor = colors.textSecondary;
                }
            }

            el.append("path")
              .attr("d", iconPath)
              .attr("fill", iconColor)
              .attr("transform", `translate(${offset}, ${offset}) scale(${iconScale})`);
        }

        const showSpouseIcon = treeSettings?.showSpouseConnections ?? true;
        if (showSpouseIcon && d.data.connections && d.data.connections.some(c => c.label === 'همسر')) {
             const cx = isCompact ? 14 : 22;
             const cy = isCompact ? 14 : 22;
             const r = isCompact ? 6 : 8;
             const sc = isCompact ? 0.35 : 0.5;
             const tx = isCompact ? 10 : 16;
             const ty = isCompact ? 10 : 16;

             el.append("circle")
               .attr("r", r)
               .attr("cx", cx)
               .attr("cy", cy)
               .attr("fill", colors.nodeFill)
               .attr("stroke", colors.linkSpouse)
               .attr("stroke-width", 1);

             el.append("g")
               .attr("transform", `translate(${tx}, ${ty}) scale(${sc})`)
               .html(`<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${colors.linkSpouse}"/>`);
        }
    });

    if (treeSettings?.showLabels) {
        const textY = isCompact ? 32 : 45;
        animatedNode.append("text")
          .attr("dy", textY)
          .attr("text-anchor", "middle")
          .text((d: any) => d.data.name)
          .style("font-family", fontFamily)
          .style("font-size", isCompact ? "10px" : "12px")
          .style("font-weight", "bold")
          .style("fill", colors.text)
          .style("text-shadow", "0px 1px 2px rgba(255,255,255,0.8)");
    }

    if (treeSettings?.showDates) {
        const dateY = isCompact ? 42 : 58;
        animatedNode.append("text")
          .attr("dy", dateY)
          .attr("text-anchor", "middle")
          .text((d: any) => {
              const birth = d.data.birthDate ? d.data.birthDate.split('/')[0] : '';
              if (treeSettings?.showAge) {
                  const age = calculateAge(d.data.birthDate, d.data.deathDate);
                  return birth + (age ? ` ${age}` : '');
              }
              return birth;
          })
          .style("font-family", "monospace") // Numbers look better in monospace usually, but can change
          .style("font-size", "10px")
          .style("fill", colors.textSecondary);
    }

  }, [data, dimensions, orientation, theme, highlightedIds, linkStyle, preventOverlap, currentYear, treeSettings]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.8);
    }
  };

  const handleFit = () => {
      if (!svgRef.current || !zoomRef.current) return;
      const rootG = select(svgRef.current).select('g');
      // @ts-ignore
      const bounds = rootG.node()?.getBBox();
      if (!bounds) return;

      const parent = svgRef.current.parentElement;
      if (!parent) return;

      const fullWidth = parent.clientWidth;
      const fullHeight = parent.clientHeight;
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      if (bounds.width === 0 || bounds.height === 0) return;

      const scale = 0.85 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight);
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

      select(svgRef.current)
        .transition()
        .duration(750)
        .call(
            // @ts-ignore
            zoomRef.current.transform, 
            zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
  };

  const toggleLinkStyle = () => {
      if (linkStyle === 'curved') setLinkStyle('step');
      else if (linkStyle === 'step') setLinkStyle('straight');
      else setLinkStyle('curved');
  };

  const glassClass = theme === 'dark' ? 'glass-panel-dark' : 'glass-panel';

  const handleMenuAction = (action: () => void) => {
      action();
      setContextMenu(null);
  };

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden bg-transparent" onContextMenu={(e) => e.preventDefault()}>
      <svg ref={svgRef} className="w-full h-full touch-none" />

      {/* Floating Toolbar */}
      <div className={`absolute bottom-6 right-6 flex flex-col gap-2 p-2 rounded-xl shadow-xl transition-all animate-slide-up ${glassClass}`}>
        <button onClick={handleFit} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors" title="وسط چین (Space)"><Maximize size={20} /></button>
        <button onClick={handleZoomIn} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors"><ZoomIn size={20} /></button>
        <button onClick={handleZoomOut} className="p-2 rounded-lg hover:bg-teal-500/20 text-teal-600 transition-colors"><ZoomOut size={20} /></button>
        <div className="h-px bg-slate-300 dark:bg-slate-600 my-1 mx-2"></div>
        <button onClick={() => onOrientationChange('vertical')} className={`p-2 rounded-lg transition-colors ${orientation === 'vertical' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="عمودی"><ArrowDown size={20} /></button>
        <button onClick={() => onOrientationChange('horizontal')} className={`p-2 rounded-lg transition-colors ${orientation === 'horizontal' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="افقی"><ArrowRight size={20} /></button>
        <div className="h-px bg-slate-300 dark:bg-slate-600 my-1 mx-2"></div>
        <button onClick={toggleLinkStyle} className={`p-2 rounded-lg transition-colors ${linkStyle !== 'curved' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title={`تغییر نوع خط: ${linkStyle === 'curved' ? 'منحنی' : linkStyle === 'step' ? 'شکسته' : 'صاف'}`}><GitBranch size={20} /></button>
        <button onClick={() => setPreventOverlap(!preventOverlap)} className={`p-2 rounded-lg transition-colors ${preventOverlap ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-teal-500/20 text-teal-600'}`} title="جلوگیری از تداخل"><GitMerge size={20} /></button>
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (
          <div 
            className={`fixed z-[2001] rounded-xl shadow-2xl p-2 min-w-[200px] context-menu-enter ${glassClass} border ${theme === 'dark' ? 'border-slate-700 text-slate-200' : 'border-slate-100 text-slate-700'}`}
            style={{ top: contextMenu.y + 10, left: contextMenu.x + 10 }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
              <div className="px-3 py-2 text-xs font-bold opacity-50 border-b border-dashed border-slate-300 dark:border-slate-600 mb-1">
                  {contextMenu.member.name}
              </div>

              <button onClick={() => handleMenuAction(() => onOpenDetails(contextMenu.member))} className="w-full text-right px-3 py-2.5 hover:bg-teal-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <User size={16} className="text-teal-500"/> مشاهده پروفایل
              </button>
              
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>

              <button onClick={() => handleMenuAction(() => onAddChild && onAddChild(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-teal-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <Plus size={16}/> افزودن فرزند
              </button>
              <button onClick={() => handleMenuAction(() => onAddSibling && onAddSibling(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-blue-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <GitBranch size={16}/> افزودن هم‌سطح
              </button>
              <button onClick={() => handleMenuAction(() => onAddSpouse && onAddSpouse(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-pink-500/10 rounded-lg flex items-center gap-2 text-sm transition-colors text-pink-500 font-medium">
                  <Heart size={16}/> ثبت همسر / ازدواج
              </button>

              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>

              <button onClick={() => handleMenuAction(() => onDeleteMember && onDeleteMember(contextMenu.member.id))} className="w-full text-right px-3 py-2.5 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center gap-2 text-sm transition-colors">
                  <Trash2 size={16}/> حذف عضو
              </button>
              <button onClick={() => setContextMenu(null)} className="w-full text-right px-3 py-2.5 hover:bg-slate-500/10 text-slate-400 rounded-lg flex items-center gap-2 text-xs transition-colors mt-1">
                  <XCircle size={14}/> بستن منو
              </button>
          </div>
      )}

      {/* Quick Action Floating Menu (Only shows if Context Menu is CLOSED) */}
      {selectedNodePos && !contextMenu && (
         <div 
            className="absolute z-40 flex flex-col gap-2 context-menu-enter"
            style={{ 
                left: selectedNodePos.x, 
                top: selectedNodePos.y, 
                transform: 'translate(-50%, -100%) translateY(-50px)' 
            }}
         >
             <div className={`flex gap-2 p-2 rounded-full shadow-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                 <button onClick={() => { if(selectedId) { onOpenDetails(nodeMapRef.current.get(selectedId)?.data!); } }} className="p-2 rounded-full hover:bg-teal-50 text-teal-600 transition-colors" title="مشاهده پروفایل"><User size={18}/></button>
                 <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                 <button onClick={() => { if(selectedId && onAddChild) onAddChild(selectedId); }} className="p-2 rounded-full hover:bg-teal-50 text-teal-600 transition-colors" title="افزودن فرزند"><Plus size={18}/></button>
                 <button onClick={() => { if(selectedId && onAddSibling) onAddSibling(selectedId); }} className="p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors" title="افزودن هم‌سطح"><GitBranch size={18}/></button>
                 <button onClick={() => { if(selectedId && onAddSpouse) onAddSpouse(selectedId); }} className="p-2 rounded-full hover:bg-pink-50 text-pink-500 transition-colors" title="افزودن همسر"><Heart size={18}/></button>
             </div>
         </div>
      )}
    </div>
  );
};

export default FamilyTree;
