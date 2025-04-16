"use client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import CodeMirror, { oneDark } from "@uiw/react-codemirror";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ShaderView from "./components/shaderview";
import Dictaphone from "./components/speech";

function Page() {
    const server = "https://api.visuworld.tech";
    const [frag, setFrag] = useState<string>("");
    const [fullScreen, setFullScreen] = useState<boolean>(false);
    const [description, setDescription] = useState<string>("");
    const [prompt, setPrompt] = useState<string>("");
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [saveLoading, setSaveLoading] = useState<boolean>(false);
    const [shaderLoading, setShaderLoading] = useState<boolean>(false);
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const router = useRouter();
    const [isPro, setIsPro] = useState<boolean>(false);

    useEffect(() => {
        async function readShaders() {
            const file = await fetch("/shader.frag");
            const shaderCode = await file.text();
            setFrag(shaderCode);
        }
        readShaders();

        async function getShader() {
            const id = searchParams.get("id");
            if (id != null) {
                const res = await fetch(
                    server + "/retrieve_shader?shader_id=" + id,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                const data = await res.json();
                setFrag(data.code);
            }
        }
        getShader();
    }, []);

    const generateShader = async (prompt: string) => {
        setShaderLoading(true);
        const res = await fetch(server + "/generate_shader", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt, isPro }),
        });
        setPrompt(prompt);
        const data = await res.json();
        setFrag(data.shader);
        setShaderLoading(false);
        await new Promise((resolve) => setTimeout(resolve, 500));
    };

    const modifyShader = async (prompt: string) => {
        setShaderLoading(true);
        const res = await fetch(server + "/modify_shader", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt, code: frag, isPro }),
        });
        const data = await res.json();
        setFrag(data.shader);
        setPrompt(prompt);
        setShaderLoading(false);
    };

    const resetShader = async () => {
        const file = await fetch("/shader.frag");
        const shaderCode = await file.text();
        setFrag(shaderCode);
        setPrompt("");
        setShaderLoading(false);
    };

    return (
        <div className="h-screen overflow-hidden w-screen flex flex-col bg-gray-600 text-gray-900">
            {/* Header */}
            <header className="bg-gray-800 text-white p-6 shadow-md h-[10vh] flex gap-3 items-center justify-between">
                <Link href={"/"}>
                    <div className="flex flex-row gap-1 items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="VisuWorld Logo"
                            width={200}
                            height={200}
                            className="h-14 w-auto"
                        />
                        <div className="text-2xl font-bold">VisuWorld</div>
                    </div>
                </Link>
                <div className="flex gap-4 items-center justify-center">
                    <Button
                        onClick={() => router.push("/gallery")}
                        size={"lg"}
                        className=" transition duration-200 ease-in-out text-xl px-4 py-2 rounded-lg text-white"
                    >
                        Gallery
                    </Button>
                    <Button
                        onClick={() => setFullScreen(!fullScreen)}
                        size={"lg"}
                        className=" transition duration-200 ease-in-out text-xl px-4 py-2 rounded-lg  text-white"
                    >
                        {fullScreen ? "Minimize" : "Fullscreen"}
                    </Button>
                </div>
            </header>

            {/* Grid Layout */}
            <div
                className={`h-[90vh] grid grid-cols-2 grid-rows-5 gap-4 ${
                    !fullScreen && "p-4"
                }`}
            >
                {/* Dictaphone - Top of Left Column */}
                <div className="bg-gray-800 h-full w-full rounded-2xl text-white p-2 border-2 border-gray-900 row-span-2 col-span-1">
                    <Dictaphone
                        generateShader={generateShader}
                        modifyShader={modifyShader}
                        resetShader={resetShader}
                        shaderLoading={shaderLoading}
                    />
                </div>

                {/* Editor - Bottom of Left Column */}
                <div className="bg-gray-800 border-2 border-gray-900 shadow-md rounded-2xl overflow-hidden flex flex-col row-span-3 row-start-3 col-span-1">
                    <div className="flex justify-between items-center">
                        <div className="bg-gray-800 text-white h-full px-4 py-2 gap-4 font-mono text-sm rounded-t-xl flex items-center justify-center">
                            <p className="text-xl">
                                <span className="text-blue-400 font-bold">
                                    Fragment Shader (WebGL)
                                </span>
                            </p>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="airplane-mode"
                                    onCheckedChange={(checked) =>
                                        setIsPro(checked)
                                    }
                                    disabled={true}
                                />
                                <Label htmlFor="airplane-mode text-sm">
                                    2.5 Pro (coming to prod soon...)
                                </Label>
                            </div>
                        </div>
                        <div className="bg-gray-800 text-white px-4 flex gap-4 py-2 font-mono text-sm rounded-t-xl items-center justify-center">
                            <Dialog
                                open={dialogOpen}
                                onOpenChange={setDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        size={"lg"}
                                        onClick={() =>
                                            navigator.clipboard.writeText(frag)
                                        }
                                        className=" text-white px-4 py-2 text-xl rounded-lg"
                                    >
                                        Save
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-gray-800 text-white text-2xl min-w-1/3">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-bold text-white">
                                            Save your VisuWorld!
                                        </DialogTitle>
                                        <DialogDescription className="text-white">
                                            Give your creation a name and
                                            publish to the VisuWorld public
                                            gallery!
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Input
                                        className="bg-gray-900 text-white"
                                        placeholder="Enter a name for your masterpiece..."
                                        onChange={(e) =>
                                            setDescription(e.target.value)
                                        }
                                        disabled={prompt === ""}
                                    />
                                    <DialogFooter>
                                        <div className="flex flex-col items-center justify-center w-full text-center">
                                            <Button
                                                onClick={async () => {
                                                    try {
                                                        setSaveLoading(true);
                                                        const res = await fetch(
                                                            server +
                                                                "/save_shader",
                                                            {
                                                                method: "POST",
                                                                headers: {
                                                                    "Content-Type":
                                                                        "application/json",
                                                                },
                                                                body: JSON.stringify(
                                                                    {
                                                                        description,
                                                                        code: frag,
                                                                        prompt,
                                                                    }
                                                                ),
                                                            }
                                                        );
                                                        await res.json();
                                                        setSaveLoading(false);
                                                        setDialogOpen(false);
                                                        toast.success(
                                                            "VisuWorld saved successfully!"
                                                        );
                                                    } catch (error) {
                                                        setSaveLoading(false);
                                                        toast.error(
                                                            "Error saving VisuWorld... Try again later."
                                                        );
                                                    }
                                                }}
                                                disabled={prompt === ""}
                                                className=" text-white px-4 w-full py-2 rounded-lg text-xl"
                                            >
                                                {saveLoading ? (
                                                    <Loader2 className="animate-spin h-4 w-4" />
                                                ) : (
                                                    <p className="text-xl">
                                                        Save
                                                    </p>
                                                )}
                                            </Button>
                                            {prompt === "" && (
                                                <p className="text-red-500 text-sm mt-2">
                                                    Please prompt a VisuWorld
                                                    before saving. Do not save
                                                    the default render.
                                                </p>
                                            )}
                                        </div>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <div className="overflow-auto">
                        <CodeMirror
                            value={frag}
                            height="100%"
                            theme={oneDark}
                            onChange={(value) => setFrag(value)}
                            extensions={[loadLanguage("c")!]}
                            basicSetup={{
                                syntaxHighlighting: true,
                                closeBrackets: true,
                                highlightActiveLine: true,
                                lineNumbers: true,
                                highlightActiveLineGutter: true,
                                autocompletion: false,
                            }}
                        />
                    </div>
                </div>

                {/* ShaderView - Full Right Column */}
                {frag !== "" && (
                    <div
                        className={`${
                            fullScreen
                                ? "absolute w-screen h-[90vh]"
                                : "rounded-2xl"
                        } w-full  overflow-hidden shadow-md row-span-5 col-start-2 col-span-1 border-2 border-gray-900`}
                    >
                        <ShaderView fragShader={frag} vertShader="" />
                    </div>
                )}
            </div>
        </div>
    );
}

export default Page;
