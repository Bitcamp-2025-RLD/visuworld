"use client"
import React, { useEffect, useState } from 'react'
import Shader from './components/shader'

function page() {

  const [frag, setFrag] = useState<string>("");
  
  useEffect(() => {
    async function read_shaders() {
      const file = await fetch("/shader.frag");
      const shader_code = await file.text();
      setFrag(shader_code);
    }
    read_shaders();
  }, []);
  return (
  <>
    <header className ="bg-gray-300 text-white p-8"></header>
    {
      frag != "" ?
        <Shader fragShader={frag} vertShader=""></Shader>
      : <></>
    }
  </>
    
  )
}

export default page