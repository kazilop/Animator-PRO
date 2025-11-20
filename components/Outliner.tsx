import React from 'react';
import { Bone, Sprite, Selection } from '../types';
import { Bone as BoneIcon, Eye, EyeOff, Lock, Unlock, Image as ImageIcon } from 'lucide-react';

interface OutlinerProps {
  bones: Bone[];
  sprites: Sprite[];
  selection: Selection | null;
  setSelection: (sel: Selection | null) => void;
  toggleVisibility: (id: string, type: 'BONE' | 'SPRITE') => void;
  toggleLock: (id: string) => void;
}

export const Outliner: React.FC<OutlinerProps> = ({ 
  bones, 
  sprites,
  selection, 
  setSelection,
  toggleVisibility,
  toggleLock
}) => {
  // Helper to render tree recursively
  const renderTree = (parentId: string | null, depth: number = 0) => {
    const childrenBones = bones.filter(b => b.parentId === parentId);
    
    // Sprites attached to this bone (only if not root/null unless we want floating sprites later)
    const childrenSprites = parentId ? sprites.filter(s => s.boneId === parentId) : [];

    if (childrenBones.length === 0 && childrenSprites.length === 0 && parentId === null) {
        return <div className="p-4 text-gray-500 text-xs">No objects in scene</div>;
    }

    return (
      <React.Fragment>
        {/* Render Sprites attached to this parent first (or after, depending on preference) */}
        {childrenSprites.map(sprite => (
             <div 
                key={sprite.id}
                className={`
                    flex items-center px-2 py-1 text-xs select-none group border-b border-transparent hover:border-neutral-800
                    ${(selection?.type === 'SPRITE' && selection.id === sprite.id) ? 'bg-purple-900/30 text-purple-100' : 'text-gray-400 hover:bg-neutral-800'}
                `}
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                onClick={() => setSelection({ type: 'SPRITE', id: sprite.id })}
             >
                <ImageIcon size={12} className="mr-2 text-purple-400" />
                <span className="flex-1 truncate">{sprite.name}</span>
                {/* Visibility Toggle for Sprite */}
                {/* Note: We need to implement sprite visibility in data model properly or assume always visible if not handled */}
             </div>
        ))}

        {/* Render Child Bones */}
        {childrenBones.map(child => (
          <div key={child.id}>
            <div 
              className={`
                flex items-center px-2 py-1 text-xs select-none group border-b border-transparent hover:border-neutral-800
                ${(selection?.type === 'BONE' && selection.id === child.id) ? 'bg-blue-900/30 text-blue-100' : 'text-gray-400 hover:bg-neutral-800'}
              `}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => setSelection({ type: 'BONE', id: child.id })}
            >
              <BoneIcon size={12} className={`mr-2 ${(selection?.type === 'BONE' && selection.id === child.id) ? 'opacity-100' : 'opacity-50'}`} />
              <span className="flex-1 truncate">{child.name}</span>
              
              {/* Toggles */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                    onClick={(e) => { e.stopPropagation(); toggleVisibility(child.id, 'BONE'); }}
                    className="p-1 hover:text-white"
                 >
                    {child.visible === false ? <EyeOff size={10} /> : <Eye size={10} />}
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); toggleLock(child.id); }}
                    className="p-1 hover:text-white"
                 >
                    {child.locked ? <Lock size={10} /> : <Unlock size={10} />}
                 </button>
              </div>
            </div>
            {renderTree(child.id, depth + 1)}
          </div>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className="w-56 bg-neutral-900 border-r border-neutral-700 flex flex-col">
      <div className="p-2 border-b border-neutral-700 font-semibold bg-neutral-800 text-[10px] tracking-widest text-gray-400">
        SCENE HIERARCHY
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {renderTree(null)}
      </div>
    </div>
  );
};
