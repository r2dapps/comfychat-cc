@echo off
echo Starting ComfyChat Ecosystem...

echo Starting Python Chat Server (Port 5000)...
start "Python Chat Server" cmd /k "python server.py"

echo Starting Node.js Theater Server (Port 5001)...
start "Node.js Theater Server" cmd /k "node theater_server.js"

echo Starting Cloudflare Tunnel (Requires cloudflared.exe installed)...
echo Please download cloudflared.exe from Cloudflare and place it in this folder if it fails.
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5000"

echo All servers started!
pause
