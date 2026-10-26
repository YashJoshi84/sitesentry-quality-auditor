# SiteSentry — Automated Website Quality Auditor

**SiteSentry** is an autonomous website quality and accessibility auditing platform built with the MERN ecosystem, Cheerio, axe-core, Playwright, and Google Gemini AI. It inspects web pages for broken hyperlinks, missing SEO metadata, WCAG accessibility violations, and mobile layout readiness in real-time.

---

## 🌟 Key Features

### 1. Multi-Vector Auditing Engine
- **SEO & Metadata Inspection (Cheerio)**:
  - `<title>` tag presence, emptiness, and optimal character length (30–60 chars).
  - `<meta name="description">` presence, emptiness, and truncation limits.
  - Headings structure: missing `<h1>` or advisory warnings for multiple `<h1>` tags.
  - Image accessibility: missing `alt` attributes or empty text.
  - Canonical URL (`<link rel="canonical">`) checks.
  - Mobile viewport tags (`<meta name="viewport" content="width=device-width, initial-scale=1.0">`).
  - Open Graph social share metadata (`og:title`, `og:image`).
  - Document language attribute (`<html lang="...">`).

- **axe-core & Playwright Accessibility**:
  - Automated WCAG 2.1 Level AA compliance scanner.
  - Form input accessibility: detects inputs, selects, and textareas missing accessible labels (`<label for="...">` or `aria-label`).
  - Button text: identifies buttons without discernible text, icons, or aria-labels.
  - Negative/positive `tabindex` anti-pattern detection.
  - Ambiguous anchor phrases (e.g., "click here", "read more").

- **Broken Link Scanner**:
  - Extracts internal and external hyperlinks, resolving relative paths against the page URL.
  - Performs bounded concurrent HTTP HEAD/GET health verification.
  - Records HTTP response status codes (200, 301, 404, 500), response latency in milliseconds, and failure diagnostics.

- **Mobile Readiness Evaluation**:
  - Mobile viewport scaling and zoom-disable restrictions (`user-scalable=no`).
  - Detects fixed desktop pixel styles that cause horizontal scrolling.
  - Headless mobile device viewport emulation (375px mobile viewport) measuring document scroll overflow.
  - Responsive image format indicators (`srcset`, `sizes`, `<picture>`).

### 2. Gemini AI Executive Brief & Fix Generator
- **AI Executive Analysis**: Token-efficient synthesis using `gemini-3.5-flash-lite` explaining why a site scored its rating, key architectural risks, and the top 3 highest-impact quick wins.
- **One-Click Code Fixes**: Gemini generates tailored, copyable HTML/CSS code solutions directly inside finding cards.
- **Persistent MongoDB Caching**: AI analyses and code fixes are cached in MongoDB so future views consume zero tokens.

### 3. Refined Developer Dashboard & UI/UX
- **Minimalist Dark UI**: Deep charcoal canvas (`#0D0F12`), clean surface layers (`#14171B` / `#191D22`), and subtle neutral borders (`#292E35`) inspired by Linear and Vercel.
- **Radial Score Gauge**: Refined circular SVG gauge computing overall quality score (0–100) and letter grades (A+, A, B, C, F).
- **Interactive Category Breakdown**: Individual score meters for SEO (30%), Accessibility (30%), Links (20%), and Mobile (20%).
- **Prioritized Findings List**:
  - Filterable by Category and Severity (Critical Errors, Warnings, Info, Passed).
  - Instant live keyword search.
  - Expandable finding cards displaying description, offending element selector, code evidence, and recommended remediation.
- **Checked Hyperlinks Table**: Complete log of all tested links with status badges, latency, and health.
- **Reports Export**: Instant one-click download as structured JSON or RFC-4180 compliant CSV.
- **Live Real-time SSE Progress**: Server-Sent Events (SSE) streaming live stage-by-stage status and console logs without UI freezing.
- **Audit History**: All completed audits persist in MongoDB with search, score badges, timestamps, view details, and deletion capabilities.

---
## 🎥 Project Demo

Watch the demo video to see SiteSentry in action, including the website auditing workflow, category-wise quality scores, detailed findings, verified links, and audit history.

