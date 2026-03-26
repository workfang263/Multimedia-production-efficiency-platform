FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ffprobe/ffmpeg：app 里会调用子进程
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 18091

CMD ["gunicorn", "-b", "0.0.0.0:18091", "--workers", "1", "--threads", "2", "--timeout", "300", "app:app"]
