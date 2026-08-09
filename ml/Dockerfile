# The local tile reader, as a sidecar for the Spring app to call instead of Gemini.
#
# Separate from the app's image on purpose. It shares nothing with the JVM build, it is rebuilt on a
# different cadence (a retrained model, not a code change), and keeping it apart means the JVM image does
# not grow a Python runtime.
#
# slim rather than the default image: opencv-python-headless and pillow-heif both ship their own
# libraries (the latter bundles libheif and its codecs), so the only system package needed is libgomp,
# which onnxruntime links against for threading.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ml/requirements-serve.txt ./
RUN pip install --no-cache-dir -r requirements-serve.txt

# Only what serving needs. The calibration photos, the crops and the training scripts are all build-time
# inputs to the model and have no place in the running image — the two files below are the model.
COPY ml/runs/classifier.onnx ml/runs/classifier.json ./runs/
COPY ml/grid_fit.py ml/synthesize.py ml/try_real_photo.py ml/serve.py ./

# Bound to every interface *inside the container*; the port is published to 127.0.0.1 only, so the
# reader is reachable from the host's JVM and from nowhere else.
ENV READER_HOST=0.0.0.0 READER_PORT=8000
EXPOSE 8000

# The self-check drives the HTTP handler in-process, so a broken image fails here rather than on the
# first photo of the evening. It skips the success case when no hand photo is present, which is the
# case in the image — the refusals are what matter for a smoke test.
RUN python serve.py --self-check

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4).status==200 else 1)"

CMD ["python", "serve.py"]
