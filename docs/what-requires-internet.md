# What Requires Internet

This document outlines all features, operations, and third-party interactions in **Notepad AI** that require active internet connectivity.

---

## 1. Cloud Authentication (Supabase Auth)
* **Initial User Registration (`/api/auth/signup`)**:
  - Provisioning a brand-new cloud user identity through the Supabase Authentication API.
  - Verification emails sent via Supabase email dispatchers (subject to rate limiting).
* **Cloud Session Sign-In (`/api/auth/login`)**:
  - Exchanging email and password for a Supabase-issued JSON Web Token (JWT).
  - *Note*: Once a user successfully logs in online at least once, their credentials are encrypted with `bcrypt` in the local cache, allowing future sign-ins to operate offline.
* **Token Verification with Cloud Admin API**:
  - Validating incoming user bearer tokens against `supabase_admin.auth.get_user(token)`.
  - Fetching user metadata changes made outside the local client.

---

## 2. Cloud Database Synchronization (Supabase PostgreSQL)
* **Primary PostgreSQL Storage**:
  - Reading from and writing to the hosted Supabase PostgreSQL cluster using `DATABASE_URL` (SSL-pooled via psycopg2/SQLAlchemy).
  - Cross-device sync: syncing documents, folders, notes, and study sets across multiple machines.
* **Online ➔ Offline Data Sync Trigger**:
  - `sync_user_data_to_offline` queries the hosted Supabase PostgreSQL instance over the internet to download updated records into local SQLite.

---

## 3. Initial Setup & Dependency Acquisition
* **Downloading Local LLM Weights**:
  - Executing `ollama pull <model-name>` (such as `qwen3.5:4b` or `gemma4:31b-cloud`) downloads multi-gigabyte neural network weights from the Ollama model registry.
  - Subsequent inferences with the downloaded model do not require internet access.
* **Package & Dependency Installation**:
  - Node package managers (`npm install` / `bun install`) downloading packages from the npm registry.
  - Python package manager (`pip install -r requirements.txt`) downloading packages from PyPI.
