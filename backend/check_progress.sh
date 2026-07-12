#!/bin/bash
LOG=/tmp/ingest_progress.log
LANCE_DIR=/Users/121322/GitHub/AI-Legal-Search/backend/data/lancedb/chunks.lance/data
DB=/Users/121322/GitHub/AI-Legal-Search/backend/data/cases.db

{
  echo "=== $(date) ==="

  if pgrep -f "ingest.py" > /dev/null; then
    echo "STATUS: running"
  else
    echo "STATUS: *** STOPPED — resume with: cd /Users/121322/GitHub/AI-Legal-Search/backend && .venv3/bin/python -u ingest.py >> /tmp/ingest.log 2>&1 &"
  fi

  FLUSHES=$(find "$LANCE_DIR" -name "*.lance" -type f 2>/dev/null | wc -l | tr -d ' ')
  CASES=$(sqlite3 "$DB" "SELECT COUNT(*) FROM cases;" 2>/dev/null || echo "?")
  SIZE=$(du -sh /Users/121322/GitHub/AI-Legal-Search/backend/data/lancedb/ 2>/dev/null | cut -f1)

  echo "Flushes: $FLUSHES  |  Cases: $CASES / 189110  |  Index: $SIZE"

  PCT=$(python3 -c "print(f'{100*$CASES/189110:.1f}%')" 2>/dev/null)
  HRS=$(python3 -c "
remaining = (189110 - $CASES) * 22.8
rate = 1807  # chunks/min
hrs = remaining / rate / 60
print(f'{hrs:.1f} hrs remaining')
" 2>/dev/null)
  echo "Progress: $PCT  —  $HRS"
  echo ""
} >> "$LOG"
