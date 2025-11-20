
import { Bone, DerivedBone, Vector2, AnimationClip, Track, Sprite, EasingType } from './types';

export const degToRad = (deg: number) => (deg * Math.PI) / 180;
export const radToDeg = (rad: number) => (rad * 180) / Math.PI;

export const rotatePoint = (point: Vector2, center: Vector2, angleRad: number): Vector2 => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

// Forward Kinematics: Calculate world positions from local transforms
export const calculateFK = (bones: Bone[]): DerivedBone[] => {
  if (!bones) return [];
  const derived: Record<string, DerivedBone> = {};
  const result: DerivedBone[] = [];

  const processBone = (bone: Bone, parent?: DerivedBone) => {
    const startX = parent ? parent.worldEnd.x : bone.x;
    const startY = parent ? parent.worldEnd.y : bone.y;
    const parentRot = parent ? parent.worldRotation : 0;
    
    const worldRot = parentRot + bone.rotation;
    const angleRad = degToRad(worldRot);

    const endX = startX + Math.cos(angleRad) * bone.length;
    const endY = startY + Math.sin(angleRad) * bone.length;

    const derivedBone: DerivedBone = {
      ...bone,
      worldStart: { x: startX, y: startY },
      worldEnd: { x: endX, y: endY },
      worldRotation: worldRot,
    };

    derived[bone.id] = derivedBone;
    result.push(derivedBone);

    // Process children
    bones.filter(b => b.parentId === bone.id).forEach(child => processBone(child, derivedBone));
  };

  bones.filter(b => b.parentId === null).forEach(root => processBone(root));

  return result;
};

// Inverse Kinematics (CCD Algorithm)
export const solveIK = (bones: Bone[], effectorId: string, target: Vector2): Bone[] => {
    if (!bones) return [];
    const chain: string[] = [];
    let currentId: string | null = effectorId;
    
    // Build chain (Limit to 3 bones up for stability in this simple solver)
    let depth = 0;
    while (currentId && depth < 3) {
        chain.push(currentId);
        const b = bones.find(b => b.id === currentId);
        currentId = b ? b.parentId : null;
        depth++;
    }

    let newBones = [...bones];

    // Run CCD Iterations
    const iterations = 5;
    for (let i = 0; i < iterations; i++) {
        // Iterate from end effector up to root of chain
        for (const boneId of chain) {
            // Recalculate FK for current state
            const derived = calculateFK(newBones);
            const effector = derived.find(b => b.id === effectorId);
            const currentDerived = derived.find(b => b.id === boneId);

            if (!effector || !currentDerived) continue;

            const effectorPos = effector.worldEnd;
            const originPos = currentDerived.worldStart;

            // Vector from pivot to effector
            const toEffector = { x: effectorPos.x - originPos.x, y: effectorPos.y - originPos.y };
            // Vector from pivot to target
            const toTarget = { x: target.x - originPos.x, y: target.y - originPos.y };

            // Angles
            const angEffector = Math.atan2(toEffector.y, toEffector.x);
            const angTarget = Math.atan2(toTarget.y, toTarget.x);
            
            let angleDiff = radToDeg(angTarget - angEffector);

            // Normalize angle
            if (angleDiff > 180) angleDiff -= 360;
            if (angleDiff < -180) angleDiff += 360;

            // Apply rotation to local bone
            newBones = newBones.map(b => {
                if (b.id === boneId && !b.locked) {
                    return { ...b, rotation: b.rotation + angleDiff };
                }
                return b;
            });
        }
    }

    return newBones;
};


// Easing Functions
const easeLinear = (t: number) => t;
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => t * (2 - t);
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

const getEasing = (type: EasingType = 'linear', t: number) => {
    switch (type) {
        case 'ease-in': return easeIn(t);
        case 'ease-out': return easeOut(t);
        case 'ease-in-out': return easeInOut(t);
        default: return easeLinear(t);
    }
};

