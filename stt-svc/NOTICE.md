# Third-party notices

The service includes or serves the following third-party components. The
repository's own code remains covered by the root `LICENSE`.

## NB-Whisper Medium

- Source: [`NbAiLab/nb-whisper-medium`](https://huggingface.co/NbAiLab/nb-whisper-medium)
- License: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- Default revision: `0ed074d5985bd56ca4140159a9dbffbc3fb5117e`
- Runtime artifact: the default local Docker build converts the checkpoint to
  CTranslate2 INT8 with `ct2-transformers-converter`. The published CI image
  extracts the equivalent pre-converted artifact from the self-hosted bundle
  URL in the Docker workflow after verifying its SHA-256.

## faster-whisper

- Source: [`SYSTRAN/faster-whisper`](https://github.com/SYSTRAN/faster-whisper)
- License: [MIT](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE)

## CTranslate2

- Source: [`OpenNMT/CTranslate2`](https://github.com/OpenNMT/CTranslate2)
- License: [MIT](https://github.com/OpenNMT/CTranslate2/blob/master/LICENSE)

The final image also contains transitive Python packages installed by
`faster-whisper` and FastAPI. Their license metadata is retained in the Python
environment; regenerate the dependency lock and review notices when upgrading
the service runtime. The [service README](README.md) records the converted
bundle and checksum; the image includes this notice and the full
[Apache-2.0 license](Apache-2.0.txt).
