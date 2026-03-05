#!/bin/bash
# Test all 4 templates with PDF generation service
# Usage: ./test-all-templates.sh

API_KEY="${PDF_SERVICE_API_KEY:-QpAj8AES8c0JcbPYi7QL+HahZFx4DeGmz7HEnoDedms=}"
BASE_URL="${PDF_SERVICE_URL:-http://localhost:3002}"

TEMPLATES=("minimal-ssr" "card-ssr" "sidebar-ssr" "timeline-ssr")

echo "==============================================="
echo "Testing PDF Generation Service"
echo "==============================================="
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:10}..."
echo ""

# Test health endpoint first
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.'
echo ""
echo "-----------------------------------------------"

# Test templates list
echo "2. Testing templates list..."
curl -s \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/api/templates" | jq '.'
echo ""
echo "-----------------------------------------------"

# Test each template
for TEMPLATE in "${TEMPLATES[@]}"; do
  echo ""
  echo "3. Testing template: $TEMPLATE"
  echo "-----------------------------------------------"

  # Update templateSlug in test data
  TEMP_DATA=$(cat test-data.json | jq --arg template "$TEMPLATE" '.templateSlug = $template')

  # Generate PDF
  RESPONSE=$(echo "$TEMP_DATA" | curl -s \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d @- \
    "$BASE_URL/api/generate-pdf")

  # Check if successful
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

  if [ "$SUCCESS" = "true" ]; then
    echo "✅ SUCCESS: PDF generated for $TEMPLATE"

    # Get PDF size and decode
    SIZE=$(echo "$RESPONSE" | jq -r '.metadata.size')
    DURATION=$(echo "$RESPONSE" | jq -r '.metadata.duration')

    echo "   Size: $SIZE bytes"
    echo "   Duration: ${DURATION}ms"

    # Save PDF to file
    echo "$RESPONSE" | jq -r '.pdfBase64' | base64 -d > "test-output-${TEMPLATE}.pdf"
    echo "   Saved to: test-output-${TEMPLATE}.pdf"
  else
    echo "❌ FAILED: $TEMPLATE"
    echo "$RESPONSE" | jq '.'
  fi

  echo ""
done

echo "==============================================="
echo "Testing Complete!"
echo "==============================================="
echo ""
echo "Check the following files for generated PDFs:"
for TEMPLATE in "${TEMPLATES[@]}"; do
  if [ -f "test-output-${TEMPLATE}.pdf" ]; then
    SIZE=$(stat -f%z "test-output-${TEMPLATE}.pdf" 2>/dev/null || stat -c%s "test-output-${TEMPLATE}.pdf" 2>/dev/null)
    echo "  - test-output-${TEMPLATE}.pdf (${SIZE} bytes)"
  fi
done
echo ""