// Get interpolated value
export const getInterpolatedValue = (track: Track, frame: number): number | null => {
  if (!track || !track.keyframes || !track.keyframes.length) return null;
  
  const keys = [...track.keyframes].sort((a, b) => a.time - b.time);
  
  if (frame <= keys[0].time) return keys[0].value;
  if (frame >= keys[keys.length - 1].time) return keys[keys.length - 1].value;

  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i];
    const k2 = keys[i + 1];
    if (frame >= k1.time && frame < k2.time) {
       let t = (frame - k1.time) / (k2.time - k1.time);
       // Apply easing from the starting keyframe
       t = getEasing(k1.easing, t);
       return k1.value + (k2.value - k1.value) * t;
    }
  }
  return keys[0].value;
};

export const applyAnimation = (bones: Bone[], clip: AnimationClip, frame: number): Bone[] => {
  if (!bones) return [];
  if (!clip || !clip.tracks) return bones;

  return bones.map(bone => {
    const newBone = { ...bone };
    
    const rotTrack = clip.tracks.find(t => t.boneId === bone.id && t.property === 'rotation');
    if (rotTrack) {
       const val = getInterpolatedValue(rotTrack, frame);
       if (val !== null) newBone.rotation = val;
    }

    const xTrack = clip.tracks.find(t => t.boneId === bone.id && t.property === 'x');
    if (xTrack) {
       const val = getInterpolatedValue(xTrack, frame);
       if (val !== null) newBone.x = val;
    }

    const yTrack = clip.tracks.find(t => t.boneId === bone.id && t.property === 'y');
    if (yTrack) {
       const val = getInterpolatedValue(yTrack, frame);
       if (val !== null) newBone.y = val;
    }

    return newBone;
  });
};

export const renderFrameToCanvas = async (
  canvas: HTMLCanvasElement,
  bones: Bone[],
  sprites: Sprite[],
  width: number,
  height: number
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx || !bones || !sprites) return;

  ctx.clearRect(0, 0, width, height);
  const derivedBones = calculateFK(bones);
  const center = { x: width / 2, y: height / 2 };
  const sortedSprites = [...sprites].sort((a, b) => a.zIndex - b.zIndex);

  for (const sprite of sortedSprites) {
    const bone = derivedBones.find(b => b.id === sprite.boneId);
    if (!bone || bone.visible === false) continue;

    const img = new Image();
    img.src = sprite.imageUrl;
    await new Promise((resolve) => {
        if (img.complete) resolve(null);
        else img.onload = () => resolve(null);
    });

    ctx.save();
    ctx.translate(center.x + bone.worldStart.x, center.y + bone.worldStart.y);
    ctx.rotate(degToRad(bone.worldRotation));
    ctx.translate(sprite.offsetX, sprite.offsetY);
    ctx.rotate(degToRad(sprite.rotation));
    ctx.scale(sprite.scaleX, sprite.scaleY);
    ctx.globalAlpha = sprite.opacity;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }
};

