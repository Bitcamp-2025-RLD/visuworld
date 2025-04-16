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
