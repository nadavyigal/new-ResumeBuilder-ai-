# Resume PDF Generation Service

Docker-based microservice for high-quality PDF generation using Puppeteer and Chromium.

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example and update values)
cp .env.example .env

# Build Docker image
docker-compose build

# Start service
docker-compose up -d

# Check health
curl http://localhost:3001/health

# View logs
docker-compose logs -f pdf-generator

# Stop service
docker-compose down
```

## Architecture

This service extracts PDF generation from the Next.js application to solve Puppeteer deployment limitations on Vercel.

```
Next.js (Vercel) --HTTP--> PDF Service (Docker) --Puppeteer--> PDF
```

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4.x
- **PDF Engine**: Puppeteer-core + Chromium
- **Base Image**: node:20-bookworm (Debian)
- **Fonts**: Noto (Hebrew, Arabic, CJK), Liberation (MS alternatives)

## API Endpoints

### GET /health

Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "chromium": true,
  "uptime": 3600,
  "version": "1.0.0",
  "memory": {
    "used": 512,
    "total": 2048
  }
}
```

### POST /api/generate-pdf

Generate PDF from resume data (requires authentication).

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <PDF_SERVICE_SECRET>
```

**Request Body:**
```json
{
  "resumeData": { ... },
  "templateSlug": "minimal-ssr",
  "customization": { ... }
}
```

**Response (Success):**
```json
{
  "success": true,
  "pdfBase64": "JVBERi0xLjQK...",
  "metadata": {
    "renderer": "puppeteer",
    "templateSlug": "minimal-ssr",
    "sizeBytes": 145826,
    "generatedAt": "2025-12-30T10:30:00Z",
    "renderTimeMs": 1234
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Template not found",
  "code": "TEMPLATE_ERROR"
}
```

## Environment Variables

See `.env.example` for all available variables.

**Required:**
- `PDF_SERVICE_SECRET` - Shared secret for authentication
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

**Optional:**
- `PORT` - HTTP server port (default: 3001)
- `LOG_LEVEL` - Logging level (default: info)
- `PUPPETEER_MAX_PAGES` - Max concurrent PDFs (default: 5)
- `PUPPETEER_TIMEOUT_MS` - Timeout per PDF (default: 30000)

## Development

```bash
# Run without Docker (requires Chromium installed)
npm run dev

# Build Docker image
npm run docker:build

# Start Docker service
npm run docker:up

# View logs
npm run docker:logs

# Stop Docker service
npm run docker:down
```

## Project Structure

```
pdf-service/
├── server.js                # Express entry point
├── healthcheck.js           # Docker health check
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env                     # Local environment (gitignored)
├── .env.example             # Environment template
│
├── routes/
│   ├── generate-pdf.js     # PDF generation endpoint
│   └── health.js           # Health check endpoint
│
├── lib/
│   ├── pdf-generator.js    # Puppeteer wrapper
│   ├── template-renderer.js # React SSR
│   ├── customization-css.js # CSS generation
│   └── validators.js       # Request validation
│
├── utils/
│   ├── logger.js           # Winston logging
│   ├── auth.js             # Token validation
│   └── error-handler.js    # Error middleware
│
└── templates/
    ├── minimal-ssr/
    ├── card-ssr/
    ├── sidebar-ssr/
    └── timeline-ssr/
```

## Production Deployment

See main project [plan file](../../.claude/plans/giggly-stargazing-axolotl.md) for comprehensive deployment guide.

**Quick Fly.io Deployment:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Initialize app
fly launch --name resume-pdf-service --region ord --no-deploy

# Set secrets
fly secrets set PDF_SERVICE_SECRET=$(openssl rand -base64 32)
fly secrets set ALLOWED_ORIGINS="https://your-vercel-app.vercel.app"

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs --follow
```

## Testing

```bash
# Test health check
curl http://localhost:3001/health

# Test PDF generation (once implemented)
curl -X POST http://localhost:3001/api/generate-pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -d @test-resume.json | jq -r '.pdfBase64' | base64 -d > test.pdf
```

## Troubleshooting

**Container won't start:**
- Check logs: `docker-compose logs pdf-generator`
- Verify .env file exists with valid `PDF_SERVICE_SECRET`
- Ensure port 3001 is not already in use

**CORS errors:**
- Add origin to `ALLOWED_ORIGINS` in .env
- Restart Docker container

**Memory issues:**
- Reduce `PUPPETEER_MAX_PAGES` in .env
- Increase `mem_limit` in docker-compose.yml
- Check available system memory

**Chromium crashes:**
- Verify `/dev/shm` volume mount in docker-compose.yml
- Check container memory limits
- Review logs for "bus error" messages

## Phase 1 Status: ✅ Complete

Phase 1 (Service Skeleton) has been completed:
- ✅ Directory structure created
- ✅ package.json with dependencies
- ✅ Dockerfile (multi-stage build)
- ✅ docker-compose.yml
- ✅ Environment configuration (.env, .env.example)
- ✅ Express server skeleton (server.js)
- ✅ Health check endpoint
- ✅ Utility files (logger, auth, error-handler)
- ✅ Docker health check (healthcheck.js)

**Next Steps:** Phase 2 - Implement PDF generation logic

## License

See main project LICENSE file.
