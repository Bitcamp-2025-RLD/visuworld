"use client"
import Shader from "@/app/components/shader";
import { useRef, useState } from "react";

interface ShaderProps {
    vertShader: string;
    fragShader: string;
    base64_texture: string | null;
}
export default function ShaderView({ vertShader, fragShader, base64_texture }: ShaderProps) {
    const mouseRef = useRef({x: 0, y: 0});

    const handleMouseMove = (event: { clientX: any; clientY: any; }) => {
        mouseRef.current = {x: event.clientX, y: event.clientY};
    };

    return (
        <div onMouseMove={handleMouseMove} className="w-full h-full rounded-xl">
            <Shader vertShader={vertShader} fragShader={fragShader} iMouse={mouseRef} base64_texture={base64_texture}></Shader>
        </div>
    );
}
