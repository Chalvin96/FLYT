FROM textlab/obt:1.0
WORKDIR /app/The-Oslo-Bergen-Tagger

COPY app.py /app/The-Oslo-Bergen-Tagger/app.py

RUN useradd -m -u 10001 svc || true
USER svc

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD python3 -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=3).status==200 else 1)"
CMD ["python3", "app.py"]
