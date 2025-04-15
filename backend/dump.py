import os

from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables from a .env file
load_dotenv()

# Connect to the local MongoDB instance
source_mongo_url = os.getenv("SOURCE_MONGO_URL", "mongodb://localhost:27017")
source_mongo = MongoClient(source_mongo_url)
source_db = source_mongo["visuworld"]
source_collection = source_db["shaders"]
print("Connected to original")

# Fetch all documents into memory
documents = list(source_collection.find())
print(documents)

# halt on input
input("Check to make sure docs are correct\nPress Enter to continue...")

# Connect to the remote MongoDB instance (Atlas or otherwise)
destination_mongo_url = os.getenv("DESTINATION_MONGO_URL", "mongodb://destination_host:27017")
destination_mongo = MongoClient(destination_mongo_url)
destination_db = destination_mongo["visuworld"]
destination_collection = destination_db["shaders"]

# Optional: Drop existing collection on remote to avoid duplicates
# destination_collection.drop()

# Insert documents into the remote collection
for doc in documents:
    doc.pop("_id", None)  # Remove the _id to avoid duplicate key errors
    destination_collection.insert_one(doc)

print(f"Successfully copied {len(documents)} documents.")
