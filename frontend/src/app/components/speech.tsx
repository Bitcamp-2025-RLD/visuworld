"use client";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
    useSpeechRecognition,
} from "react-speech-recognition";
import { toast } from "sonner";

const LOADING_MESSAGES = [
    "Tracing all the rays...",
    "Working hard on the raymarching...",
    "Showing your world some love...",
    "Sculpting fractals and shapes...",
    "Infusing magic into the pixels...",
];

interface DictaphoneProps {
    generateShader: (prompt: string) => void;
    modifyShader: (prompt: string) => void;
    resetShader: () => void;
    shaderLoading: boolean;
}

const Dictaphone = ({
    generateShader,
    modifyShader,
    resetShader,
    shaderLoading,
}: DictaphoneProps) => {
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition();

    // Tracks whether we have started capturing prompt text
    const [isTranscribing, setIsTranscribing] = useState(false);

    // The partial transcript from the moment we detect "visualize" or "modify"
    const [filteredTranscript, setFilteredTranscript] = useState("");

    // The "active" command we are processing
    const [activeCommand, setActiveCommand] = useState<
        "visualize" | "modify" | null
    >(null);

    // Store the character index in `transcript` where the command begins
    // so we can always slice from there
    const commandStartIndex = useRef<number | null>(null);

    const [hasMounted, setHasMounted] = useState(false);

    // For rotating loading messages
    const [messageIndex, setMessageIndex] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    /**
     * Show rotating LOADING_MESSAGES every 2s if shaderLoading = true.
     * Clear when done.
     */
    useEffect(() => {
        if (shaderLoading) {
            setMessageIndex(0);
            intervalRef.current = setInterval(() => {
                setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
            }, 2000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            toast.success("VisuWorld loaded successfully!");
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [shaderLoading]);

    /**
     * Stop speech recognition while loading. Resume otherwise.
     * Reset any partial states if we get cut off by a new load.
     */
    useEffect(() => {
        if (!browserSupportsSpeechRecognition) return;

        if (shaderLoading) {
            SpeechRecognition.stopListening();
            setIsTranscribing(false);
            setFilteredTranscript("");
            setActiveCommand(null);
            commandStartIndex.current = null;
            resetTranscript();
        } else {
            SpeechRecognition.startListening({ continuous: true });
        }
    }, [shaderLoading, browserSupportsSpeechRecognition, resetTranscript]);

    /**
     * MAIN LOGIC:
     * - Always watch the `transcript` for words "visualize", "modify", or "reset".
     * - If we detect "reset", call resetShader immediately.
     * - If we detect "visualize" or "modify", store where in the transcript that command starts
     *   and from then on, slice out the portion of the transcript after that command.
     * - After 2s of no new additions to the transcript, finalize the prompt.
     */
    useEffect(() => {
        if (!listening || !transcript || shaderLoading) return;

        // Lowercase version for easy searching
        const lower = transcript.toLowerCase();

        // 1) If user says "reset", handle immediately.
        const resetPos = lower.lastIndexOf("reset");
        if (resetPos !== -1) {
            resetShader();
            setIsTranscribing(false);
            setFilteredTranscript("");
            setActiveCommand(null);
            commandStartIndex.current = null;
            resetTranscript();
            return; // done
        }

        // 2) Find last occurrences of "visualize" or "modify"
        const visualizePos = lower.lastIndexOf("visualize");
        const modifyPos = lower.lastIndexOf("modify");

        // The furthest mention is the relevant command
        const lastCommandPos = Math.max(visualizePos, modifyPos);

        // If we haven't started transcribing and we find a new command
        if (!isTranscribing && lastCommandPos !== -1) {
            // Decide which command
            const newCommand =
                visualizePos > modifyPos ? "visualize" : "modify";
            setActiveCommand(newCommand);

            // Remember where in the transcript it started
            commandStartIndex.current = lastCommandPos;
            setIsTranscribing(true);
        }
        // If we *have* started transcribing, check if there's a new command
        else if (isTranscribing && lastCommandPos !== -1) {
            // If user changes mid-sentence
            if (visualizePos > modifyPos && visualizePos !== -1) {
                setActiveCommand("visualize");
                commandStartIndex.current = visualizePos;
            } else if (modifyPos > visualizePos && modifyPos !== -1) {
                setActiveCommand("modify");
                commandStartIndex.current = modifyPos;
            }
        }

        // If isTranscribing is true and we have a commandStartIndex,
        // always slice from that point to keep partial words updated
        if (isTranscribing && commandStartIndex.current !== null) {
            const partial = transcript.slice(commandStartIndex.current);
            setFilteredTranscript(partial.trim());
        }

        // After 2s of no new text, finalize
        const lastLength = transcript.length;
        const timeoutId = setTimeout(() => {
            // If the transcript hasn't changed in 2s and we have something in filteredTranscript
            if (transcript.length === lastLength && filteredTranscript) {
                console.log("Filtered Transcript (Final):", filteredTranscript);

                // Decide which function to call
                if (activeCommand === "visualize") {
                    generateShader(filteredTranscript);
                } else if (activeCommand === "modify") {
                    modifyShader(filteredTranscript);
                }

                // Reset
                setFilteredTranscript("");
                setIsTranscribing(false);
                setActiveCommand(null);
                commandStartIndex.current = null;
                resetTranscript();
            }
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [
        transcript,
        listening,
        shaderLoading,
        isTranscribing,
        filteredTranscript,
        activeCommand,
        generateShader,
        modifyShader,
        resetShader,
        resetTranscript,
    ]);

    if (!hasMounted) return null;

    if (!browserSupportsSpeechRecognition) {
        return <span>Browser doesn't support speech recognition.</span>;
    }

    // If loading, show the spinner + rotating text
    const showLoading = shaderLoading;

    return (
        <div className="relative w-full h-full p-4 flex flex-col justify-start gap-4 text-white rounded-xl">
            <div className="space-y-2">
                <h1 className="text-xl font-extrabold tracking-tight">
                    Welcome to <span className="text-blue-400">VisuWorld</span>{" "}
                    <span className="font-semibold">
                        {listening ? "🎙️" : "❌ (Mic Disabled)"}
                    </span>{" "}
                </h1>
                <p className="text-sm leading-relaxed text-slate-300">
                    Speak visually engaging virtual landscapes into existence.
                    VisuWorld is powered by{" "}
                    <span className="text-blue-400 font-bold">
                        Google Gemini
                    </span>{" "}
                    and customizable{" "}
                    <span className="text-blue-400 font-bold">GLSL</span>{" "}
                    programming paradigms. Peer into the other side of the
                    screen, and let your words shape the world.
                </p>
            </div>

            {/* Bottom overlay: transcript or spinner */}
            <div className="absolute top-[480px] sm:top-auto sm:bottom-4 left-4 right-4">
                {showLoading ? (
                    <div className="flex flex-col gap-2 items-center">
                        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <h2 className="text-lg font-semibold text-slate-200 animate-pulse">
                            {LOADING_MESSAGES[messageIndex]}
                        </h2>
                    </div>
                ) : (
                    <>
                        <div className="bg-slate-700/80 border border-slate-500 shadow rounded-lg px-4 py-2 text-sm text-slate-100 transition-all duration-300 ease-in-out">
                            {filteredTranscript
                                ? `🎨 ${filteredTranscript}`
                                : "🎙️ Listening for a command..."}
                        </div>
                        <div className="text-[0.75rem] text-slate-400 mt-2 -mb-2">
                            (Say "visualize" to create a new VisuWorld, "modify"
                            to adjust it, or "reset" to clear it.)
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dictaphone;
