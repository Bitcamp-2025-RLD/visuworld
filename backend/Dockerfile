# Use Python 3.11 slim as the base image
FROM python:3.11-slim

# Install build-essential and curl (required for building Rust-based wheels)
RUN apt-get update && apt-get install -y build-essential curl

# Install Rust using rustup, defaults to stable toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Permanently add Cargo's bin directory to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Set the working directory inside the container
WORKDIR /app

# Copy in your requirements file
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    # Remove any third-party bson package; we only want PyMongo’s internal bson
    && pip uninstall -y bson || true \
    # Uninstall openai if a conflicting version is present
    && pip uninstall -y openai || true \
    # Reinstall openai cleanly
    && pip install --no-cache-dir openai

# Copy the rest of the application code
COPY . .

# Expose FastAPI’s default port
EXPOSE 8000

# Start the FastAPI app with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