**Demo Video:** [Watch SiteSentry Demo](https://drive.google.com/file/d/1UxskEyk6u5vG7hIf6Nn6Y9Ff1aCkwKtj/view?usp=sharing)

*Note: The video demonstrates the application's interface and workflows through a screen recording.*

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 6, Tailwind CSS, Lucide React |
| **Backend** | Node.js, Express 4 |
| **Database** | MongoDB with Mongoose (with automatic embedded memory server fallback) |
| **AI Integration** | Google GenAI SDK (`@google/genai`) with Gemini 3.5 Flash |
| **HTML Parsing** | Cheerio |
| **Accessibility Engine** | axe-core, `@axe-core/playwright` |
| **Browser Automation** | Playwright (Headless Chromium) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher

*(Note: If you have a local or cloud MongoDB instance, you can specify `MONGODB_URI` in `backend/.env`. If MongoDB is not installed, SiteSentry automatically boots a zero-config high-performance embedded MongoDB engine seamlessly!)*

### Installation

Clone or open the project folder in your terminal:

```bash
# 1. Install all monorepo dependencies (backend, frontend, root)
npm run install:all

# 2. Configure environment variables (optional)
cp backend/.env.example backend/.env
```

If you wish to enable the Gemini AI Executive Brief, add your API key in `backend/.env`:
```env
PORT=5001
# MONGODB_URI=mongodb://localhost:27017/sitesentry
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running the Application

To run both the backend API and frontend Vite server concurrently with a single command:

```bash
npm run dev
```

Open your browser and navigate to:
- **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:5001](http://localhost:5001)
- **Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## 📁 Project Structure

```
.
├── .gitignore                 # Root gitignore protecting secrets, caches, and node_modules
├── package.json               # Root monorepo dev orchestrator (concurrently)
├── README.md                  # Project documentation and guide
│
├── backend/                   # Express.js REST API & Auditing Engine
│   ├── .env.example           # Environment template with placeholders
│   ├── package.json
│   └── src/
│       ├── index.js           # Server entry point & CORS configuration
│       ├── config/
│       │   └── db.js          # Mongoose DB connection with embedded fallback
│       ├── models/
│       │   └── Audit.js       # MongoDB Audit schema with AI brief fields
│       ├── controllers/
│       │   └── auditController.js # Handlers for CRUD, SSE stream, exports, and AI
│       ├── routes/
│       │   └── auditRoutes.js # Express router definitions
│       └── services/
│           ├── auditEngine.js        # Pipeline orchestrator and SSE emitter
│           ├── fetcher.js            # URL validation & HTTP HTML downloader
│           ├── seoAuditor.js         # Cheerio SEO & metadata analyzer
│           ├── a11yAuditor.js        # axe-core & Playwright WCAG scanner
│           ├── brokenLinkAuditor.js  # Concurrent bounded link verification
│           ├── mobileAuditor.js      # Viewport & mobile overflow emulator
│           ├── scoreCalculator.js    # Weighted quality scoring engine
│           ├── geminiService.js      # Gemini AI executive analysis & fix generator
│           └── exportService.js      # JSON and CSV generators
│
└── frontend/                  # React + Vite + Tailwind CSS Single Page App
    ├── package.json
    ├── vite.config.js         # Vite config with API reverse proxy
    ├── tailwind.config.js     # Minimalist dark theme tokens
    ├── index.html
    └── src/
        ├── index.css          # Design system & dark surfaces
        ├── main.jsx           # React DOM root
        ├── App.jsx            # Master state, view router, toast alerts
        ├── services/
        │   └── api.js         # Frontend REST API client
        └── components/
            ├── Navbar.jsx             # Top bar navigation & status badge
            ├── Footer.jsx             # Tech stack footer & project credits
            ├── LandingPage.jsx        # Hero, URL input, sample chips, features
            ├── AuditProgress.jsx      # Pipeline stepper & live SSE logs
            ├── ReportView.jsx         # Full report view, score gauge & AI brief
            ├── ScoreGauge.jsx         # Minimalist SVG overall score gauge
            ├── CategoryBreakdown.jsx  # SEO, A11y, Links, Mobile metric cards
            ├── FindingsList.jsx       # Filterable & expandable findings cards
            └── LinksTable.jsx         # Checked hyperlinks status table
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/audits` | Submit a website URL to begin an automated audit |
| `GET` | `/api/audits` | Retrieve all historical audits (supports `?search=`) |
| `GET` | `/api/audits/:id` | Get the complete report for an audit by ID |
| `GET` | `/api/audits/:id/progress` | Server-Sent Events (SSE) live progress stream |
| `DELETE` | `/api/audits/:id` | Delete an audit record from MongoDB |
| `GET` | `/api/audits/:id/export/json` | Download audit report as structured JSON |
| `GET` | `/api/audits/:id/export/csv` | Download audit report as RFC-4180 CSV |
| `POST` | `/api/audits/:id/ai-brief` | Generate or retrieve cached Gemini Executive Brief |
| `POST` | `/api/audits/:id/findings/:findingId/ai-fix` | Generate or retrieve cached AI code fix for a finding |
| `GET` | `/api/health` | Health check endpoint |
