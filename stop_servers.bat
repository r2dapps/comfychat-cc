@echo off
echo Stopping ComfyChat Ecosystem...

echo Killing Python...
taskkill /F /IM python.exe /T

echo Killing Node.js...
taskkill /F /IM node.exe /T

echo Killing Cloudflare Tunnel...
taskkill /F /IM cloudflared.exe /T

echo All servers stopped! Your PC is now disconnected from the internet tunnel.
pause
