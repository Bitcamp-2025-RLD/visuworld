import Shader from "@/app/components/shader";

interface ShaderProps {
    vertShader: string;
    fragShader: string;
}
export default function ShaderView({ vertShader, fragShader }: ShaderProps) {
    return (
        <div className="w-full h-full">
            <Shader vertShader={vertShader} fragShader={fragShader}></Shader>
        </div>
    );
}
