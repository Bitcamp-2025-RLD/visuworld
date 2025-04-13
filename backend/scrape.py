import json
import time

import requests
import tiktoken
from chromadb import PersistentClient
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables (requires OPENAI_API_KEY in .env)
load_dotenv()
client = OpenAI()

# Tokenizer for OpenAI embedding model
tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")
MAX_TOKENS = 8192

# Setup Chroma persistent client
chroma = PersistentClient(path="./chroma_db")
collection = chroma.get_or_create_collection(name="shaders")

API_KEY = "rdrlh1"
ALL_SHADERS_URL = f"https://www.shadertoy.com/api/v1/shaders?key={API_KEY}"
SHADER_DETAIL_URL = f"https://www.shadertoy.com/api/v1/shaders/{{}}?key={API_KEY}"

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"),
    "Accept": "application/json",
}


def get_all_shader_ids():
    res = requests.get(ALL_SHADERS_URL, headers=HEADERS)
    if res.status_code != 200:
        print(f"Request failed: {res.status_code}")
        return []
    return res.json().get("Results", [])


def get_shader_from_id(shader_id):
    url = SHADER_DETAIL_URL.format(shader_id)
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code != 200:
            print(f"❌ Failed to fetch {shader_id} (status {res.status_code})")
            return None

        shader = res.json().get("Shader", {})
        info = shader.get("info", {})
        renderpasses = shader.get("renderpass", [])

        if not renderpasses or "code" not in renderpasses[0]:
            print(f"⚠️ Skipping {shader_id} - no renderpass or code")
            return None

        if "iChannel" in renderpasses[0]["code"]:
            print(f"⚠️ Skipping {shader_id} - contains iChannel")
            return None

        return {
            "id": shader_id,
            "title": info.get("name", ""),
            "description": info.get("description", ""),
            "code": renderpasses[0]["code"],
            "tags": info.get("tags", []),
            "author": info.get("username", ""),
            "views": info.get("views", 0),
            "likes": info.get("likes", 0),
            "published": info.get("published", 0),
        }
    except Exception as e:
        print(f"⚠️ Exception while fetching {shader_id}: {e}")
        return None


def embed_shader_text(shader) -> list[float] | None:
    try:
        text = f"{shader['title']}\n{shader['description']}\n{shader['code']}"
        tokens = tokenizer.encode(text)

        if len(tokens) > MAX_TOKENS:
            print(f"⚠️ Truncating shader {shader['id']} from {len(tokens)} tokens to {MAX_TOKENS}")
            tokens = tokens[:MAX_TOKENS]
            text = tokenizer.decode(tokens)

        response = client.embeddings.create(input=[text], model="text-embedding-3-small")
        return response.data[0].embedding

    except Exception as e:
        print(f"❌ Embedding failed for {shader['id']} - {e}")
        return None


shader_ids = get_all_shader_ids()
print(f"✅ Got {len(shader_ids)} shader IDs")

results = []
for i, shader_id in enumerate(shader_ids[3003:34000]):  # Limit to 5000
    data = get_shader_from_id(shader_id)
    if not data:
        continue

    results.append(data)
    print(f"✔️  {i + 3003}/6000 - {data['title']}")

    embedding = embed_shader_text(data)
    if not embedding:
        print(f"⚠️ Skipping {data['id']} due to embedding error")
        continue

    try:
        collection.add(
            documents=[data["code"]],
            metadatas=[
                {
                    "title": data["title"],
                    "description": data["description"],
                    "author": data["author"],
                    "tags": ", ".join(data["tags"]),  # Convert list to string
                }
            ],
            ids=[data["id"]],
            embeddings=[embedding],
        )
    except Exception as e:
        print(f"❌ Chroma insert failed for {data['id']} - {e}")
        continue

    time.sleep(0.20)

with open("shaders_sample.json", "w") as f:
    json.dump(results, f, indent=2)
print("📁 Saved sample to shaders_sample.json")
