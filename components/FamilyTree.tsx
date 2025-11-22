
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FamilyMember, AppTheme, Tag } from '../types';
import { Maximize, ZoomIn, ZoomOut, Image as ImageIcon, GitMerge, Plus, GitBranch, Edit3 } from 'lucide-react';

interface FamilyTreeProps {
  data: FamilyMember;
  onNodeClick: (member: FamilyMember) => void;
  selectedId?: string;
  orientation: 'horizontal' | 'vertical';
  theme: AppTheme;
  highlightedIds: Set<string>;
  onAddChild?: (parentId: string) => void;
  onAddSibling?: (memberId: string) => void;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ 
  data, 
  onNodeClick, 
  selectedId, 
  orientation,
  theme,
  highlightedIds,
  onAddChild,
  onAddSibling
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [linkStyle, setLinkStyle] = useState<'curved' | 'straight'>('curved');
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [selectedNodePos, setSelectedNodePos] = useState<{x: number, y: number} | null>(null);

  // Theme configuration
  const getThemeColors = (theme: AppTheme) => {
    switch (theme) {
      case 'vintage':
        return {
          link: '#d3c6aa',
          linkExtra: '#cb4b16',
          maleGrad: ['#859900', '#859900'], // Olive
          femaleGrad: ['#b58900', '#b58900'], // Yellow/Gold
          text: '#433422',
          textSecondary: '#887a66',
          nodeStroke: '#586e75',
          bgLabel: '#fdf6e3',
          selectedRing: '#cb4b16'
        };
      case 'dark':
        return {
          link: '#475569',
          linkExtra: '#f59e0b',
          maleGrad: ['#1e40af', '#3b82f6'],
          femaleGrad: ['#831843', '#db2777'],
          text: '#f1f5f9',
          textSecondary: '#94a3b8',
          nodeStroke: '#fff',
          bgLabel: '#0f172a',
          selectedRing: '#2dd4bf'
        };
      case 'modern':
      default:
        return {
          link: '#94a3b8',
          linkExtra: '#f59e0b',
          maleGrad: ['#60a5fa', '#2563eb'],
          femaleGrad: ['#f472b6', '#db2777'],
          text: '#1e293b',
          textSecondary: '#64748b',
          nodeStroke: '#fff',
          bgLabel: 'rgba(255,255,255,0.9)',
          selectedRing: '#0f766e'
        };
    }
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

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const colors = getThemeColors(theme);
    const hasHighlight = highlightedIds.size > 0;

    // Clear previous SVG
    d3.select(svgRef.current).selectAll("*").remove();

    const margin = { top: 80, right: 120, bottom: 80, left: 120 };
    const width = dimensions.width - margin.left - margin.right;
    // const height = dimensions.height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    // Define Gradients
    const defs = svg.append("defs");
    
    // Male Gradient
    const maleGrad = defs.append("linearGradient")
      .attr("id", "grad-male")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    maleGrad.append("stop").attr("offset", "0%").style("stop-color", colors.maleGrad[0]);
    maleGrad.append("stop").attr("offset", "100%").style("stop-color", colors.maleGrad[1]);

    // Female Gradient
    const femaleGrad = defs.append("linearGradient")
      .attr("id", "grad-female")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    femaleGrad.append("stop").attr("offset", "0%").style("stop-color", colors.femaleGrad[0]);
    femaleGrad.append("stop").attr("offset", "100%").style("stop-color", colors.femaleGrad[1]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
          setZoomTransform(event.transform);
        });

    svg.call(zoom);
    zoomRef.current = zoom;
    
