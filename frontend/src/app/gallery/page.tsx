"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { redirect, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ShaderView from "../components/shaderview";

export default function Gallery() {
    const params = useSearchParams();
    const page = params.get("page_number");
    if (!page) {
        redirect("/gallery?page_number=1");
    }
    const serverURL = "https://api.visuworld.tech";
    const [results, setResults] = useState([]);
    const [nextResults, setNextResults] = useState([]);
    useEffect(() => {
        const fetchShaders = async () => {
            const response = await fetch(
                `${serverURL}/retrieve_shaders?page=${page}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            const data = await response.json();
            console.log(data.shaders);
            setResults(data.shaders);
        };
        const testNextShaders = async () => {
            const response = await fetch(
                `${serverURL}/retrieve_shaders?page=${parseInt(page) + 1}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            const data = await response.json();
            console.log(data.shaders);
            setNextResults(data.shaders);
        };
        testNextShaders();
        fetchShaders();
        console.log(nextResults.length);
    }, [page]);
    return (
        <div className="flex flex-col justify-center items-center h-screen w-screen bg-gray-600">
            <header className=" bg-gray-800 text-white p-6 shadow-md h-[10vh] flex gap-3 items-center justify-between w-full">
                <div className="flex flex-row gap-1 items-center justify-center">
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
                </div>
                <div>
                    <Button
                        onClick={() =>
                            redirect(
                                "/gallery?page_number=" + (parseInt(page) - 1)
                            )
                        }
                        disabled={parseInt(page) <= 1}
                    >
                        Previous
                    </Button>
                    <Button
                        className="ml-2"
                        onClick={() =>
                            redirect(
                                "/gallery?page_number=" + (parseInt(page) + 1)
                            )
                        }
                        disabled={
                            results.length < 5 || nextResults.length === 0
                        }
                    >
                        Next
                    </Button>
                </div>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 grid-rows-auto h-[90vh] w-full gap-4 p-4">
                {results.map((shader: any, index: number) => (
                    <Card
                        key={index}
                        className="bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 md:p-2"
                    >
                        <CardTitle className="mt-2 mx-2 font-mono text-lg sm:text-xl font-bold text-white">
                            {shader.description.replace(
                                /\b\w/g,
                                (char: string) => char.toUpperCase()
                            )}
                        </CardTitle>
                        <CardContent className="w-full rounded-xl min-h-[24vh] sm:min-h-[28vh] md:min-h-[18vh]">
                            <ShaderView
                                key={index}
                                fragShader={shader.code}
                                vertShader=""
                                base64_texture={shader.texture}
                            ></ShaderView>
                        </CardContent>
                        <CardFooter className="flex justify-between pb-2">
                            <div className="overflow-hidden text-gray-200 italic text-sm sm:text-base text-nowrap">
                                "
                                {shader.prompt.length > 25
                                    ? shader.prompt.charAt(0).toUpperCase() +
                                      shader.prompt.slice(1, 25) +
                                      "..."
                                    : shader.prompt.charAt(0).toUpperCase() +
                                      shader.prompt.slice(1)}
                                "
                            </div>
                            <Button
                                onClick={() => redirect("/?id=" + shader._id)}
                            >
                                Use this
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
