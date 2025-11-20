
import React, { useRef, useState } from 'react';
import { Bone, ToolMode, CameraState, Sprite, AppSettings, Selection, DerivedBone, TransformMode } from '../types';
import { calculateFK, degToRad, solveIK } from '../utils';

interface ViewportProps {
  bones: Bone[];
  prevBones: Bone[] | null; // For Onion Skin
  sprites: Sprite[];
  updateBone: (id: string, updates: Partial<Bone>) => void;
  updateSprite: (id: string, updates: Partial<Sprite>) => void;
  camera: CameraState;
  setCamera: (c: CameraState | ((prev: CameraState) => CameraState)) => void;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  mode: ToolMode;
  transformMode: TransformMode;
  settings: AppSettings;
}

export const Viewport: React.FC<ViewportProps> = ({
  bones,
  prevBones,
  sprites,
  updateBone,
  updateSprite,
  camera,
  setCamera,
  selection,
  setSelection,
  mode,
  transformMode,
  settings
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [dragState, setDragState] = useState<{
    active: boolean;
    type: 'bone' | 'sprite' | 'camera';
    targetId?: string; 
    startX: number;
    startY: number;
    initialVal: any; 
  } | null>(null);

  const derivedBones = calculateFK(bones);
  const derivedPrevBones = prevBones ? calculateFK(prevBones) : null;

  const snap = (val: number) => settings.snapToGrid ? Math.round(val / 10) * 10 : val;

  // --- Cursor Logic ---
  const getCursor = () => {
      if (dragState?.active) return 'grabbing';
      if (mode === ToolMode.CAMERA) return 'move';
      if (mode === ToolMode.SELECT) {
          if (selection?.type === 'BONE') {
              return transformMode === 'ROTATE' ? 'alias' : 'crosshair';
          }
          if (selection?.type === 'SPRITE') return 'move';
      }
      return 'default';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === ToolMode.CAMERA || e.button === 1) {
      e.preventDefault();
      setDragState({
        active: true,
        type: 'camera',
        startX: e.clientX,
        startY: e.clientY,
        initialVal: { ...camera }
      });
    } else if (mode === ToolMode.SELECT) {
       if (e.target === svgRef.current) {
           setSelection(null);
       }
    }
  };

  const handleObjectMouseDown = (e: React.MouseEvent, type: 'bone' | 'sprite', id: string) => {
    e.stopPropagation(); 
    e.preventDefault();
    setSelection({ type: type === 'bone' ? 'BONE' : 'SPRITE', id });

    if (mode === ToolMode.SELECT) {
        if (type === 'bone' && bones) {
            const bone = bones.find(b => b.id === id);
            if (bone && !bone.locked) {
                 setDragState({
                    active: true,
                    type: 'bone',
                    targetId: id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialVal: { rotation: bone.rotation, x: bone.x, y: bone.y }
                 });
            }
        } else if (type === 'sprite' && sprites) {
            const sprite = sprites.find(s => s.id === id);
            if (sprite) {
                setDragState({
                    active: true,
                    type: 'sprite',
                    targetId: id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialVal: { offsetX: sprite.offsetX, offsetY: sprite.offsetY }
                });
            }
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !dragState.active) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    if (dragState.type === 'camera') {
        const rad = degToRad(camera.rotation);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rdx = (dx * cos + dy * sin) / camera.zoom;
        const rdy = (-dx * sin + dy * cos) / camera.zoom;

        setCamera(prev => ({ ...prev, x: dragState.initialVal.x - rdx, y: dragState.initialVal.y - rdy }));
        return;
    } 
    
    if (dragState.type === 'bone' && dragState.targetId && bones) {
      const bone = bones.find(b => b.id === dragState.targetId);
      if (!bone || bone.locked) return;
      
      if (transformMode === 'TRANSLATE') {
         // --- IK Logic / Root Movement ---
         const zoom = camera.zoom;
         const rad = degToRad(camera.rotation);
         
         // Calculate mouse world position relative to start of drag
         // But for IK we need absolute World Mouse Position
         // Let's reconstruct World Mouse from Screen Mouse
         const rect = svgRef.current?.getBoundingClientRect();
         if (!rect) return;
         
         const centerX = rect.width / 2;
         const centerY = rect.height / 2;

         // Current Mouse relative to center
         const mx = e.clientX - rect.left - centerX;
         const my = e.clientY - rect.top - centerY;
         
         // Un-rotate and Un-scale camera
         const camRad = degToRad(-camera.rotation); // Camera rotation is inverse in group transform
         const unrotX = mx * Math.cos(-camRad) - my * Math.sin(-camRad);
         const unrotY = mx * Math.sin(-camRad) + my * Math.cos(-camRad);
         
         const worldMouseX = (unrotX / camera.zoom) + camera.x;
         const worldMouseY = (unrotY / camera.zoom) + camera.y;

         if (bone.parentId === null) {
             // Root Move
             updateBone(bone.id, { 
                 x: snap(worldMouseX), 
                 y: snap(worldMouseY) 
             });
         } else {
             // IK SOLVER
             const solvedBones = solveIK(bones, bone.id, { x: worldMouseX, y: worldMouseY });
             
             // We can't batch update easily with current App.tsx structure without a bulk update function
             // So we iterate. For performance in a real app, use bulk update.
             // Optimization: Only update changed bones
             solvedBones.forEach(sb => {
                 const original = bones.find(b => b.id === sb.id);
                 if (original && Math.abs(original.rotation - sb.rotation) > 0.01) {
                     updateBone(sb.id, { rotation: sb.rotation });
                 }
             });
         }

      } else {
         // ROTATE Mode
         const rotDelta = dx * 0.5; 
         let newRot = dragState.initialVal.rotation + rotDelta;
         if (settings.snapToGrid) newRot = Math.round(newRot / 15) * 15;
         updateBone(bone.id, { rotation: newRot });
      }
    }

    if (dragState.type === 'sprite' && dragState.targetId) {
        const zoom = camera.zoom;
        updateSprite(dragState.targetId, {
            offsetX: dragState.initialVal.offsetX + (dx / zoom),
            offsetY: dragState.initialVal.offsetY + (dy / zoom)
        });
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
     const zoomSensitivity = 0.001;
     const newZoom = Math.max(0.1, Math.min(5, camera.zoom - e.deltaY * zoomSensitivity));
     setCamera(prev => ({ ...prev, zoom: newZoom }));
  };

  const getBonePath = (bone: DerivedBone, widthStart: number, widthEnd: number) => {
     const dx = bone.worldEnd.x - bone.worldStart.x;
     const dy = bone.worldEnd.y - bone.worldStart.y;
     const length = Math.sqrt(dx*dx + dy*dy);
     if(length < 1) return "";
     const nx = dx / length; const ny = dy / length;
     const px = -ny; const py = nx;
     const x1 = bone.worldStart.x + px * widthStart; const y1 = bone.worldStart.y + py * widthStart;
     const x2 = bone.worldStart.x - px * widthStart; const y2 = bone.worldStart.y - py * widthStart;
     const x3 = bone.worldEnd.x - px * widthEnd; const y3 = bone.worldEnd.y - py * widthEnd;
     const x4 = bone.worldEnd.x + px * widthEnd; const y4 = bone.worldEnd.y + py * widthEnd;
     return `M ${x1} ${y1} L ${x4} ${y4} L ${x3} ${y3} L ${x2} ${y2} Z`;
  };

  return (
    <div className="relative flex-1 bg-[#151515] overflow-hidden" style={{ cursor: getCursor() }}>
       {/* HUD */}
       <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2 pointer-events-none select-none">
          <div className="bg-black/50 backdrop-blur text-xs p-2 rounded border border-white/10 text-white">
             <div className="flex items-center gap-2 mb-1">
               <span className={`font-bold ${mode === ToolMode.SELECT ? 'text-blue-400' : 'text-gray-500'}`}>
                   {mode === ToolMode.SELECT ? (transformMode === 'TRANSLATE' ? 'MOVE / IK [G]' : 'ROTATE [R]') : 'CAMERA'}
               </span>
             </div>
             <div className="text-[10px] text-gray-400">
                 {selection ? `Selected: ${selection.type} ${selection.id}` : 'No Selection'}
             </div>
          </div>
       </div>

       <svg 
         ref={svgRef}
         className="w-full h-full touch-none"
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onWheel={handleWheel}
         style={{ backgroundColor: settings.backgroundColor }}
       >
         <defs>
            <pattern id="grid" width={100 * camera.zoom} height={100 * camera.zoom} patternUnits="userSpaceOnUse">
              <path d={`M ${100 * camera.zoom} 0 L 0 0 0 ${100 * camera.zoom}`} fill="none" stroke="#333" strokeWidth={1} />
            </pattern>
         </defs>
         
         {settings.showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

         <g transform={`
            translate(${window.innerWidth / 2}, ${window.innerHeight / 2}) 
            scale(${camera.zoom}) 
            rotate(${-camera.rotation}) 
            translate(${-camera.x}, ${-camera.y})
         `}>
            {settings.showGrid && (
                <>
                    <line x1="-1000" y1="0" x2="1000" y2="0" stroke="#444" strokeWidth="2" />
                    <line x1="0" y1="-1000" x2="0" y2="1000" stroke="#444" strokeWidth="2" />
                </>
            )}

            {settings.onionSkin && derivedPrevBones && derivedPrevBones.map((bone) => {
                if (bone.visible === false) return null;
                return (
                    <g key={`onion_${bone.id}`} opacity="0.3" pointerEvents="none">
                        <path d={getBonePath(bone, 4, 1)} fill="transparent" stroke="#fff" strokeWidth={1} strokeDasharray="2 2" />
                    </g>
                )
            })}

            {sprites.sort((a,b) => a.zIndex - b.zIndex).map(sprite => {
                // Safe access in case derivedBones is empty
                const bone = derivedBones ? derivedBones.find(b => b.id === sprite.boneId) : null;
                if (!bone || bone.visible === false) return null;
                const isSelected = selection?.type === 'SPRITE' && selection.id === sprite.id;
                const transform = `translate(${bone.worldStart.x}, ${bone.worldStart.y}) rotate(${bone.worldRotation}) translate(${sprite.offsetX}, ${sprite.offsetY}) rotate(${sprite.rotation}) scale(${sprite.scaleX}, ${sprite.scaleY})`;
                return (
                    <g key={sprite.id} transform={transform} style={{ opacity: sprite.opacity }} onMouseDown={(e) => handleObjectMouseDown(e, 'sprite', sprite.id)} className="pointer-events-auto">
                        {isSelected && <rect x="-52" y="-52" width="104" height="104" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />}
                        <image href={sprite.imageUrl} x="-50" y="-50" width="100" height="100" />
                    </g>
                )
            })}

            {settings.showBones && derivedBones && derivedBones.map((bone) => {
               if (bone.visible === false) return null;
               const isSelected = selection?.type === 'BONE' && selection.id === bone.id;
               let boneColor = bone.color || '#a3a3a3';
               let jointColor = '#222';
               let jointStroke = boneColor;
               let jointRadius = 4;

               if (isSelected) {
                   if (transformMode === 'ROTATE') {
                       boneColor = '#3b82f6'; jointColor = '#1d4ed8';
                   } else if (transformMode === 'TRANSLATE') {
                       jointColor = '#fff'; jointStroke = '#3b82f6'; jointRadius = 7;
                   }
               }
               if (bone.locked) { boneColor = '#555'; jointStroke = '#555'; }

               return (
                 <g key={bone.id} onMouseDown={(e) => handleObjectMouseDown(e, 'bone', bone.id)} className={`transition-opacity ${bone.locked ? '' : 'hover:opacity-90'}`}>
                    <path d={getBonePath(bone, 20, 20)} fill="transparent" stroke="transparent" />
                    <path d={getBonePath(bone, 6, 2)} fill={boneColor} stroke="none" opacity={0.9} />
                    <circle cx={bone.worldStart.x} cy={bone.worldStart.y} r={jointRadius} fill={jointColor} stroke={jointStroke} strokeWidth={2} />
                 </g>
               );
            })}
         </g>
       </svg>
    </div>
  );
};
