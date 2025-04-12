'use client';
import React, { useEffect, useState } from 'react';
import CodeMirror, { oneDark } from '@uiw/react-codemirror';
import ShaderView from './components/shaderview';
import Dictaphone from './components/speech';

function Page() {
  const [frag, setFrag] = useState<string>("");
  const [fullScreen, setFullScreen] = useState<boolean>(false);

  useEffect(() => {
    async function readShaders() {
      const file = await fetch("/shader.frag");
      const shaderCode = await file.text();
      setFrag(shaderCode);
    }
    readShaders();
  }, []);

  return (
    <div className="h-full w-screen flex flex-col bg-gray-100 text-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-600 text-white p-6 shadow-md flex gap-3 items-center">
        <h1 className="text-xl font-bold">🧪 VisuWorld</h1>
        <button onClick={() => setFullScreen(!fullScreen)} className='bg-black h-12 w-24 rounded-2xl'>{fullScreen ? "Fullscreen" : "Minimized"}</button>
      </header>

      {/* Grid Layout */}
      <div className="h-full grid grid-cols-2 grid-rows-3 gap-4 p-4">
        <div className='bg-black h-full w-full rounded-2xl text-white p-2'>
          <Dictaphone></Dictaphone>
        </div>
        {/* Editor */}
        <div className="bg-white shadow-md rounded-2xl overflow-hidden flex flex-col row-start-2 row-span-2">
          <div className="bg-gray-800 text-white px-4 py-2 font-mono text-sm rounded-t-2xl">
            Fragment shader
          </div>
          <div className="overflow-auto">
            <CodeMirror
              value={frag}
              height="100%"
              theme={oneDark}
              onChange={(value) => setFrag(value)}
            />
          </div>
        </div>
        {frag !== "" && (
            <div className={`${fullScreen ? "absolute" : ""} h-full w-full bg-black rounded-2xl overflow-hidden shadow-md row-span-3`}>
              <ShaderView fragShader={frag} vertShader="" />
            </div>
        )}
      </div>
    </div>
  );
}

export default Page;