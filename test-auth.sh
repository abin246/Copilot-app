#!/bin/bash
# Quick test of auth endpoints

echo "📝 Email Login API Test"
echo "======================"

BASE_URL="http://localhost:4000/api/auth"

# Generate unique email
EMAIL="test-$(date +%s)@example.com"
PASSWORD="TestPass123!"

echo ""
echo "1️⃣  Register new user"
echo "Email: $EMAIL"
REGISTER=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test User\"}")
echo "$REGISTER" | jq .

TOKEN=$(echo "$REGISTER" | jq -r '.token')
echo ""
echo "Token: $TOKEN"

echo ""
echo "2️⃣  Get current user"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/me" | jq .

echo ""
echo "3️⃣  Login with credentials"
curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq .

echo ""
echo "✅ Tests complete!"
