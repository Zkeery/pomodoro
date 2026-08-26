#!/usr/bin/env bash
# Launch the Electron Pomodoro widget on a headless Linux host (e.g. a Cloud Agent VM).
#
# The app is a macOS desktop widget, but Electron also runs on Linux. Since a
# Cloud Agent VM has no physical display, this script provisions a virtual X
# display (Xvfb) and a per-process D-Bus session, then runs the app in the
# foreground so its logs stay visible.
#
# Override the display number with POMODORO_DISPLAY (defaults to 99).
set -euo pipefail

cd "$(dirname "$0")/.."

DISPLAY_NUM="${POMODORO_DISPLAY:-99}"

# Reuse an existing virtual display if one is already up; otherwise start Xvfb.
if ! xdpyinfo -display ":${DISPLAY_NUM}" >/dev/null 2>&1; then
  echo "Starting Xvfb on :${DISPLAY_NUM}..."
  Xvfb ":${DISPLAY_NUM}" -screen 0 1280x1024x24 >/tmp/pomodoro-xvfb.log 2>&1 &
  for _ in $(seq 1 40); do
    if xdpyinfo -display ":${DISPLAY_NUM}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

export DISPLAY=":${DISPLAY_NUM}"
echo "Launching Pomodoro on DISPLAY=${DISPLAY}"

# --no-sandbox / --disable-gpu are required for Chromium inside an unprivileged,
# GPU-less container.
exec dbus-run-session -- npm start -- --no-sandbox --disable-gpu
