#!/bin/bash
pip install -r requirements.txt

pip uninstall openai
python -m pip cache purge
pip install openai

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
