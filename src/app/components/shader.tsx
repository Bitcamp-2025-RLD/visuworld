'use client'
import React from 'react'
import * from 'three'


interface ShaderProps {
    vertShader: string,
    fragShader: string,
}
export default function shader(shader_code: ShaderProps) {
    const containerRef = useRef(null);

    useEffect(() => {
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;
  
      // Set up renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      container.appendChild(renderer.domElement);
  
      // Scene and camera
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      camera.position.z = 1;
  
      // Fullscreen plane
      const geometry = new THREE.PlaneGeometry(2, 2);
  
      // Shader material
      const material = new THREE.ShaderMaterial({
        vertexShader: `
          void main() {
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
  
          uniform float u_time;
          uniform vec2 u_resolution;
  
          float sphere(vec3 ro, vec3 rd) {
            vec3 center = vec3(0.0, 0.0, 3.0);
            float radius = 1.0;
            vec3 oc = ro - center;
            float b = dot(oc, rd);
            float c = dot(oc, oc) - radius * radius;
            float h = b * b - c;
            if (h < 0.0) return -1.0;
            return -b - sqrt(h);
          }
  
          void main() {
            vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
            uv.x *= u_resolution.x / u_resolution.y;
  
            vec3 ro = vec3(0.0, 0.0, -5.0);
            vec3 rd = normalize(vec3(uv, 1.0));
  
            float t = sphere(ro, rd);
            vec3 col = vec3(0.0);
  
            if (t > 0.0) {
              col = vec3(1.0, 0.5, 0.2);
            }
  
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        uniforms: {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(width, height) },
        }
      });
  
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
  
      const clock = new THREE.Clock();
  
      const animate = () => {
        material.uniforms.u_time.value = clock.getElapsedTime();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      animate();
  
      // Responsive resizing
      const resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        material.uniforms.u_resolution.value.set(w, h);
      });
      resizeObserver.observe(container);
  
      return () => {
        cancelAnimationFrame(animate);
        container.removeChild(renderer.domElement);
        renderer.dispose();
        resizeObserver.disconnect();
      };
    }, []);
  
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative border border-gray-400"
      />
    );
}