FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd -u 10001 -m curdr && mkdir /data && chown curdr /data
COPY backend/app /app/app
COPY dist /app/web
USER 10001:10001
ENV PYTHONDONTWRITEBYTECODE=1 CURDR_DB=/data/curdr.db
CMD ["python","-m","uvicorn","app.main:create_app","--factory","--host","0.0.0.0","--port","8000","--workers","1"]