    if (zoomTransform !== d3.zoomIdentity) {
         svg.call(zoom.transform, zoomTransform);
    } else {
         svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left + width/2, 50));
    }

    // Declare the tree layout
    let treemap;
    if (orientation === 'horizontal') {
        treemap = d3.tree<FamilyMember>().nodeSize([90, 200]);
    } else {
        treemap = d3.tree<FamilyMember>().nodeSize([140, 140]);
    }

    const root = d3.hierarchy(data, (d) => d.children);
    // @ts-ignore
    const nodes = treemap(root);

    // Calculate Max Depth for Heatmap
    let maxDepth = 0;
    nodes.descendants().forEach(d => { if(d.depth > maxDepth) maxDepth = d.depth; });
    const heatmapColorScale = d3.scaleLinear<string>()
        .domain([0, maxDepth])
        .range(["#1e293b", "#cbd5e1"]); // Dark to Light slate


    // Create a lookup for nodes
    const nodeMap = new Map<string, d3.HierarchyPointNode<FamilyMember>>();
    nodes.descendants().forEach(d => {
      nodeMap.set(d.data.id, d);
    });
    
    // Update selected node position for quick menu
    if (selectedId) {
        const sNode = nodeMap.get(selectedId);
        if (sNode) {
            // Apply transform manually to get screen coords
            const t = zoomTransform;
            const x = orientation === 'horizontal' ? sNode.y : sNode.x;
            const y = orientation === 'horizontal' ? sNode.x : sNode.y;
            setSelectedNodePos({
                x: t.x + x * t.k + margin.left,
                y: t.y + y * t.k + margin.top
            });
        } else {
            setSelectedNodePos(null);
        }
    } else {
        setSelectedNodePos(null);
    }


    // Prepare extra connection links
    const extraLinks: { source: d3.HierarchyPointNode<FamilyMember>; target: d3.HierarchyPointNode<FamilyMember>; label: string }[] = [];
    nodes.descendants().forEach(sourceNode => {
      if (sourceNode.data.connections) {
        sourceNode.data.connections.forEach(conn => {
          const targetNode = nodeMap.get(conn.targetId);
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

    // Link Generators
    let linkGenerator: any;
    
    if (linkStyle === 'curved') {
       if (orientation === 'horizontal') {
         linkGenerator = d3.linkHorizontal<d3.HierarchyPointLink<FamilyMember>, d3.HierarchyPointNode<FamilyMember>>()
            .x((d) => d.y)
            .y((d) => d.x);
       } else {
         linkGenerator = d3.linkVertical<d3.HierarchyPointLink<FamilyMember>, d3.HierarchyPointNode<FamilyMember>>()
            .x((d) => d.x)
            .y((d) => d.y);
       }
    } else {
       // Straight lines
       linkGenerator = (d: d3.HierarchyPointLink<FamilyMember>) => {
          if (orientation === 'horizontal') {
             return `M${d.source.y},${d.source.x} L${d.source.y},${d.target.x} L${d.target.y},${d.target.x}`; // Orthogonal
          } else {
             return `M${d.source.x},${d.source.y} L${d.target.x},${d.source.y} L${d.target.x},${d.target.y}`; // Orthogonal
          }
       };
    }

    // Draw Extra Links
    g.selectAll(".extra-link")
      .data(extraLinks)
      .enter().append("path")
      .attr("class", "extra-link")
      .attr("d", linkGenerator)
      .attr("fill", "none")
      .attr("stroke", colors.linkExtra) 
      .attr("stroke-width", "2px")
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", (d) => {
         if (!hasHighlight) return 0.6;
         const srcHi = highlightedIds.has(d.source.data.id);
         const tgtHi = highlightedIds.has(d.target.data.id);
         return (srcHi && tgtHi) ? 1 : 0.1;
      });

    // Draw Standard Links
    g.selectAll(".link")
      .data(nodes.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("d", linkGenerator)
      .attr("fill", "none")
      .attr("stroke", (d: d3.HierarchyPointLink<FamilyMember>) => {
          if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) {
             return colors.selectedRing;
          }
          return colors.link;
      })
      .attr("stroke-width", (d: d3.HierarchyPointLink<FamilyMember>) => {
         if (hasHighlight && highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) {
             return "3px";
         }
         return "1.5px";
      })
      .style("opacity", (d: d3.HierarchyPointLink<FamilyMember>) => {
         if (!hasHighlight) return 1;
         if (highlightedIds.has(d.source.data.id) && highlightedIds.has(d.target.data.id)) return 1;
         return 0.1;
      })
      .style("transition", "all 0.5s ease");

    // Nodes Group
    const node = g.selectAll(".node")
      .data(nodes.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: d3.HierarchyPointNode<FamilyMember>) => {
          return orientation === 'horizontal' 
            ? "translate(" + d.y + "," + d.x + ")"
            : "translate(" + d.x + "," + d.y + ")";
      })
      .style("cursor", "pointer")
      .on("click", (event, d: d3.HierarchyPointNode<FamilyMember>) => {
        if(d.data.relation === 'SystemRoot') return;
        onNodeClick(d.data);
        event.stopPropagation();
      })
      .style("opacity", (d: d3.HierarchyPointNode<FamilyMember>) => {
         if (d.data.relation === 'SystemRoot') return 0;
         if (!hasHighlight) return 1;
         return highlightedIds.has(d.data.id) ? 1 : 0.2; 
      })
      .style("transition", "opacity 0.4s ease")
      .style("pointer-events", (d: d3.HierarchyPointNode<FamilyMember>) => d.data.relation === 'SystemRoot' ? 'none' : 'all');


    // 1. Selected State Ring
    node.filter((d: d3.HierarchyPointNode<FamilyMember>) => d.data.id === selectedId)
        .append("circle")
        .attr("r", 34)
        .attr("fill", "none")
        .attr("stroke", colors.selectedRing)
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "4,4")
        .attr("class", "animate-spin-slow");

    // 2. Main Circle Background (Gradient or Heatmap)
    node.append("circle")
      .attr("r", 26)
      .style("fill", (d: d3.HierarchyPointNode<FamilyMember>) => {
          if (heatmapMode) {
             return heatmapColorScale(d.depth);
          }
          return d.data.gender === 'female' ? "url(#grad-female)" : (d.data.gender === 'male' ? "url(#grad-male)" : '#9ca3af');
      })
      .style("stroke", colors.nodeStroke)
      .style("stroke-width", "2px")
      .classed("drop-shadow-md", true);

    // 3. Clip Path for Image
    node.each(function(d: d3.HierarchyPointNode<FamilyMember>, i) {
        if (d.data.imageUrl) {
             defs.append("clipPath")
                .attr("id", "clip-circle-" + i)
                .append("circle")
                .attr("r", 26); 
        }
    });

    // 4. Image Overlay
    node.filter((d: d3.HierarchyPointNode<FamilyMember>) => !!d.data.imageUrl && !heatmapMode)
        .append("image")
        .attr("xlink:href", (d: d3.HierarchyPointNode<FamilyMember>) => d.data.imageUrl || '')
        .attr("x", -26)
        .attr("y", -26)
        .attr("width", 52)
        .attr("height", 52)
        .attr("clip-path", (d, i) => `url(#clip-circle-${i})`)
        .attr("preserveAspectRatio", "xMidYMid slice");


    // 5. Name Label Background
    node.append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", 110)
      .attr("height", 26)
      .attr("x", -55)
      .attr("y", orientation === 'horizontal' ? 32 : 32)
      .attr("fill", colors.bgLabel)
      .style("opacity", 0.9);

    // 6. Name Text
    node.append("text")
      .attr("dy", orientation === 'horizontal' ? "49" : "49")
      .style("text-anchor", "middle")
      .text((d: d3.HierarchyPointNode<FamilyMember>) => d.data.name)
      .style("font-family", theme === 'vintage' ? 'Noto Naskh Arabic' : 'Vazirmatn')
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", colors.text);

    // 7. Relation Label (Small)
    node.append("text")
      .attr("dy", orientation === 'horizontal' ? "64" : "64")
      .style("text-anchor", "middle")
      .text((d: d3.HierarchyPointNode<FamilyMember>) => d.data.relation || '')
      .style("font-family", theme === 'vintage' ? 'Noto Naskh Arabic' : 'Vazirmatn')
      .style("font-size", "10px")
      .style("fill", colors.textSecondary);
      
    // 8. Tag Indicators (Dots)
    node.each(function(d: d3.HierarchyPointNode<FamilyMember>) {
        if (d.data.tags && d.data.tags.length > 0) {
            d3.select(this).selectAll(".tag-dot")
              .data(d.data.tags.slice(0, 3)) // Limit to 3
              .enter().append("circle")
              .attr("class", "tag-dot")
              .attr("r", 3)
              .attr("cx", (tag: Tag, i) => -15 + (i * 10))
              .attr("cy", -32)
              .attr("fill", (tag: Tag) => tag.color);
        }
    });

  }, [data, dimensions, onNodeClick, selectedId, orientation, linkStyle, theme, highlightedIds, heatmapMode]);

  const handleZoom = (factor: number) => {
      if (svgRef.current && zoomRef.current) {
          d3.select(svgRef.current)
            .transition()
            .duration(300)
            .call(zoomRef.current.scaleBy, factor);
      }
  };

  const handleFit = () => {
      if (svgRef.current && zoomRef.current) {
           d3.select(svgRef.current)
            .transition()
            .duration(750)
            .call(zoomRef.current.transform, d3.zoomIdentity.translate(dimensions.width/2, 100).scale(1));
      }
  };

  const handleDownloadSVG = () => {
      if (!svgRef.current) return;
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nasab_tree_${theme}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Define glass classes based on theme
  const glassClass = theme === 'dark' ? 'glass-panel-dark' : (theme === 'vintage' ? 'glass-panel-vintage' : 'glass-panel');

  return (
    <div ref={wrapperRef} className="w-full h-full rounded-2xl overflow-hidden relative">
      
      {/* Quick Action Floating Menu */}
      {selectedId && selectedNodePos && onAddChild && onAddSibling && (
          <div 
            style={{ 
                position: 'absolute', 
                left: selectedNodePos.x + 40, 
                top: selectedNodePos.y - 20,
                zIndex: 100
            }}
            className="flex flex-col gap-1 animate-in fade-in zoom-in duration-200"
          >
              <button onClick={() => onAddChild(selectedId)} className="bg-teal-500 text-white p-1.5 rounded-full shadow-lg hover:bg-teal-600 hover:scale-110 transition-all" title="افزودن فرزند">
                  <Plus size={14}/>
              </button>
              <button onClick={() => onAddSibling(selectedId)} className="bg-blue-500 text-white p-1.5 rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all" title="افزودن هم‌سطح">
                  <GitBranch size={14}/>
              </button>
          </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
          {/* Style Toggle */}
          <div className={`${glassClass} shadow-lg rounded-xl p-1 flex flex-col gap-1 backdrop-blur-md`}>
             <button onClick={() => setLinkStyle(prev => prev === 'curved' ? 'straight' : 'curved')} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="تغییر خطوط">
                  <GitMerge size={20} />
             </button>
             <button onClick={() => setHeatmapMode(!heatmapMode)} className={`p-2 rounded-lg transition-colors ${heatmapMode ? 'bg-orange-100/50 text-orange-600' : (theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50')}`} title="نقشه حرارتی نسل‌ها">
                  <div className="w-5 h-5 rounded bg-gradient-to-br from-slate-800 to-slate-300 border border-white/30"></div>
             </button>
          </div>

          {/* Zoom */}
          <div className={`${glassClass} shadow-lg rounded-xl p-1 flex flex-col gap-1 backdrop-blur-md`}>
              <button onClick={() => handleZoom(1.2)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="بزرگنمایی">
                  <ZoomIn size={20} />
              </button>
              <button onClick={() => handleZoom(0.8)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="کوچک‌نمایی">
                  <ZoomOut size={20} />
              </button>
               <button onClick={handleFit} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-white/50'}`} title="بازنشانی">
                  <Maximize size={20} />
              </button>
          </div>

          {/* Export */}
          <div className={`${glassClass} shadow-lg rounded-xl p-1 backdrop-blur-md`}>
               <button onClick={handleDownloadSVG} className={`p-2 rounded-lg ${theme === 'dark' ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-white/50'}`} title="دانلود تصویر">
                  <ImageIcon size={20} />
              </button>
          </div>
      </div>

      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
    </div>
  );
};

export default FamilyTree;
