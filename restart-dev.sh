#!/bin/bash
while true; do
  cd /home/z/my-project
  bun run dev >> dev.log 2>&1
  echo "[$(date)] Server died, restarting in 2s..." >> dev.log
  sleep 2
done
