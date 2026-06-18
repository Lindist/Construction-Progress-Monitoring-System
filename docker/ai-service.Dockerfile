FROM python:3.11-slim

# Install FFmpeg and OpenCV system dependencies
RUN (apt-get update || (sleep 5 && apt-get update) || (sleep 10 && apt-get update)) && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    libglib2.0-0 \
    libfontconfig1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose AI service port
EXPOSE 8001

# Run the FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
