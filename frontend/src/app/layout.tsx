import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: new URL("https://create.visuworld.tech"),
    title: "VisuWorld – Speak Visual Worlds into Reality",
    description:
        "Turn your voice into rich, interactive landscapes using AI-powered GLSL rendering.",
    openGraph: {
        title: "VisuWorld – Speak Visual Worlds into Reality",
        description:
            "Turn your voice into rich, interactive landscapes using AI-powered GLSL rendering.",
        url: "https://create.visuworld.tech",
        images: [
            {
                url: "/visuworld.png",
                alt: "VisuWorld Preview Image",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "VisuWorld – Speak Visual Worlds into Reality",
        description:
            "Turn your voice into rich, interactive landscapes using AI-powered GLSL rendering.",
        images: ["/visuworld.png"],
    },
};

export const viewport: Viewport = {
    themeColor: "#3641f4",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <TooltipProvider>
                <body
                    className={`${geistSans.variable} ${geistMono.variable} bg-gray-600 antialiased h-screen w-screen overflow-x-hidden`}
                >
                    <Suspense>{children}</Suspense>
                    <Toaster richColors={true} />
                </body>
            </TooltipProvider>
        </html>
    );
}
