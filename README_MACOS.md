# Schema Designer — macOS Setup Guide

Visual schema designer for new MySQL / Postgres projects.

Features:

* Generate MySQL/Postgres DDL
* Generate Prisma schema
* Upload Excel and generate INSERT statements
* AI-assisted schema design with Groq
* Editable data dictionary

\---

# Prerequisites

## 1\. Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Verify:

```bash
brew --version
```

\---

## 2\. Install Python 3.10+

Using Homebrew:

```bash
brew install python
```

Verify:

```bash
python3 --version
```

\---

## 3\. Install Node.js 18+

Using Homebrew:

```bash
brew install node
```

Verify:

```bash
node --version
npm --version
```

\---

# Optional: Enable AI Features

Get a free Groq API key:

https://console.groq.com/keys

Set environment variables:

```bash
export GROQ\_API\_KEY="your\_api\_key\_here"

# Optional
export GROQ\_MODEL="llama-3.3-70b-versatile"
```

If omitted, the application still works without AI features.

\---

# Start the Backend

Open Terminal:

```bash
cd \~/Downloads/hackathon/backend

python3 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

Expected output:

```text
Uvicorn running on http://127.0.0.1:8000
```

API Docs:

```text
http://127.0.0.1:8000/docs
```

Leave this terminal running.

\---

# Start the Frontend

Open a second Terminal window:

```bash
cd \~/Downloads/hackathon/frontend

npm install

npm run dev
```

Expected output:

```text
Local: http://localhost:5173/
```

Open in browser:

```text
http://127.0.0.1:5173
```

\---

# Restart Later

Backend:

```bash
cd \~/Downloads/hackathon/backend

source .venv/bin/activate

uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd \~/Downloads/hackathon/frontend

npm run dev
```

\---

# Stop Everything

Press:

```text
Ctrl + C
```

in both terminals.

\---

# Common Issues

## brew: command not found

Install Homebrew first.

\---

## python3: command not found

Reinstall Python or restart Terminal.

\---

## uvicorn: command not found

Activate the virtual environment again:

```bash
source .venv/bin/activate
```

\---

## Port 8000 already in use

Use another port:

```bash
uvicorn app.main:app --reload --port 8001
```

Update frontend proxy if needed.

\---

## Port 5173 already in use

```bash
npm run dev -- --port 5174
```

\---

## npm install fails

```bash
npm cache clean --force
```

\---

## AI features not working

Verify:

```bash
echo $GROQ\_API\_KEY
```

\---

# Useful Commands

Check running ports:

```bash
lsof -i :8000
lsof -i :5173
```

Kill a process:

```bash
kill -9 PID
```

Check Python location:

```bash
which python3
```

Activate virtual environment:

```bash
source .venv/bin/activate
```

