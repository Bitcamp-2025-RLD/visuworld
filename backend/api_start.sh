sudo apt-get update
sudo apt-get install libsqlite3-dev build-essential

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
