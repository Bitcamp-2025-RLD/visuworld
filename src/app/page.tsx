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
import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import CodeMirror, { oneDark } from "@uiw/react-codemirror";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ShaderView from "./components/shaderview";
import Dictaphone from "./components/speech";

function Page() {
    const server = "http://localhost:8000";
    const [frag, setFrag] = useState<string>("");
    const [fullScreen, setFullScreen] = useState<boolean>(false);
    const [description, setDescription] = useState<string>("");
    const [prompt, setPrompt] = useState<string>("");
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [saveLoading, setSaveLoading] = useState<boolean>(false);

    useEffect(() => {
        async function readShaders() {
            const file = await fetch("/shader.frag");
            const shaderCode = await file.text();
            setFrag(shaderCode);
        }
        readShaders();
    }, []);

    const generateShader = async (prompt: string) => {
        const res = await fetch(server + "/generate_shader", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: prompt }),
        });
        setPrompt(prompt);
        const data = await res.json();
        console.log(data);
        setFrag(data.shader);
    };

    return (
        <div className="h-screen overflow-hidden w-screen flex flex-col bg-gray-600 text-gray-900">
            {/* Header */}
            <header className=" bg-gray-800 text-white p-6 shadow-md h-[10vh] flex gap-3 items-center justify-between">
                <h1 className="text-xl font-bold">🧪 VisuWorld</h1>
                <Button
                    onClick={() => setFullScreen(!fullScreen)}
                    size={"lg"}
                    className="hover:bg-gray-700 transition duration-200 ease-in-out text-xl px-4 py-2 rounded-lg bg-gray-950 text-white"
                >
                    {fullScreen ? "Fullscreen" : "Minimized"}
                </Button>
            </header>

            {/* Grid Layout */}
            <div
                className={`h-[90vh] grid grid-cols-2 grid-rows-3 gap-4 ${
                    !fullScreen && "p-4"
                }`}
            >
                <div className="bg-gray-800 h-full w-full rounded-2xl text-white p-2 border-2 border-gray-900">
                    <Dictaphone generateShader={generateShader}></Dictaphone>
                </div>
                {/* Editor */}
                <div className="bg-gray-800 border-2 border-gray-900 shadow-md rounded-2xl overflow-hidden flex flex-col row-start-2 row-span-2">
                    <div className="flex justify-between items-center">
                        <div className="bg-gray-800 text-white h-full px-4 py-2 font-mono text-sm rounded-t-xl flex items-center justify-center">
                            <p className="text-xl">Fragment Shader</p>
                        </div>
                        <div className="bg-gray-800 text-white px-4 py-2 font-mono text-sm rounded-t-xl items-center justify-center">
                            <Dialog
                                open={dialogOpen}
                                onOpenChange={setDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        size={"lg"}
                                        onClick={() => {
                                            navigator.clipboard.writeText(frag);
                                        }}
                                        className="bg-black text-white px-4 py-2 text-xl rounded-lg"
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
                                            Give your description a name and
                                            publish to the VisuWorld public
                                            gallery!
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Input
                                        className="bg-gray-900 text-white"
                                        placeholder="Enter a name for your masterpiece"
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                        }}
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
                                                                        description:
                                                                            description,
                                                                        code: frag,
                                                                        prompt: prompt,
                                                                    }
                                                                ),
                                                            }
                                                        );
                                                        const data =
                                                            await res.json();
                                                        console.log(data);
                                                        setSaveLoading(false);
                                                        setDialogOpen(false);
                                                        toast.success(
                                                            "VisuWorld successfully!"
                                                        );
                                                    } catch (error) {
                                                        setSaveLoading(false);
                                                        toast.error(
                                                            `Error saving VisuWorld... Try again later.`
                                                        );
                                                    }
                                                }}
                                                disabled={prompt === ""}
                                                className="bg-black text-white px-4 w-full py-2 rounded-lg text-xl"
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
                {frag !== "" && (
                    <div
                        className={`${
                            fullScreen
                                ? "absolute w-screen h-[90vh]"
                                : "rounded-2xl"
                        } w-full bg-black  overflow-hidden shadow-md row-span-3 border-2 border-gray-900`}
                    >
                        <ShaderView fragShader={frag} vertShader="" />
                    </div>
                )}
            </div>
        </div>
    );
}

export default Page;
