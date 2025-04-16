import { TooltipProvider } from "@/components/ui/tooltip";
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

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <title>VisuWorld – Speak Worlds into Reality</title>
                <meta
                    name="description"
                    content="Turn your voice into rich, interactive landscapes using AI-powered GLSL rendering."
                />
                <meta
                    property="og:title"
                    content="VisuWorld – Speak Worlds into Reality"
                />
                <meta
                    property="og:description"
                    content="Turn your voice into rich, interactive landscapes using AI-powered GLSL rendering."
                />
                <meta
                    property="og:image"
                    content="https://create.visuworld.tech/visuworld.png"
                />
                <meta
                    property="og:url"
                    content="https://create.visuworld.tech"
                />
                <meta name="twitter:card" content="summary_large_image" />
                <meta
                    name="twitter:title"
                    content="VisuWorld – Speak Worlds into Reality"
                />
                <meta
                    name="twitter:description"
                    content="Turn your voice into rich, interactive landscapes using AI-powered GLSL rendering."
                />
                <meta
                    name="twitter:image"
                    content="https://create.visuworld.tech/visuworld.png"
                />
                <meta name="theme-color" content="#3641f4" />
            </head>
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
