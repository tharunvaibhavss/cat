FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for OpenCV, PostgreSQL, and build utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY . /app/backend

# Create static reports directory
RUN mkdir -p /app/backend/static/reports

EXPOSE 8000

# Run FastAPI via Uvicorn listening on all network interfaces
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
