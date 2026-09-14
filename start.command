#!/bin/bash
cd "$(dirname "$0")"
PORT=8080
python3 -m http.server "$PORT" >/tmp/pokemon_d20_server.log 2>&1 &
PID=$!
sleep 1
open "http://localhost:$PORT"
echo "Pokémon d20 Companion is running at http://localhost:$PORT"
echo "Press Control-C to stop the local server."
trap "kill $PID 2>/dev/null" EXIT
wait $PID
