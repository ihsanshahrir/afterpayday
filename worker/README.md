# Receipt-scan proxy (Smart Scan)

A tiny Cloudflare Worker that lets the app use an NVIDIA vision model to read
receipts **without ever exposing the API key to the browser**. The key lives only
here as a server-side secret; the client only ever talks to this proxy.

```
Browser ──POST {image}──▶ this Worker ──Bearer key──▶ NVIDIA NIM ──JSON──▶ back
```

## One-time setup

1. **Install Wrangler** (Cloudflare's CLI) and log in:
   ```bash
   npm i -g wrangler
   wrangler login
   ```

2. **Get an NVIDIA key** from <https://build.nvidia.com> (free credits). Then store
   it as an encrypted secret — it is never written to any committed file:
   ```bash
   cd worker
   wrangler secret put NVIDIA_API_KEY      # paste the key when prompted
   ```

3. **Set the allowed origin** in `wrangler.toml` (`ALLOWED_ORIGIN`) to your
   deployed site's origin, e.g. `https://yourname.github.io`.

4. **MANDATORY: Enable rate limiting** (prevents abuse and credit burn):
   ```bash
   wrangler kv namespace create RATE_KV      # creates a KV store
   wrangler kv namespace create RATE_KV --preview  # also for preview
   ```
   Then uncomment the `[[kv_namespaces]]` block in `wrangler.toml` and paste
   both namespace IDs (one for production, one for preview).

5. **Deploy**:
   ```bash
   wrangler deploy
   ```
   Note the deployed URL (e.g. `https://afterpayday-receipt-proxy.<you>.workers.dev`).

## Wire it into the app

The client reads the proxy URL from a build-time env var. Create a **gitignored**
`.env.local` at the repo root:

```
VITE_SCAN_PROXY_URL=https://afterpayday-receipt-proxy.<you>.workers.dev
```

Then add that same origin to the `connect-src` of the CSP in `index.html`.
When `VITE_SCAN_PROXY_URL` is unset, Smart Scan simply doesn't appear and the app
stays 100% on-device.

## Local development

```bash
cp worker/.dev.vars.example worker/.dev.vars   # then paste your key into .dev.vars
cd worker
wrangler dev                                   # serves http://localhost:8787
```

Set `VITE_SCAN_PROXY_URL=http://localhost:8787` in `.env.local` and run the app
with `npm run dev`. The CSP already allows `http://localhost:8787` for this.

## Security notes

- The key is an encrypted Wrangler secret / local `.dev.vars` — never committed.
- Requests are gated by origin, body size, image magic-byte sniffing, and
  (optionally) per-IP rate limiting.
- The receipt image is never logged or stored by the Worker.
- The model's output is re-validated and clamped client-side in
  `utils/aiScan.js` (`clampScanResult`) before it can touch the form.
