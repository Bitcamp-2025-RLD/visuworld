'use client'
import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'


interface ShaderProps {
    vertShader: string;
    fragShader: string;
}
export default function Shader({vertShader, fragShader}: ShaderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useEffect(() => {
      const container = containerRef.current;
      const width = container!.clientWidth;
      const height = container!.clientHeight;
  
      // Set up renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      container!.appendChild(renderer.domElement);
  
      // Scene and camera
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      camera.position.z = 1;
  
      // Fullscreen plane
      const geometry = new THREE.PlaneGeometry(2, 2);
  
      // Shader material
      const material = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 fragCoord;

            void main() {
                gl_Position = vec4(position, 1.0);
                fragCoord = position.xy;
            }
        `,
        fragmentShader: fragShader,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new THREE.Vector2(width, height) },
        }
      });
      materialRef.current = material;
  
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
  
      const clock = new THREE.Clock();
  
      const animate = () => {
        material.uniforms.iTime.value = clock.getElapsedTime();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      animate();
  
      // Responsive resizing
      const resizeObserver = new ResizeObserver(() => {
        const w = container!.clientWidth;
        const h = container!.clientHeight;
        renderer.setSize(w, h);
        material.uniforms.iResolution.value.set(w, h);
      });
      resizeObserver.observe(container!);
  
      return () => {
        cancelAnimationFrame(animate);
        container!.removeChild(renderer.domElement);
        renderer.dispose();
        resizeObserver.disconnect();
      };
    }, []);

    useEffect(() => {
      if (materialRef.current) {
        materialRef.current.fragmentShader = fragShader;
        materialRef.current.needsUpdate = true;
      }
    }, [fragShader]);
  
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative border border-gray-400"
      />
    );
}