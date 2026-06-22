FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# Host injects $PORT (Render/Fly/Railway); default 8000 for local `docker run`.
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