// --- Human Rig & Assets ---
export const createHumanRig = (): Bone[] => {
  const c = '#eab308'; const b = '#a3a3a3'; const l = '#60a5fa'; const r = '#f87171';
  return [
    { id: 'hips', parentId: null, name: 'Hips', length: 0, x: 0, y: 0, rotation: -90, color: c },
    { id: 'spine', parentId: 'hips', name: 'Spine', length: 60, x: 0, y: 0, rotation: 0, color: b },
    { id: 'chest', parentId: 'spine', name: 'Chest', length: 60, x: 0, y: 0, rotation: 0, color: b },
    { id: 'neck', parentId: 'chest', name: 'Neck', length: 20, x: 0, y: 0, rotation: 0, color: b },
    { id: 'head', parentId: 'neck', name: 'Head', length: 50, x: 0, y: 0, rotation: 0, color: b },
    { id: 'shoulder_l', parentId: 'chest', name: 'Shoulder L', length: 30, x: 0, y: 0, rotation: 80, color: l },
    { id: 'arm_l_up', parentId: 'shoulder_l', name: 'Upper Arm L', length: 70, x: 0, y: 0, rotation: 10, color: l },
    { id: 'arm_l_low', parentId: 'arm_l_up', name: 'Lower Arm L', length: 60, x: 0, y: 0, rotation: 0, color: l },
    { id: 'hand_l', parentId: 'arm_l_low', name: 'Hand L', length: 20, x: 0, y: 0, rotation: 0, color: l },
    { id: 'shoulder_r', parentId: 'chest', name: 'Shoulder R', length: 30, x: 0, y: 0, rotation: -80, color: r },
    { id: 'arm_r_up', parentId: 'shoulder_r', name: 'Upper Arm R', length: 70, x: 0, y: 0, rotation: -10, color: r },
    { id: 'arm_r_low', parentId: 'arm_r_up', name: 'Lower Arm R', length: 60, x: 0, y: 0, rotation: 0, color: r },
    { id: 'hand_r', parentId: 'arm_r_low', name: 'Hand R', length: 20, x: 0, y: 0, rotation: 0, color: r },
    { id: 'thigh_l', parentId: 'hips', name: 'Thigh L', length: 80, x: 0, y: 0, rotation: 170, color: l },
    { id: 'shin_l', parentId: 'thigh_l', name: 'Shin L', length: 80, x: 0, y: 0, rotation: 0, color: l },
    { id: 'foot_l', parentId: 'shin_l', name: 'Foot L', length: 30, x: 0, y: 0, rotation: 90, color: l },
    { id: 'thigh_r', parentId: 'hips', name: 'Thigh R', length: 80, x: 0, y: 0, rotation: -170, color: r },
    { id: 'shin_r', parentId: 'thigh_r', name: 'Shin R', length: 80, x: 0, y: 0, rotation: 0, color: r },
    { id: 'foot_r', parentId: 'shin_r', name: 'Foot R', length: 30, x: 0, y: 0, rotation: 90, color: r },
  ];
};

const createSVGDataURL = (svgString: string) => `data:image/svg+xml;base64,${btoa(svgString)}`;

