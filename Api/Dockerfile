FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from Api directory
COPY Api/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Api folder and other necessary files
# We maintain the structure so that relative paths in Scrap.py work
COPY Api/ ./Api/
COPY .env .

# Create empty files that the script expects to write to in the parent dir of Api/
RUN touch google_news.json google_news.csv summary.json summary.txt

# Expose the FastAPI port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "Api.Scrap:app", "--host", "0.0.0.0", "--port", "8000"]
