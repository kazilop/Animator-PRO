
import React from 'react';
import { Bone, Sprite, Selection } from '../types';
import { Cuboid, Crosshair, Image as ImageIcon, Trash2 } from 'lucide-react';

interface PropertiesProps {
  selection: Selection | null;
  bones: Bone[];
  sprites: Sprite[];
  updateBone: (id: string, updates: Partial<Bone>) => void;
  updateSprite: (id: string, updates: Partial<Sprite>) => void;
  onAttachSprite: (boneId: string) => void;
  onDelete: () => void;
}

export const Properties: React.FC<PropertiesProps> = ({ 
  selection,
  bones,
  sprites,
  updateBone,
  updateSprite,
  onAttachSprite,
  onDelete
}) => {

  if (!selection) {
    return (
      <div className="w-72 bg-neutral-900 border-l border-neutral-700 p-4 text-neutral-500 text-sm flex flex-col items-center justify-center select-none">
        <Cuboid size={48} className="mb-4 opacity-20" />
        <p>No object selected</p>
        <p className="text-xs mt-2 opacity-50">Press 'V' and click an object</p>
      </div>
    );
  }

  // Render Bone Properties
  if (selection.type === 'BONE') {
      const bone = bones ? bones.find(b => b.id === selection.id) : null;
      if (!bone) return null;

      const attachedSprite = sprites ? sprites.find(s => s.boneId === bone.id) : null;

      return (
        <div className="w-72 bg-neutral-900 border-l border-neutral-700 flex flex-col text-sm overflow-y-auto">
            <div className="bg-neutral-800 p-2 font-bold text-gray-300 flex items-center gap-2">
                <Crosshair size={14} /> BONE PROPERTIES
            </div>
            
            <div className="p-4 space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Name</label>
                    <input 
                        type="text" value={bone.name} 
                        onChange={(e) => updateBone(bone.id, { name: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white outline-none focus:border-blue-500"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Transform</label>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <span className="text-gray-500">Rotation</span>
                        <input 
                            type="number" value={Math.round(bone.rotation)} 
                            onChange={(e) => updateBone(bone.id, { rotation: parseFloat(e.target.value) })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <span className="text-gray-500">Length</span>
                        <input 
                            type="number" value={Math.round(bone.length)} 
                            onChange={(e) => updateBone(bone.id, { length: parseFloat(e.target.value) })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Attachments</label>
                    {!attachedSprite ? (
                        <button 
                            onClick={() => onAttachSprite(bone.id)}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs font-bold"
                        >
                            Attach Sprite
                        </button>
                    ) : (
                        <div className="bg-neutral-800 rounded p-2 flex items-center gap-2">
                            <img src={attachedSprite.imageUrl} className="w-8 h-8 object-contain" alt="icon" />
                            <span className="truncate flex-1">{attachedSprite.name}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
  }

  // Render Sprite Properties
  if (selection.type === 'SPRITE') {
      const sprite = sprites ? sprites.find(s => s.id === selection.id) : null;
      if (!sprite) return null;

      return (
         <div className="w-72 bg-neutral-900 border-l border-neutral-700 flex flex-col text-sm overflow-y-auto">
            <div className="bg-neutral-800 p-2 font-bold text-gray-300 flex items-center gap-2">
                <ImageIcon size={14} /> SPRITE PROPERTIES
            </div>

            <div className="p-4 space-y-6">
                <div className="flex justify-center bg-neutral-800 p-4 rounded border border-neutral-700">
                    <img src={sprite.imageUrl} className="h-32 object-contain" alt="Preview" />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Name</label>
                    <input 
                        type="text" value={sprite.name} 
                        onChange={(e) => updateSprite(sprite.id, { name: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white outline-none focus:border-purple-500"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Transform (Relative)</label>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <span className="text-gray-500">Offset X</span>
                        <input 
                            type="number" value={Math.round(sprite.offsetX)} 
                            onChange={(e) => updateSprite(sprite.id, { offsetX: parseFloat(e.target.value) })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <span className="text-gray-500">Offset Y</span>
                        <input 
                            type="number" value={Math.round(sprite.offsetY)} 
                            onChange={(e) => updateSprite(sprite.id, { offsetY: parseFloat(e.target.value) })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <span className="text-gray-500">Scale</span>
                        <input 
                            type="number" step="0.1" value={sprite.scaleX} 
                            onChange={(e) => updateSprite(sprite.id, { scaleX: parseFloat(e.target.value), scaleY: parseFloat(e.target.value) })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <span className="text-gray-500">Z-Index</span>
                        <input 
                            type="number" value={sprite.zIndex} 
                            onChange={(e) => updateSprite(sprite.id, { zIndex: parseInt(e.target.value) })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white"
                        />
                    </div>
                </div>

                <button 
                    onClick={onDelete}
                    className="w-full py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded flex items-center justify-center gap-2"
                >
                    <Trash2 size={14} /> Delete Sprite
                </button>
            </div>
         </div>
      );
  }

  return null;
};
