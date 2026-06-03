# Python 3.12 — torch/transformers have no 3.14 wheels yet (host is 3.14, so we
# pin here instead of polluting the host).
FROM python:3.12-slim

# System libs surya/opencv/pdfium need at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models \
    TORCH_DEVICE=cpu \
    PYTHONUNBUFFERED=1

WORKDIR /app

# CPU torch from the dedicated index (keeps the image lean — no CUDA payload).
# To try GPU later: swap to a rocm/pytorch base image instead of this line.
RUN pip install "torch==2.7.1" --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
# Install marker first, then force the transformers pin to override any pull-up.
RUN pip install -r requirements.txt && pip install "transformers==4.57.3"

COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
