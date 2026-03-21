@echo off
setlocal enabledelayedexpansion

echo.
echo 📝 Email Login API Test
echo =====================

set BASE_URL=http://localhost:4000/api/auth
set EMAIL=test-%random%@example.com
set PASSWORD=TestPass123!

echo.
echo 1️⃣  Register new user
echo Email: %EMAIL%
echo.

powershell -Command "$response = Invoke-RestMethod -Uri '%BASE_URL%/register' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{\"email\":\"%EMAIL%\",\"password\":\"%PASSWORD%\",\"name\":\"Test User\"}'; $response | ConvertTo-Json -Depth 10; $global:token = $response.token"

echo.
echo 2️⃣  Get current user (if token is available)
powershell -Command "$Response = Invoke-RestMethod -Uri '%BASE_URL%/me' -Method GET -Headers @{'Authorization'='Bearer ACCESS_TOKEN_HERE'} -ErrorAction SilentlyContinue; if ($Response) { $Response | ConvertTo-Json -Depth 10 } else { 'Note: Replace ACCESS_TOKEN_HERE with token from registration' }"

echo.
echo 3️⃣  Login with credentials
echo.
powershell -Command "$response = Invoke-RestMethod -Uri '%BASE_URL%/login' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{\"email\":\"%EMAIL%\",\"password\":\"%PASSWORD%\"}'; $response | ConvertTo-Json -Depth 10"

echo.
echo ✅ Tests complete!
echo.
pause
