import os

import chromadb
import tiktoken
from chromadb import PersistentClient
from dotenv import load_dotenv
from google import genai
from openai import OpenAI

# Load API keys from .env
load_dotenv()
openai_client = OpenAI()

# Setup ChromaDB
chroma = PersistentClient(path="./chroma_db")
collection = chroma.get_or_create_collection("shaders")

# Setup tokenizer for OpenAI
tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")
MAX_TOKENS = 8192


def get_embedding(text: str) -> list[float]:
    tokens = tokenizer.encode(text)
    if len(tokens) > MAX_TOKENS:
        print(f"⚠️ Truncating prompt from {len(tokens)} to {MAX_TOKENS} tokens")
        tokens = tokens[:MAX_TOKENS]
        text = tokenizer.decode(tokens)

    response = openai_client.embeddings.create(input=[text], model="text-embedding-3-small")
    return response.data[0].embedding


def query_chroma(prompt: str, n_results=10):
    embedding = get_embedding(prompt)
    return collection.query(query_embeddings=[embedding], n_results=n_results)


def build_prompt(user_prompt: str, results: dict) -> str:
    context = "Here are some example shaders:\n"

    for i in range(len(results["documents"][0])):
        meta = results["metadatas"][0][i]
        snippet = results["documents"][0][i][:300]
        context += f"""\nExample {i + 1} - {meta["title"]} by {meta["author"]}:
Description: {meta["description"]}
Tags: {meta["tags"]}
Code Snippet:{snippet}
"""

    context += """[REQUIRED] Additional Program Information:
fragCoord is passed in as a vec2 from the vertex shader
fragColor is passed out as a vec4 from the fargment shader

fragCoord is ALREADY normalized, it is already -1 to 1 when it arrives into the fragment shader so don't normalize it
We are using opengl 3.3 so please stick to the standards on 3.3

You can use iTime, iResolution, and iMouse for your shaders

Using sdfs and smoothing functions is also something that's encouraged if you are raymarching

Here are some sample sdfs:
float sdSphere( vec3 p, float s )
{{
  return length(p)-s;
}}


float sdBox( vec3 p, vec3 b )
{{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}}


float sdRoundBox( vec3 p, vec3 b, float r )
{{
  vec3 q = abs(p) - b + r;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}}


float sdBoxFrame( vec3 p, vec3 b, float e )
{{
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}}


float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{{
  vec3 pa = p - a, ba = b - a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length( pa - ba*h ) - r;
}}"""

    context += f"\nNow, based on the above examples, write a new GLSL fragment shader that creates: **{user_prompt}**.\n\nOutput only the GLSL code."
    return context


def generate_shader(prompt: str) -> str:
    results = query_chroma(prompt)
    final_prompt = build_prompt(prompt, results)

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": final_prompt}],
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    user_prompt = input("🧠 What kind of shader should GPT generate? ")
    result = generate_shader(user_prompt)

    print("\n🎨 Generated Shader:\n")
    print(result)

    # remove backticks and "glsl" from the result
    result = result.replace("```glsl", "").replace("```", "").strip()

    with open("./shaders/shader.frag", "w") as f:
        f.write(result)

    print("\n✅ Saved as shaders/shader.frag")
