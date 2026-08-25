# CodeClash
This is project about JS testing system, this is related with AI, 

## Docker secret for runner (local dev)

The code runner and worker use an HMAC secret to sign job result POSTs. For local development we rely on a Docker secret named `runner_secret`.

Create the secret using the helper script:

```bash
./scripts/create-secret.sh "your-strong-secret-value"
```

This will initialize Docker Swarm if necessary and create the secret. Then start the stack:

```bash
docker compose up -d --build
```

Notes:
- In production use your orchestrator's secret store (Kubernetes Secret, Vault, etc.) and do not check the secret into source control.
- The backend and worker will also accept `RUNNER_SECRET` via env var if you prefer to inject it that way.

If you want me to add automatic secret rotation or a small utility to verify signatures locally, say so and I'll add it.

### Secret utilities

I added helper scripts in `scripts/`:

- `scripts/create-secret.sh "value"` — create the `runner_secret` Docker secret (initializes swarm if needed).
- `scripts/remove-secret.sh` — remove the `runner_secret` secret locally.
- `scripts/rotate-secret.sh "new-value"` — rotate the secret by replacing `runner_secret`.

Usage example:

```bash
./scripts/create-secret.sh "s3cure-value"
docker compose up -d --build
# later rotate
./scripts/rotate-secret.sh "n3w-value"
```

### HMAC signer helper

Use the small Node script to generate `x-runner-timestamp` and `x-runner-signature` values for manual curl testing.

```bash
# sign from a JSON file
node scripts/sign-hmac.js --secret "your-secret" --jobId "test-job" --file ./payload.json

# or inline body
node scripts/sign-hmac.js --secret "your-secret" --jobId "test-job" --body '{"jobId":"test-job","metadata":{}}'
```

The script prints the two headers and an example `curl` command you can paste to test the backend endpoint.
