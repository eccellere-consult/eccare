import { useEffect, useState } from 'react';
import * as THREE from 'three';

// Arya from a photograph. public/avatars/arya.webp (a light copy, tried first) or
// arya.png is warped and painted to blink, speak and sway — see arya-photo-figure.tsx.
// With no photo, the next choices are a photoreal GLB or the built-in procedural Arya.

export const ARYA_PHOTO_URLS = process.env.NEXT_PUBLIC_ARYA_PHOTO_URL
  ? [process.env.NEXT_PUBLIC_ARYA_PHOTO_URL]
  : ['/avatars/arya.webp', '/avatars/arya.png'];

export type AryaPhoto = { status: 'loading' | 'none' } | { status: 'ready'; texture: THREE.Texture };

let pending: Promise<THREE.Texture | null> | null = null;

function loadAryaPhoto(): Promise<THREE.Texture | null> {
  pending ??= (async () => {
    const loader = new THREE.TextureLoader();
    for (const url of ARYA_PHOTO_URLS) {
      try {
        const texture = await loader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
      } catch {
        // try the next candidate
      }
    }
    return null;
  })();
  return pending;
}

export function useAryaPhoto(): AryaPhoto {
  const [photo, setPhoto] = useState<AryaPhoto>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    void loadAryaPhoto().then((texture) => {
      if (alive) setPhoto(texture ? { status: 'ready', texture } : { status: 'none' });
    });
    return () => {
      alive = false;
    };
  }, []);
  return photo;
}
