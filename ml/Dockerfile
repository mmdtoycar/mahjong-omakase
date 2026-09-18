FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ml/requirements-serve.txt ./
RUN pip install --no-cache-dir -r requirements-serve.txt

COPY ml/runs/classifier.onnx ml/runs/classifier.json ./runs/
COPY ml/serve.py ./
COPY ml/recognition ./recognition
COPY ml/data/test_hand.jpg ./data/
COPY ml/tests ./tests

ENV READER_HOST=0.0.0.0 READER_PORT=8000
EXPOSE 8000

# The gate, run inside the image it gates: the same modules, the same wheels, the same Python. Only the serve
# checks, because they are the ones that drive the whole pipeline end to end — the grid-fit checks want the
# calibration photos, which live with the server and are not worth copying here for it.
RUN python -m tests.test_serve && rm -rf tests data/test_hand.jpg

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4).status==200 else 1)"

CMD ["python", "serve.py"]
