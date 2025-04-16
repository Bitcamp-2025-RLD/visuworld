FROM python:3.11-slim

# Install needed packages + Rust at build time
RUN apt-get update && apt-get install -y build-essential curl \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && source /root/.cargo/env \
    && pip install --upgrade pip

WORKDIR /app
COPY requirements.txt .
# Build wheels at build time (Rust is installed)
RUN . /root/.cargo/env && pip install -r requirements.txt

COPY . /app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host=0.0.0.0", "--port=8000", "--reload"]
