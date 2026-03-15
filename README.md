# Orbit-Ai
**Conversational Business Intelligence Dashboard**

Orbit-Ai is an AI-powered data analysis platform that enables users to query their database using natural language. It generates optimized SQL queries, fetches real-time data, and visualizes the results through an interactive, interactive dashboard.

<img src="./frontend/public/orbit_ai_logo.svg" alt="Orbit-Ai" width="100"/>

---

## The Problem & The Solution

| Problem | Orbit-Ai Solution |
| :--- | :--- |
| **Complex Querying** | Translates natural language questions directly into optimized SQL. |
| **Manual Charting** | Parses SQL result sets and automatically selects and renders dynamic Plotly charts (bar, line, scatter, pie). |
| **Data Silos** | Supports default SQLite databases and handles ad-hoc, in-memory CSV uploads on the fly. |
| **Static Reporting** | Generates dynamic Markdown-based business insights alongside charts, strictly exportable to PDF. |

---

## Features

- **Natural Language to SQL:** Generates optimized SQLite syntax from conversational text.
- **Auto-Generated Dashboards:** Renders dynamic data visualizations using Plotly.js based on the returned dataset.
- **AI Business Insights:** Summarizes the results and provides actionable insights.
- **Collections & Bookmarks:** Supports saving dashboards and insights to custom collections.
- **PDF Export & Clipboard:** Allows exporting the dashboard as a PDF report or copying charts as high-quality PNGs.

---

## Tech Stack

### Frontend
- **Framework:** Next.js (React 19)
- **Styling:** Tailwind CSS, Framer Motion
- **Data Visualization:** Plotly.js
- **Dependencies:** Lucide React, React Markdown, jsPDF

### Backend
- **Framework:** FastAPI (Python)
- **AI Integration:** Google Gemini API 
- **Database:** SQLite, pandas (for CSV schema evaluation)

---

## Local Setup

### Prerequisites
- Node.js (v18+ recommended)
- Python (3.10+ recommended)
- Google Gemini API Key

---

### 1. Backend Service
The backend handles LLM context generation, SQL execution, and data formatting.

```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Start the uvicorn server
uvicorn main:app --reload
```
*The API runs at `http://127.0.0.1:8000`.*

---

### 2. Frontend Interface
The frontend provides the chat UI and dashboard rendering engine.

```bash
# Navigate to the frontend directory
cd frontend

# Install package dependencies
npm install

# Start the development server
npm run dev
```
*The client runs at `http://localhost:3000`.*

---

## Usage

1. Open `http://localhost:3000`.
2. Ensure the FastAPI backend is running on port 8000.
3. Submit a query in the chat input (e.g., "What is our total revenue by region?").
4. Review the generated SQL, Plotly charts, and business insights.
