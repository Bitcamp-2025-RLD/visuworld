"use client";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
    useSpeechRecognition,
} from "react-speech-recognition";
import { toast } from "sonner";

// Example loading messages
const LOADING_MESSAGES = [
    "Tracing all the rays...",
    "Working hard on the raymarching...",
    "Showing your world some love...",
    "Sculpting fractals and shapes...",
    "Infusing magic into the pixels...",
];

interface DictaphoneProps {
    generateShader: (prompt: string) => void;
    shaderLoading: boolean;
}

const Dictaphone = ({ generateShader, shaderLoading }: DictaphoneProps) => {
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition();

    const [filteredTranscript, setFilteredTranscript] = useState("");
    const [isTranscribing, setIsTranscribing] = useState(false);
    const lastTranscriptLength = useRef(0);
    const [hasMounted, setHasMounted] = useState(false);

    // Index of the message currently displayed while loading
    const [messageIndex, setMessageIndex] = useState(0);
    // A reference to the interval so we can clear it
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    /**
     * LOADING MESSAGES ANIMATION:
     * If shaderLoading is true, cycle through LOADING_MESSAGES every 1 second.
     * If false, clear the interval.
     */
    useEffect(() => {
        if (shaderLoading) {
            // Reset to first message
            setMessageIndex(0);

            // Cycle messages every 1 second
            intervalRef.current = setInterval(() => {
                setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
            }, 2000);
        } else {
            // Loading finished, clear interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            // Optionally show a toast if you like
            toast.success("VisuWorld generated successfully!");
        }

        // Cleanup when unmount or changes
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [shaderLoading]);

    /**
     * STOP/RESUME SPEECH RECOGNITION WHEN LOADING
     */
    useEffect(() => {
        if (!browserSupportsSpeechRecognition) return;

        if (shaderLoading) {
            SpeechRecognition.stopListening();
            setIsTranscribing(false);
            setFilteredTranscript("");
            resetTranscript();
        } else {
            // Resume listening
            SpeechRecognition.startListening({ continuous: true });
        }
    }, [shaderLoading, browserSupportsSpeechRecognition]);

    /**
     * INACTIVITY LOGIC:
     * If no new words for 2s, finalize the prompt.
     */
    useEffect(() => {
        if (!listening || !transcript || shaderLoading) return;

        const currentWords = transcript.trim().toLowerCase().split(/\s+/);

        if (!isTranscribing) {
            const visualizeIndex = currentWords.lastIndexOf("visualize");
            if (visualizeIndex !== -1) {
                const afterVisualize = currentWords
                    .slice(visualizeIndex)
                    .join(" ");
                setFilteredTranscript(afterVisualize);
                setIsTranscribing(true);
                lastTranscriptLength.current = currentWords.length;
            }
        } else {
            const visualizeIndex = currentWords.lastIndexOf("visualize");
            const afterVisualize = currentWords.slice(visualizeIndex).join(" ");
            setFilteredTranscript(afterVisualize);

            // Grab new words since last update
            const newWords = currentWords.slice(lastTranscriptLength.current);
            if (newWords.length > 0) {
                setFilteredTranscript((prev) =>
                    `${prev} ${newWords.join(" ")}`.trim()
                );
            }

            lastTranscriptLength.current = currentWords.length;
        }

        const timeoutId = setTimeout(() => {
            if (
                currentWords.length === lastTranscriptLength.current &&
                filteredTranscript
            ) {
                const lastVisualizeIndex = filteredTranscript
                    .toLowerCase()
                    .lastIndexOf("visualize");
                const finalTranscript =
                    lastVisualizeIndex !== -1
                        ? filteredTranscript.slice(lastVisualizeIndex)
                        : filteredTranscript;

                console.log("Filtered Transcript (Final):", finalTranscript);

                setFilteredTranscript("");
                setIsTranscribing(false);
                lastTranscriptLength.current = 0;
                generateShader(finalTranscript);
                resetTranscript();
            }
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [
        transcript,
        listening,
        filteredTranscript,
        isTranscribing,
        generateShader,
        resetTranscript,
        shaderLoading,
    ]);

    if (!hasMounted) return null;

    if (!browserSupportsSpeechRecognition) {
        return <span>Browser doesn't support speech recognition.</span>;
    }

    // Are we loading? If so, show the fancy spinner + rotating text.
    const showLoading = shaderLoading;

    return (
        <div className="relative w-full h-full p-4 flex flex-col justify-start gap-4 text-white rounded-xl">
            <div className="space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight">
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

            {/* Bottom overlay: either the transcript or a fancy spinner + rotating messages */}
            <div className="absolute bottom-4 left-4 right-4">
                {showLoading ? (
                    <div className="flex flex-col gap-2 items-center">
                        {/* Spinning ring */}
                        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        {/* Animated text cycling every 1 second */}
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
                        <div className="text-sm text-slate-400 mt-2 -mb-2">
                            (Try saying "visualize" to start, "modify" to change
                            your VisuWorld, or "reset" to clear it)
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dictaphone;
