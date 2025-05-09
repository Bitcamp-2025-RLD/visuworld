import { create } from "zustand";
import * as THREE from "three";

interface TextureStore {
  texture: THREE.Texture;
  base64: string;
  setTexture: (data: string) => void;
}

const useTextureStore = create<TextureStore>((set) => ({
  texture: new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat),
  base64: "",
  setTexture: (base64_: string) => {
    set({ base64: base64_ })

    const texture = new THREE.TextureLoader().load(
      base64_,
      () => {
        set({ texture });
      },
      undefined,
      (err) => {
        console.error("Texture loading failed:", err);
      }
    );
  },
}));

export default useTextureStore;