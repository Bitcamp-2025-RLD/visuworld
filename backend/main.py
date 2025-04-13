# file: main.py

import os
from datetime import datetime
from typing import List

import tiktoken
from chromadb import PersistentClient
from dotenv import load_dotenv
from fastapi import FastAPI
from google import genai
from openai import OpenAI
from pydantic import BaseModel

# ----- NEW: Mongo Setup -----
from pymongo import MongoClient

# Load environment variables
load_dotenv()

OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
MAX_TOKENS = 8192

openai_client = OpenAI()

# Setup tokenizer for OpenAI
tokenizer = tiktoken.encoding_for_model(OPENAI_EMBEDDING_MODEL)

# Setup ChromaDB
chroma = PersistentClient(path="./chroma_db")
collection = chroma.get_or_create_collection("shaders")

# Setup Google GenAI Client
google_model_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
GOOGLE_GENAI_MODEL = "gemini-2.5-pro-exp-03-25"

# ----- NEW: MongoDB client & 'shaders' collection -----
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
mongo_client = MongoClient(MONGO_URL)
db = mongo_client["mydatabase"]
mongo_shaders_col = db["shaders"]


# --------------------
# Helper functions
# --------------------
def get_embedding(text: str) -> List[float]:
    """
    Creates an embedding for the given text using OpenAI.
    Truncates tokens if necessary.
    """
    tokens = tokenizer.encode(text)
    if len(tokens) > MAX_TOKENS:
        print(f"⚠️ Truncating prompt from {len(tokens)} to {MAX_TOKENS} tokens.")
        tokens = tokens[:MAX_TOKENS]
        text = tokenizer.decode(tokens)

    response = openai_client.embeddings.create(input=[text], model=OPENAI_EMBEDDING_MODEL)
    return response.data[0].embedding


def query_chroma(prompt: str, n_results=10):
    """
    Queries the ChromaDB collection with the text embedding from the prompt.
    Returns the top n results.
    """
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
Please write shaders targeting WebGL
Do NOT write #version directives

You can use iTime, iResolution, for your shaders

Make a main function with no parameters, and it must have its end result go to gl_FragColor

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


def generate_shader(user_prompt: str) -> str:
    """
    Queries ChromaDB, builds a final prompt for Google GenAI, and returns
    the generated shader code.
    """
    results = query_chroma(user_prompt)
    final_prompt = build_prompt(user_prompt, results)

    response = google_model_client.models.generate_content(model=GOOGLE_GENAI_MODEL, contents=final_prompt)
    return response.text.strip()


# --------------------
# FastAPI Application
# --------------------
app = FastAPI(title="Shader Generation API", version="1.0.0")


class PromptRequest(BaseModel):
    prompt: str


@app.post("/generate_shader")
def generate_shader_endpoint(request: PromptRequest):
    """
    POST a JSON body like:
    {
      "prompt": "Write a shader that draws a rotating cube in 3D"
    }
    Returns a JSON object with the generated shader code.
    """
    shader_code = generate_shader(request.prompt)

    # remove any extraneous ```glsl or ``` markers
    shader_code = shader_code.replace("```glsl", "").replace("```", "").strip()

    # remove lines with "#version" in it
    shader_code = "\n".join(line for line in shader_code.splitlines() if "#version" not in line)

    return {"shader": shader_code}


# ----- NEW: Data models for saving & retrieving from MongoDB -----
class SaveShaderRequest(BaseModel):
    prompt: str
    code: str
    description: str


@app.post("/save_shader")
def save_shader(req: SaveShaderRequest):
    """
    Insert the shader into MongoDB.
    JSON body must have:
      {
        "prompt": "the user prompt",
        "code": "the glsl code",
        "description": "some descriptive text"
      }
    """
    doc = {"prompt": req.prompt, "code": req.code, "description": req.description, "timestamp": datetime.utcnow()}
    # Insert into MongoDB
    result = mongo_shaders_col.insert_one(doc)
    return {"message": "Shader saved successfully", "inserted_id": str(result.inserted_id)}


@app.get("/retrieve_shaders")
def retrieve_shaders():
    """
    Returns all shaders from MongoDB.
    """
    results = []
    for doc in mongo_shaders_col.find({}, {"_id": 1, "prompt": 1, "code": 1, "description": 1, "timestamp": 1}):
        # Convert ObjectId to string
        doc["_id"] = str(doc["_id"])
        results.append(doc)

    return {"shaders": results}
