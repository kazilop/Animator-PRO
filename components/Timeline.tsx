
import React, { useRef, useEffect, useState } from 'react';
import { TimelineMode, AnimationClip, EasingType, Bone } from '../types';
import { Play, Pause, PlusCircle, ZoomIn, ZoomOut, CircleDot, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface TimelineProps {
  mode: TimelineMode;
  setMode: (m: TimelineMode) => void;
  currentFrame: number;
  setCurrentFrame: (f: number) => void;
  clip: AnimationClip;
  updateClip: (clip: AnimationClip) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  addKeyframe: () => void;
  autoKey: boolean;
  toggleAutoKey: () => void;
  bones: Bone[];
}

export const Timeline: React.FC<TimelineProps> = ({
  mode,
  setMode,
  currentFrame,
  setCurrentFrame,
  clip,
  updateClip,
  isPlaying,
  setIsPlaying,
  addKeyframe,
  autoKey,
  toggleAutoKey,
  bones
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, trackIdx: number, keyTime: number} | null>(null);
  
  // Dragging State
  const [draggingKey, setDraggingKey] = useState<{ trackIdx: number, keyIndex: number } | null>(null);

  const FRAME_WIDTH = 12 * zoom;
  const HEADER_HEIGHT = 30;
  const ROW_HEIGHT = 24;
  const SIDEBAR_WIDTH = 160;

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tracksCount = clip?.tracks?.length || 0;

      canvas.width = wrapper.clientWidth;
      canvas.height = Math.max(wrapper.clientHeight, HEADER_HEIGHT + tracksCount * ROW_HEIGHT + 50);
      
      const width = canvas.width;
      const height = canvas.height;

      // Background
      ctx.fillStyle = '#171717';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid (Offset by sidebar)
      ctx.strokeStyle = '#262626';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const visibleFrames = Math.ceil((width - SIDEBAR_WIDTH) / FRAME_WIDTH);

      for (let i = 0; i <= visibleFrames; i++) {
        const x = SIDEBAR_WIDTH + i * FRAME_WIDTH;
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        
        if (i % 5 === 0) {
          ctx.fillStyle = '#525252';
          ctx.font = '9px sans-serif';
          ctx.fillText(i.toString(), x + 2, 12);
        }
      }
      ctx.stroke();

      if (mode === TimelineMode.CLIP && clip && clip.tracks) {
        // Active Duration Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(SIDEBAR_WIDTH, 0, clip.duration * FRAME_WIDTH, height);

        clip.tracks.forEach((track, idx) => {
            const y = HEADER_HEIGHT + (idx * ROW_HEIGHT);
            const boneName = bones ? (bones.find(b => b.id === track.boneId)?.name || track.boneId) : track.boneId;

            // Sidebar Row Background
            ctx.fillStyle = idx % 2 === 0 ? '#202020' : '#1a1a1a';
            ctx.fillRect(0, y, SIDEBAR_WIDTH, ROW_HEIGHT);
            
            // Track Name
            ctx.fillStyle = '#a3a3a3';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${boneName} (${track.property})`, 10, y + 16);

            // Timeline Row Background
            if (idx % 2 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                ctx.fillRect(SIDEBAR_WIDTH, y, width - SIDEBAR_WIDTH, ROW_HEIGHT);
            }
            
            // Horizontal divider
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(0, y + ROW_HEIGHT);
            ctx.lineTo(width, y + ROW_HEIGHT);
            ctx.stroke();

            // Draw Tween Lines
            if (track.keyframes && track.keyframes.length > 1) {
                const sortedKeys = [...track.keyframes].sort((a, b) => a.time - b.time);
                ctx.strokeStyle = '#4ade80';
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                for(let i=0; i<sortedKeys.length-1; i++) {
                    const k1 = sortedKeys[i];
                    const k2 = sortedKeys[i+1];
                    const x1 = SIDEBAR_WIDTH + k1.time * FRAME_WIDTH + (FRAME_WIDTH/2);
                    const x2 = SIDEBAR_WIDTH + k2.time * FRAME_WIDTH + (FRAME_WIDTH/2);
                    const cy = y + (ROW_HEIGHT/2);
                    ctx.moveTo(x1, cy);
                    ctx.lineTo(x2, cy);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // Draw Keyframes
            if (track.keyframes) {
                track.keyframes.forEach(kf => {
                    const kx = SIDEBAR_WIDTH + kf.time * FRAME_WIDTH + (FRAME_WIDTH / 2);
                    const ky = y + (ROW_HEIGHT / 2);
                    
                    // Diamond Shape
                    ctx.fillStyle = '#d8b4fe'; // Purple
                    ctx.beginPath();
                    ctx.moveTo(kx, ky - 4);
                    ctx.lineTo(kx + 4, ky);
                    ctx.lineTo(kx, ky + 4);
                    ctx.lineTo(kx - 4, ky);
                    ctx.fill();

                    // Easing indicator (small dot color change if not linear)
                    if (kf.easing !== 'linear') {
                        ctx.fillStyle = '#facc15'; // Yellow dot
                        ctx.beginPath();
                        ctx.arc(kx, ky, 1, 0, Math.PI*2);
                        ctx.fill();
                    }
                });
            }
        });
      }
      
      // Playhead
      const playheadX = SIDEBAR_WIDTH + currentFrame * FRAME_WIDTH + (FRAME_WIDTH/2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 10);
      ctx.fill();
    };

    render();
  }, [currentFrame, mode, clip, zoom, wrapperRef.current?.clientWidth, wrapperRef.current?.clientHeight, bones]);

  // --- Mouse Handlers ---

  const getTrackAndFrame = (e: React.MouseEvent) => {
     const rect = canvasRef.current?.getBoundingClientRect();
     if (!rect) return null;
     const x = e.clientX - rect.left;
     const y = e.clientY - rect.top;

     if (x < SIDEBAR_WIDTH) return null; // Clicked sidebar

     const frame = Math.round((x - SIDEBAR_WIDTH) / FRAME_WIDTH);
     const trackIdx = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);

     return { frame: Math.max(0, frame), trackIdx };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      const pos = getTrackAndFrame(e);
      if (!pos) return;

      // Check if clicked on keyframe
      if (clip && clip.tracks && pos.trackIdx >= 0 && pos.trackIdx < clip.tracks.length) {
          const track = clip.tracks[pos.trackIdx];
          if (track.keyframes) {
            const keyIndex = track.keyframes.findIndex(k => Math.abs(k.time - pos.frame) < 1); // Tolerance

            if (keyIndex !== -1) {
                setDraggingKey({ trackIdx: pos.trackIdx, keyIndex });
                return;
            }
          }
      }
      
      // Otherwise seek
      setCurrentFrame(pos.frame);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (draggingKey) {
          const pos = getTrackAndFrame(e);
          if (!pos) return;
          
          const newClip = { ...clip };
          const track = newClip.tracks[draggingKey.trackIdx];
          const key = track.keyframes[draggingKey.keyIndex];
          
          // Avoid duplicate keys on same frame (unless it's the one we are dragging)
          if (!track.keyframes.some((k, i) => i !== draggingKey.keyIndex && k.time === pos.frame)) {
              key.time = pos.frame;
              updateClip(newClip);
          }
      } else if (e.buttons === 1) {
          // Scrubbing
          const pos = getTrackAndFrame(e);
          if (pos) setCurrentFrame(pos.frame);
      }
  };

  const handleMouseUp = () => {
      setDraggingKey(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      const pos = getTrackAndFrame(e);
      if (!pos) return;

      if (clip && clip.tracks && pos.trackIdx >= 0 && pos.trackIdx < clip.tracks.length) {
          const track = clip.tracks[pos.trackIdx];
          if (track.keyframes) {
             const key = track.keyframes.find(k => Math.abs(k.time - pos.frame) < 1);
             if (key) {
                setContextMenu({ x: e.clientX, y: e.clientY, trackIdx: pos.trackIdx, keyTime: key.time });
             }
          }
      }
  };

  const changeEasing = (easing: EasingType) => {
      if (!contextMenu) return;
      const newClip = { ...clip };
      const track = newClip.tracks[contextMenu.trackIdx];
      const key = track.keyframes.find(k => k.time === contextMenu.keyTime);
      if (key) {
          key.easing = easing;
          updateClip(newClip);
      }
      setContextMenu(null);
  };

  const deleteKeyframe = () => {
      if (!contextMenu) return;
      const newClip = { ...clip };
      const track = newClip.tracks[contextMenu.trackIdx];
      track.keyframes = track.keyframes.filter(k => k.time !== contextMenu.keyTime);
      updateClip(newClip);
      setContextMenu(null);
  };

  return (
    <>
    {/* Collapse/Expand Tab */}
    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-40">
       {collapsed && (
           <button onClick={() => setCollapsed(false)} className="bg-neutral-800 border border-neutral-600 rounded-t px-4 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-1">
               <ChevronUp size={12} /> Show Timeline
           </button>
       )}
    </div>

    <div 
      className={`flex flex-col border-t border-neutral-700 bg-neutral-900 select-none transition-all duration-300 ease-in-out ${collapsed ? 'h-0 overflow-hidden' : 'h-72'}`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center space-x-4">
           {/* Collapse Button */}
           <button onClick={() => setCollapsed(true)} className="text-gray-500 hover:text-white">
               <ChevronDown size={14} />
           </button>

           <div className="flex bg-neutral-900 rounded p-0.5">
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 hover:bg-neutral-800 rounded text-white">
                    {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                </button>
           </div>
           
           <div className="flex items-center space-x-2 text-xs">
             <div className="flex flex-col">
                <span className="text-[9px] text-gray-500">FRAME</span>
                <input 
                    type="number" 
                    value={Math.round(currentFrame)} 
                    onChange={(e) => setCurrentFrame(Math.max(0, parseInt(e.target.value)))}
                    className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1 text-blue-400 font-mono"
                />
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] text-gray-500">FPS</span>
                <input 
                    type="number" 
                    value={clip.fps} 
                    onChange={(e) => updateClip({ ...clip, fps: parseInt(e.target.value) })}
                    className="w-10 bg-neutral-900 border border-neutral-700 rounded px-1 text-gray-300"
                />
             </div>
           </div>
        </div>

        <div className="flex items-center space-x-2">
            {/* AutoKey with Commit */}
            <div className="flex items-center bg-neutral-900 rounded border border-neutral-700 overflow-hidden">
                <button 
                    onClick={toggleAutoKey}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${autoKey ? 'bg-red-900/50 text-red-400' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Auto-Keyframe"
                >
                    <CircleDot size={12} className={autoKey ? 'fill-red-500 text-red-500' : ''} /> 
                    REC
                </button>
                {autoKey && (
                    <button 
                        onClick={() => toggleAutoKey()} 
                        className="px-2 py-1 bg-green-900/50 hover:bg-green-800 text-green-400 border-l border-neutral-700"
                        title="Commit & Stop Recording"
                    >
                        <CheckCircle size={12} />
                    </button>
                )}
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 mr-4 text-gray-400">
                <ZoomOut size={12} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="cursor-pointer hover:text-white" />
                <span className="text-[10px] w-6 text-center">{Math.round(zoom*100)}%</span>
                <ZoomIn size={12} onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="cursor-pointer hover:text-white" />
            </div>

             <button 
                onClick={addKeyframe}
                className="flex items-center gap-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-xs rounded text-white"
            >
                <PlusCircle size={12} /> Keyframe
            </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden" ref={wrapperRef}>
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 block cursor-pointer"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
          />
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="fixed bg-neutral-800 border border-neutral-600 shadow-xl rounded z-50 py-1 text-xs text-gray-200"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
              <div className="px-3 py-1 text-gray-500 font-bold border-b border-neutral-700 mb-1">Interpolation</div>
              <button className="block w-full text-left px-3 py-1 hover:bg-blue-600" onClick={() => changeEasing('linear')}>Linear</button>
              <button className="block w-full text-left px-3 py-1 hover:bg-blue-600" onClick={() => changeEasing('ease-in')}>Ease In (Quad)</button>
              <button className="block w-full text-left px-3 py-1 hover:bg-blue-600" onClick={() => changeEasing('ease-out')}>Ease Out (Quad)</button>
              <button className="block w-full text-left px-3 py-1 hover:bg-blue-600" onClick={() => changeEasing('ease-in-out')}>Ease In Out</button>
              <div className="h-px bg-neutral-700 my-1"></div>
              <button className="block w-full text-left px-3 py-1 hover:bg-red-900 text-red-300" onClick={deleteKeyframe}>Delete Keyframe</button>
              <button className="block w-full text-left px-3 py-1 hover:bg-neutral-700" onClick={() => setContextMenu(null)}>Cancel</button>
          </div>
      )}

      {/* Drag overlay if dragging */}
      {draggingKey && (
          <div className="fixed inset-0 z-50 cursor-ew-resize" onMouseMove={handleMouseMove as any} onMouseUp={handleMouseUp}></div>
      )}
    </div>
    </>
  );
};
