# Gotchas and design decisions

1. **marker/surya version pins (do not bump blindly).** `marker-pdf 1.x` uses the
   classic surya (`surya-ocr 0.17.x` — separate plain-torch detection, recognition
   and layout models), not the newer Surya 2 VLM, which requires vLLM. vLLM has no
   RDNA4/gfx1201 kernels, so it would run CPU-only on this AMD card.
   `transformers==4.57.3` is required: 5.x removed `SuryaDecoderConfig.pad_token_id`
   (surya #484). Python 3.12 runs in the container (torch/transformers have no 3.14
   wheels).

2. **Ollama runs on the host, not in a container.** It uses Vulkan
   (`ollama-vulkan`), which works on gfx1201 where ROCm for LLM inference was
   unreliable. The api reaches it via `host.docker.internal:host-gateway`, so
   Ollama must listen beyond `127.0.0.1`. A systemd drop-in sets
   `OLLAMA_HOST=0.0.0.0`:

   ```bash
   sudo systemctl edit ollama
   # [Service]
   # Environment="OLLAMA_HOST=0.0.0.0:11434"
   sudo systemctl restart ollama
   ```

   On Windows/macOS (Docker Desktop) `host.docker.internal` resolves to the host
   automatically; make sure Ollama is running and listening on `0.0.0.0:11434`.
   If the host Ollama is unavailable, switch the LLM provider in Settings to an
   OpenAI-compatible API to keep enrichment, summaries and auto-categorization
   working. **The host-Ollama path has had the least cross-platform testing — see
   the [README testing note](../README.md#tested-on--needs-more-testing).**

3. **GPU for marker on AMD (gfx1201 / RDNA4) works via ROCm — experimental.** CPU
   is the default and reliable. The standalone GPU stack
   (`docker-compose.marker.gpu.yml` + `marker-server/Dockerfile.rocm`) runs marker
   on the GPU and is **verified working on gfx1201**. It installs the ROCm build of
   torch (rocm6.3, matching the `torch 2.7.1` pin), passes `/dev/kfd` + `/dev/dri`,
   runs `TORCH_DEVICE=cuda` (ROCm masquerades as CUDA in PyTorch), and sets
   `TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1` to enable the fused flash /
   memory-efficient attention kernels on RDNA4 — without it torch falls back to a
   slow unfused "math" attention path. Caveats: it is pinned to ROCm 6.3 (the surya
   stack pins torch 2.7.1), those AOTriton kernels are flagged experimental, and
   `HSA_OVERRIDE_GFX_VERSION` is provided (commented) as a fallback if a card or
   driver lacks native kernels. If anything misbehaves,
   `docker compose -f docker-compose.marker.yml up` returns to the proven CPU build.
   **There is no NVIDIA/CUDA-specific path shipped — an NVIDIA GPU is untested.**
   (This is distinct from gotcha 1: the *VLM* path needs vLLM, which still has no
   RDNA4 kernels — classic surya on ROCm torch is what runs here.)

4. **Files stay user-owned.** The `api` container runs as
   `${DOCKER_UID:-1000}:${DOCKER_GID:-1000}`. The whole `$HOME` is bind-mounted to
   `/host`; the watched directory is `/host/<watchSubdir>`, switchable live from
   the UI. (`make up` injects the host UID/GID; on Windows/macOS Docker Desktop
   handles file ownership differently — another reason the non-Linux path warrants
   testing.)

5. **Settings live in SQLite; env seeds them on first run** (env → DB → frontend
   edits). Container-shape values (watch root, vault dir, marker URL, ports) stay
   in compose; tunables live in the database, per user.

6. **Rebuilding a single service:** use
   `docker compose up -d --build --no-deps api`. A plain `--build api` can fail
   while evaluating other build contexts.

7. **Marker models load lazily; processing is health-gated.** `marker-server` no
   longer loads weights at startup — `/health` is liveness-only and the api no
   longer blocks for minutes on model readiness. The first `/convert` pays the
   load; conversions stay warm after. For the marker engines, `MarkerHealthMonitor`
   probes the target before converting: if it is down, the document is held
   `Queued` and re-checked (it is never failed), so an offline off-server marker
   just pauses the queue and auto-resumes when it returns.
