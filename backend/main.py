# file: main.py

import os
from datetime import datetime
from typing import List

import tiktoken
from bson import ObjectId
from chromadb import PersistentClient
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
GOOGLE_FLASH_MODEL = "gemini-2.0-flash"
GOOGLE_PRO_MODEL = "gemini-2.5-pro-exp-03-25"

# ----- NEW: MongoDB client & 'shaders' collection -----
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
mongo_client = MongoClient(MONGO_URL)
db = mongo_client["visuworld"]
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


def build_prompt(user_prompt: str, results: dict, code: str = None) -> str:
    context = "You will be generating GLSL fragment shaders targeting WebGL\n"
    if code is not None:
        context += f"Here is the shader code you need to modify and send back according to the following code samples and prompt:\n{code}\n\n"
    context += "Here are some example shaders to reference for code generation:\n"

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
When you use iResolution you must declare it as a uniform vec2
When you use iTime you must declare it as a uniform float

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


def generate_shader(user_prompt: str, isPro: bool) -> str:
    """
    Queries ChromaDB, builds a final prompt for Google GenAI, and returns
    the generated shader code.
    """
    results = query_chroma(user_prompt)
    final_prompt = build_prompt(user_prompt, results)

    GOOGLE_MODEL = GOOGLE_PRO_MODEL if isPro else GOOGLE_FLASH_MODEL
    response = google_model_client.models.generate_content(model=GOOGLE_MODEL, contents=final_prompt)
    return response.text.strip()


def modify_shader(user_prompt: str, shader_code: str, isPro: bool) -> str:
    """
    Modifies the shader code based on the user's prompt.
    This is just a placeholder for the actual modification logic.
    """
    results = query_chroma(user_prompt)
    final_prompt = build_prompt(user_prompt, results, shader_code)

    GOOGLE_MODEL = GOOGLE_PRO_MODEL if isPro else GOOGLE_FLASH_MODEL
    response = google_model_client.models.generate_content(model=GOOGLE_MODEL, contents=final_prompt)
    return response.text.strip()


# --------------------
# FastAPI Application
# --------------------
app = FastAPI(title="Shader Generation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PromptRequest(BaseModel):
    prompt: str
    isPro: bool


@app.post("/generate_shader")
def generate_shader_endpoint(request: PromptRequest):
    """
    POST a JSON body like:
    {
      "prompt": "Write a shader that draws a rotating cube in 3D"
    }
    Returns a JSON object with the generated shader code.
    """
    shader_code = generate_shader(request.prompt, request.isPro)

    # remove any extraneous ```glsl or ``` markers
    shader_code = shader_code.replace("```glsl", "").replace("```", "").strip()

    # remove lines with "#version" in it
    shader_code = "\n".join(line for line in shader_code.splitlines() if "#version" not in line)

    return {"shader": shader_code}


class ModifyShaderRequest(BaseModel):
    prompt: str
    code: str
    isPro: bool


@app.post("/modify_shader")
def modify_shader_endpoint(request: ModifyShaderRequest):
    """
    POST a JSON body like:
    {
      "prompt": "Modify the shader to add a moving light source"
      "code": "void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }"
    }
    Returns a JSON object with the modified shader code.
    """
    shader_code = modify_shader(request.prompt, request.code, request.isPro)

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
    normalized_prompt = req.prompt.strip().lower()
    existing_shader = mongo_shaders_col.find_one({"prompt": normalized_prompt, "code": req.code})
    print(f"Checking for existing shader with prompt: {normalized_prompt}")
    print(f"Existing shader: {existing_shader}")

    if existing_shader is not None:
        raise ValueError(f"Shader with the given prompt already exists. ID: {str(existing_shader['_id'])}")

    # Save the normalized version too
    doc = {"prompt": normalized_prompt, "code": req.code, "description": req.description, "timestamp": datetime.utcnow()}

    result = mongo_shaders_col.insert_one(doc)
    return {"message": "Shader saved successfully", "inserted_id": str(result.inserted_id)}


@app.get("/retrieve_shaders")
def retrieve_shaders(page: int = 1):
    """
    Returns all shaders from MongoDB.
    Paginated with 6 per page
    """
    print(f"Retrieving shaders for page: {page}")
    paginated_results = []
    for doc in mongo_shaders_col.find({}, {"_id": 1, "prompt": 1, "code": 1, "description": 1, "timestamp": 1}).skip((page - 1) * 6).limit(6):
        # Convert ObjectId to string
        doc["_id"] = str(doc["_id"])
        paginated_results.append(doc)
    print(f"Paginated results length: for page {page}: {len(paginated_results)}")

    return {"shaders": paginated_results}


@app.get("/retrieve_shader")
def retrieve_shader(shader_id: str):
    """
    Returns one shaders from MongoDB.
    """
    print(f"Retrieving shader with ID: {shader_id}")
    result = mongo_shaders_col.find_one({"_id": ObjectId(shader_id)}, {"_id": 1, "prompt": 1, "code": 1, "description": 1, "timestamp": 1})

    if result is None:
        return {"error": "Shader not found"}

    # Convert ObjectId to string
    result["_id"] = str(result["_id"])
    return result