export const createDummySprites = (): Sprite[] => {
    const sprites: Sprite[] = [];
    const fill = "#fca5a5"; const stroke = "#b91c1c";
    const headSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="${fill}" stroke="${stroke}" stroke-width="2"/><rect x="30" y="35" width="10" height="10" fill="#333"/><rect x="60" y="35" width="10" height="10" fill="#333"/><path d="M35 70 Q50 85 65 70" stroke="#333" stroke-width="3" fill="none"/></svg>`;
    const bodySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="20" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    const limbSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="20" y="5" width="60" height="90" rx="30" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    const headUrl = createSVGDataURL(headSVG); const bodyUrl = createSVGDataURL(bodySVG); const limbUrl = createSVGDataURL(limbSVG);
    const makeSprite = (id: string, boneId: string, name: string, url: string, scaleX=1, scaleY=1, offX=0, offY=0, rotation=-90, zIndex=10) => ({ id, boneId, name, imageUrl: url, offsetX: offX, offsetY: offY, rotation, scaleX, scaleY, opacity: 1, zIndex });
    sprites.push(makeSprite('s_head', 'head', 'Head', headUrl, 1.2, 1.2, 25, 0, -90, 20));
    sprites.push(makeSprite('s_chest', 'chest', 'Chest', bodyUrl, 1.2, 0.8, 30, 0, -90, 15));
    sprites.push(makeSprite('s_spine', 'spine', 'Abdomen', bodyUrl, 1.0, 0.8, 30, 0, -90, 14));
    sprites.push(makeSprite('s_hips', 'hips', 'Hips', bodyUrl, 0.8, 0.6, 0, 0, 0, 14));
    sprites.push(makeSprite('s_arm_l_up', 'arm_l_up', 'L Upper Arm', limbUrl, 1.0, 0.4, 35, 0, -90, 12));
    sprites.push(makeSprite('s_arm_l_low', 'arm_l_low', 'L Forearm', limbUrl, 0.9, 0.35, 30, 0, -90, 12));
    sprites.push(makeSprite('s_arm_r_up', 'arm_r_up', 'R Upper Arm', limbUrl, 1.0, 0.4, 35, 0, -90, 12));
    sprites.push(makeSprite('s_arm_r_low', 'arm_r_low', 'R Forearm', limbUrl, 0.9, 0.35, 30, 0, -90, 12));
    sprites.push(makeSprite('s_thigh_l', 'thigh_l', 'L Thigh', limbUrl, 1.2, 0.5, 40, 0, -90, 11));
    sprites.push(makeSprite('s_shin_l', 'shin_l', 'L Shin', limbUrl, 1.1, 0.45, 40, 0, -90, 11));
    sprites.push(makeSprite('s_thigh_r', 'thigh_r', 'R Thigh', limbUrl, 1.2, 0.5, 40, 0, -90, 10));
    sprites.push(makeSprite('s_shin_r', 'shin_r', 'R Shin', limbUrl, 1.1, 0.45, 40, 0, -90, 10));
    return sprites;
};

export const createWalkCycle = (): AnimationClip => {
  const tracks: Track[] = [
    { boneId: 'hips', property: 'y', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 12, value: -5, easing: 'linear' }, { time: 24, value: 0, easing: 'linear' }, { time: 36, value: -5, easing: 'linear' }, { time: 48, value: 0, easing: 'linear' }, { time: 60, value: -5, easing: 'linear' }, { time: 72, value: 0, easing: 'linear' }, { time: 84, value: -5, easing: 'linear' }, { time: 96, value: 0, easing: 'linear' }] },
    { boneId: 'thigh_l', property: 'rotation', keyframes: [{ time: 0, value: 170, easing: 'linear' }, { time: 24, value: 210, easing: 'linear' }, { time: 48, value: 170, easing: 'linear' }, { time: 72, value: 130, easing: 'linear' }, { time: 96, value: 170, easing: 'linear' }] },
    { boneId: 'shin_l', property: 'rotation', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 24, value: 0, easing: 'linear' }, { time: 36, value: 40, easing: 'linear' }, { time: 48, value: 0, easing: 'linear' }, { time: 72, value: 10, easing: 'linear' }, { time: 96, value: 0, easing: 'linear' }] },
    { boneId: 'foot_l', property: 'rotation', keyframes: [{ time: 0, value: 90, easing: 'linear' }, { time: 24, value: 70, easing: 'linear' }, { time: 48, value: 90, easing: 'linear' }, { time: 72, value: 110, easing: 'linear' }, { time: 96, value: 90, easing: 'linear' }] },
    { boneId: 'thigh_r', property: 'rotation', keyframes: [{ time: 0, value: -170, easing: 'linear' }, { time: 24, value: -130, easing: 'linear' }, { time: 48, value: -170, easing: 'linear' }, { time: 72, value: -210, easing: 'linear' }, { time: 96, value: -170, easing: 'linear' }] },
    { boneId: 'shin_r', property: 'rotation', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 12, value: -10, easing: 'linear' }, { time: 24, value: 0, easing: 'linear' }, { time: 48, value: 0, easing: 'linear' }, { time: 72, value: 0, easing: 'linear' }, { time: 84, value: -40, easing: 'linear' }, { time: 96, value: 0, easing: 'linear' }] },
    { boneId: 'foot_r', property: 'rotation', keyframes: [{ time: 0, value: 90, easing: 'linear' }, { time: 24, value: 110, easing: 'linear' }, { time: 48, value: 90, easing: 'linear' }, { time: 72, value: 70, easing: 'linear' }, { time: 96, value: 90, easing: 'linear' }] },
    { boneId: 'shoulder_l', property: 'rotation', keyframes: [ { time: 0, value: 80, easing: 'linear' }, { time: 24, value: 60, easing: 'linear' }, { time: 48, value: 80, easing: 'linear' }, { time: 72, value: 100, easing: 'linear' }, { time: 96, value: 80, easing: 'linear' } ] },
    { boneId: 'shoulder_r', property: 'rotation', keyframes: [ { time: 0, value: -80, easing: 'linear' }, { time: 24, value: -100, easing: 'linear' }, { time: 48, value: -80, easing: 'linear' }, { time: 72, value: -60, easing: 'linear' }, { time: 96, value: -80, easing: 'linear' } ] }
  ];
  return { id: 'walk', name: 'Walk Cycle', duration: 96, fps: 24, tracks };
};
