"use client";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
    useSpeechRecognition,
} from "react-speech-recognition";

interface DictaphoneProps {
    generateShader: (prompt: string) => void;
}
const Dictaphone = ({ generateShader }: DictaphoneProps) => {
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
    const [pendingReset, setPendingReset] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const customReset = () => {
        generateShader(filteredTranscript);
        resetTranscript();
    };

    useEffect(() => {
        if (!browserSupportsSpeechRecognition) {
            console.error("Browser doesn't support speech recognition.");
            return;
        }

        SpeechRecognition.startListening({ continuous: true });
    }, [browserSupportsSpeechRecognition]);

    useEffect(() => {
        if (!listening || !transcript) return;

        // Normalize transcript by trimming and splitting on spaces, and convert to lowercase
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
            // only take after the last occurence of "visualize"
            const visualizeIndex = currentWords.lastIndexOf("visualize");
            const afterVisualize = currentWords.slice(visualizeIndex).join(" ");
            setFilteredTranscript(afterVisualize);
            const newWords = currentWords.slice(lastTranscriptLength.current);
            if (newWords.length > 0) {
                // Append new words to the filtered transcript without truncating
                setFilteredTranscript((prev) =>
                    `${prev} ${newWords.join(" ")}`.trim()
                );
            }
            lastTranscriptLength.current = currentWords.length;
        }

        // Set a short timeout for inactivity detection
        const timeoutId = setTimeout(() => {
            if (
                currentWords.length === lastTranscriptLength.current &&
                filteredTranscript
            ) {
                // only grab text past the last occurence of "visualize"
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
                setPendingReset(false);
                lastTranscriptLength.current = 0;

                // Reset transcript after short delay
                customReset();
            }
        }, 2000);

        return () => clearTimeout(timeoutId); // Cleanup timeout
    }, [
        transcript,
        listening,
        filteredTranscript,
        isTranscribing,
        customReset,
    ]);

    if (!hasMounted) return null;

    if (!browserSupportsSpeechRecognition) {
        return <span>Browser doesn't support speech recognition.</span>;
    }

    return (
        <div className="relative w-full h-full p-4 flex flex-col justify-start gap-4 text-white rounded-xl shadow-xl">
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
                <div className="text-sm text-slate-400">
                    (Try saying "visualize" to start, "modify" to change your
                    VisuWorld, or "reset" to clear it)
                </div>
            </div>

            {/* Floating Transcript at Bottom */}
            <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-slate-700/80 border border-slate-500 rounded-lg px-4 py-2 text-sm text-slate-100 shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out">
                    {filteredTranscript
                        ? `🎨 ${filteredTranscript}`
                        : "🎙️ Listening for a command..."}
                </div>
            </div>
        </div>
    );
};

export default Dictaphone;
