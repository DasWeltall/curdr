# Build the pinned, unmodified upstream first (scripts/setup-hermes.sh).
FROM curdr-hermes-upstream:bda3a363e969
USER root
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /bridge/requirements.txt
# The upstream environment is sealed. Our bridge has its own small environment;
# the worker explicitly runs with the upstream Python below.
RUN python3 -m venv /bridge/.venv && /bridge/.venv/bin/pip install --no-cache-dir -r /bridge/requirements.txt faster-whisper==1.2.1 av==16.0.1
RUN /bridge/.venv/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('Systran/faster-whisper-base',local_dir='/opt/curdr-stt')"
COPY backend/hermes/bridge.py backend/hermes/worker.py backend/hermes/transcribe.py backend/hermes/local_stt.py /bridge/
RUN mkdir -p /workspace /opt/data && chown -R 1000:1000 /workspace /opt/data
USER 1000:1000
ENV HERMES_LOCAL_STT_COMMAND="/bridge/.venv/bin/python /bridge/local_stt.py {input_path} {output_dir}"
ENV HF_HUB_OFFLINE=1
ENV HERMES_HOME=/opt/data HERMES_PYTHON=/opt/hermes/.venv/bin/python PYTHONDONTWRITEBYTECODE=1
WORKDIR /workspace
ENTRYPOINT ["/bridge/.venv/bin/python","-m","uvicorn"]
CMD ["bridge:app","--app-dir","/bridge","--host","0.0.0.0","--port","8090","--workers","1"]
