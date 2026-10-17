#!/bin/sh
# Mac / Linux: run `sh start.sh` in this folder, then open http://localhost:8000
cd "$(dirname "$0")"
( sleep 1; (command -v open >/dev/null && open http://localhost:8000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:8000) ) &
python3 -m http.server 8000
