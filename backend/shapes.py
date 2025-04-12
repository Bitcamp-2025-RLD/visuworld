import json
import time

import tiktoken
from chromadb import PersistentClient
from dotenv import load_dotenv
from openai import OpenAI

# Load .env with OPENAI_API_KEY
load_dotenv()
client = OpenAI()

# Setup tokenizer and constants
tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")
MAX_TOKENS = 8192

# Setup ChromaDB
chroma = PersistentClient(path="./chroma_db")
collection = chroma.get_or_create_collection(name="shaders")

# Load shape definitions
with open("shapes.json", "r") as f:
    shapes_data = json.load(f)


def embed_shape_text(shape) -> list[float] | None:
    try:
        text = f"{shape['title']}\n{shape['description']}\n{shape['code']}"
        tokens = tokenizer.encode(text)

        if len(tokens) > MAX_TOKENS:
            print(f"⚠️ Truncating {shape['id']} from {len(tokens)} to {MAX_TOKENS}")
            tokens = tokens[:MAX_TOKENS]
            text = tokenizer.decode(tokens)

        response = client.embeddings.create(input=[text], model="text-embedding-3-small")
        return response.data[0].embedding

    except Exception as e:
        print(f"❌ Embedding failed for {shape['id']} - {e}")
        return None


results = []
for i, shape in enumerate(shapes_data):
    embedding = embed_shape_text(shape)
    if not embedding:
        print(f"⚠️ Skipping {shape['id']} due to embedding error")
        continue

    try:
        collection.add(
            documents=[shape["code"]],
            embeddings=[embedding],
            metadatas=[
                {
                    "title": shape["title"],
                    "description": shape["description"],
                    "author": shape["author"],
                    "tags": ", ".join(shape["tags"]),
                    "views": shape["views"],
                    "likes": shape["likes"],
                    "published": shape["published"],
                }
            ],
            ids=[shape["id"]],
        )
        results.append(shape)
        print(f"✔️ {i + 1}/{len(shapes_data)} - {shape['title']}")
    except Exception as e:
        print(f"❌ Chroma insert failed for {shape['id']} - {e}")
        continue

    time.sleep(0.1)  # Throttle slightly to avoid rate limits

# Save imported data as backup
with open("shapes_sample.json", "w") as f:
    json.dump(results, f, indent=2)

print("✅ All shapes processed.")
