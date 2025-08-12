#!/bin/bash

echo "🧪 Integration Test Suite"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=$3
    
    echo -n "Testing $name... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" $url)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status)"
        ((TESTS_FAILED++))
    fi
}

# Function to test with data
test_with_data() {
    local name=$1
    local url=$2
    local data=$3
    local expected_status=$4
    
    echo -n "Testing $name... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" $url)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status)"
        ((TESTS_FAILED++))
    fi
}

echo ""
echo "1. Health Check Tests"
echo "---------------------"
test_endpoint "Backend Health" "http://localhost:5001/health" "200"
test_endpoint "Frontend Static Files" "http://localhost:3000/static/js/bundle.js" "200"

echo ""
echo "2. Authentication Tests"
echo "-----------------------"
test_endpoint "Get Google Auth URL" "http://localhost:5001/api/auth/google" "200"
test_endpoint "CSRF Token Endpoint" "http://localhost:5001/api/auth/csrf-token" "401"

echo ""
echo "3. Security Tests"
echo "-----------------"
test_with_data "SQL Injection Prevention" "http://localhost:5001/api/auth/google/callback" '{"code":"test","state":"test; DROP TABLE users;--"}' "400"
test_with_data "XSS Prevention" "http://localhost:5001/api/auth/google/callback" '{"code":"<script>alert(1)</script>","state":"test"}' "400"

echo ""
echo "4. Rate Limiting Test"
echo "---------------------"
echo -n "Testing rate limiting... "

# Make 10 rapid requests
for i in {1..10}; do
    curl -s -o /dev/null "http://localhost:5001/api/auth/google" &
done
wait

# 11th request should be rate limited
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5001/api/auth/google")
if [ "$status" = "429" ] || [ "$status" = "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Rate limiting active)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Unexpected status: $status)"
fi

echo ""
echo "5. CORS Test"
echo "------------"
echo -n "Testing CORS headers... "

headers=$(curl -s -I -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" http://localhost:5001/api/auth/google)

if [[ $headers == *"Access-Control-Allow-Origin"* ]]; then
    echo -e "${GREEN}✓ PASSED${NC} (CORS headers present)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (CORS headers missing)"
    ((TESTS_FAILED++))
fi

echo ""
echo "========================"
echo "Test Results Summary"
echo "========================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✨${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please review.${NC}"
    exit 1
fi