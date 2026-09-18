#!/bin/bash
set -e
RULES_SRC=""
for candidate in \
  /opt/CubeControl/resources/99-cube-baby.rules \
  /opt/cubecontrol/resources/99-cube-baby.rules
do
  if [ -f "$candidate" ]; then
    RULES_SRC="$candidate"
    break
  fi
done
if [ -n "$RULES_SRC" ]; then
  cp "$RULES_SRC" /etc/udev/rules.d/99-cube-baby.rules
  if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules || true
    udevadm trigger || true
  fi
fi
