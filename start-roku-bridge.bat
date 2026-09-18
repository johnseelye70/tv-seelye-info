@echo off
title Seelye TV - Local Roku Bridge Daemon
echo ===================================================
echo       SEELYE TV - LOCAL ROKU HARDWARE BRIDGE
echo ===================================================
echo [Bridge] Starting Roku LAN Bridge for tv.seelye.info...
echo [Bridge] Target Roku: 192.168.50.9:8060
echo [Bridge] Relay: Supabase Realtime (seelye-roku-relay)
echo [Bridge] Status Dashboard: http://localhost:8062/status
echo ===================================================
node roku-bridge.js
if %ERRORLEVEL% NEQ 0 (
    echo [Bridge] Trying with experimental websocket flag...
    node --experimental-websocket roku-bridge.js
)
pause
