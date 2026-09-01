#!/usr/bin/env bash
set -euo pipefail

IMAGE=prelegal
CONTAINER=prelegal
PORT=4000
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

docker build -t "$IMAGE" .
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# No volume. The database is built inside the container, so removing and
# recreating it here is what gives every start a database from scratch.
docker run -d --name "$CONTAINER" -p "$PORT:8000" "$IMAGE" >/dev/null

# docker run -d exits 0 once the container is created, which says nothing about
# whether it stayed up. Without this the script announces an address that
# nothing is listening on, and the reason is only in docker logs.
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "Prelegal running at http://localhost:$PORT"
    exit 0
  fi
  if [ -z "$(docker ps -q -f "name=$CONTAINER")" ]; then
    break
  fi
  sleep 1
done

echo "Prelegal failed to start. Last log lines:" >&2
docker logs --tail 20 "$CONTAINER" >&2 || true
exit 1
