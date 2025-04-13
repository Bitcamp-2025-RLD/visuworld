"use client";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
    useSpeechRecognition,
} from "react-speech-recognition";

const Dictaphone = () => {
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
            console.log(transcript);
            setFilteredTranscript(transcript);
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
                resetTranscript();
            }
        }, 2000);

        return () => clearTimeout(timeoutId); // Cleanup timeout
    }, [
        transcript,
        listening,
        filteredTranscript,
        isTranscribing,
        resetTranscript,
    ]);

    if (!hasMounted) return null;

    if (!browserSupportsSpeechRecognition) {
        return <span>Browser doesn't support speech recognition.</span>;
    }

    return (
        <div>
            <p>Listening: {listening ? "Yes 🎙️" : "No ❌"}</p>
            <p>
                Filtered Transcript:{" "}
                {filteredTranscript || "Waiting for 'visualize'..."}
            </p>
        </div>
    );
};

export default Dictaphone;
