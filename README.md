# 🚀 TeamSpace

> A multi-tenant, real-time team collaboration SaaS built to bring workspaces, channels, messaging, and team communication into one place.

![Status](https://img.shields.io/badge/status-in%20development-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Fastify](https://img.shields.io/badge/Fastify-5.x-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E)
![Auth](https://img.shields.io/badge/Auth-Supabase%20Auth-3ECF8E)

---

## ✨ Overview

**TeamSpace** is a Slack/Discord-inspired collaboration platform designed around **multi-tenant workspaces**.

The project is being built as a full-stack SaaS with a strong focus on:

- 🔐 Secure authentication and authorization
- 🏢 Multi-tenant workspaces
- 💬 Channel-based communication
- ⚡ Real-time messaging
- 👥 Workspace membership and RBAC
- 📁 File sharing
- 🔔 Notifications
- 🟢 Presence and typing indicators
- 📈 Scalable backend architecture

The project is also being used as a hands-on way to learn and apply **backend engineering, system design, distributed systems, and production architecture**.

---

## 🏗️ Current Architecture

```text
                    ┌─────────────────────┐
                    │       Client        │
                    └──────────┬──────────┘
                               │
                         HTTP + JWT
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Fastify Server    │
                    │     TypeScript      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        Authentication      REST API       Error Handler
              │                │
              ▼                ▼
       Supabase Auth       Route Handlers
                               │
                               ▼
                        PostgreSQL / Supabase
                               │
                ┌──────────────┼──────────────┐
                │              │              │
             users        workspaces      memberships
                                              │
                                              ▼
                                           channels
                                              │
                                              ▼
                                           messages
```

### Planned evolution

```text
Fastify
   │
   ├── REST API
   ├── WebSockets
   │
   ├── PostgreSQL
   ├── Redis Pub/Sub
   │
   ├── Background Workers
   └── Object Storage
```

---

## 🛠️ Tech Stack

### Backend

- **Node.js**
- **TypeScript**
- **Fastify**
- **Zod**
- **PostgreSQL**
- **Supabase**
- **node-postgres (`pg`)**
- **node-pg-migrate**

### Authentication

- **Supabase Auth**
- JWT-based authentication
- Google OAuth — planned

### Planned infrastructure

- WebSockets
- Redis / Redis Pub/Sub
- Background workers
- Object storage
- Docker
- CI/CD

---

## 📂 Project Structure

```text
teamspace/
├── apps/
│   └── server/
│       ├── src/
│       │   ├── config/
│       │   ├── plugins/
│       │   ├── routes/
│       │   ├── types/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   └── fastify.d.ts
│       │
│       ├── db/
│       │   ├── migrations/
│       │   └── seed.ts
│       │
│       ├── scripts/
│       └── package.json
│
├── apps/web/
│   └── ...
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 🔐 Authentication Flow

TeamSpace uses Supabase Auth as the identity provider.

```text
User
 │
 ▼
Supabase Auth
 │
 ▼
JWT Access Token
 │
 ▼
Authorization: Bearer <token>
 │
 ▼
Fastify Auth Plugin
 │
 ▼
Supabase token verification
 │
 ▼
Supabase auth.users.id
 │
 ▼
TeamSpace users.auth_user_id
 │
 ▼
TeamSpace users.id
```

Protected API routes require a valid JWT.

Public infrastructure routes such as health checks remain accessible without authentication.

---

## 🗄️ Database

TeamSpace uses **PostgreSQL hosted by Supabase**.

Current core entities:

```text
users
  │
  ├──────── memberships ──────── workspaces
  │                                  │
  │                                  ▼
  └────────────────────────────── channels
                                     │
                                     ▼
                                  messages
```

The database is managed through versioned migrations.

Current database tooling includes:

- Database migrations
- Indexes
- Foreign keys
- Unique constraints
- Seed data
- Connection pooling
- Parameterized SQL

---

## 🌐 Current API

### Health

```http
GET /health
GET /health/db
```

### Workspaces

```http
GET /api/workspaces
GET /api/workspaces/:workspaceId
```

### Channels

```http
GET /api/workspaces/:workspaceId/channels
```

### Messages

```http
GET  /api/channels/:channelId/messages
POST /api/channels/:channelId/messages
```

Protected routes use:

```http
Authorization: Bearer <JWT>
```

---

## 🧪 Development

### Prerequisites

Make sure you have:

- Node.js
- pnpm
- A Supabase project

### Install dependencies

```bash
pnpm install
```

### Environment variables

Create a `.env` file in the server application with the required configuration.

Example:

```env
NODE_ENV=development
PORT=4000
HOST=127.0.0.1

DATABASE_URL=your_database_url

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

> ⚠️ Never commit `.env` or real credentials to Git.

### Run type checking

```bash
pnpm typecheck
```

### Start development server

```bash
pnpm dev
```

The API runs locally on:

```text
http://127.0.0.1:4000
```

---

## 🗃️ Database Development

Run migrations using the project's migration command:

```bash
pnpm db:migrate
```

Seed the development database:

```bash
pnpm db:seed
```

The seed process creates development data such as:

- Users
- Workspace
- Channels
- Initial messages

---

## 🧠 System Design Concepts

TeamSpace is intentionally being developed as a practical system-design project.

Concepts being explored include:

- REST API design
- Authentication vs authorization
- JWT authentication
- Multi-tenancy
- Database indexing
- Connection pooling
- Pagination
- Data integrity and constraints
- WebSocket architecture
- Distributed real-time messaging
- Redis Pub/Sub
- Horizontal scaling
- Caching
- Rate limiting
- Background jobs
- Object storage
- Observability
- Load testing
- Fault tolerance

---

## 🗺️ Roadmap

### Foundation

- [x] Requirements
- [x] Repository + monorepo
- [x] Backend skeleton
- [x] Database connection
- [x] Database migrations
- [x] Seed data
- [x] Supabase authentication

### Authentication & Core SaaS

- [ ] Google OAuth
- [ ] Workspace creation
- [ ] Workspace membership
- [ ] RBAC
- [ ] Channel management
- [ ] Complete REST messaging

### Real-time Collaboration

- [ ] WebSocket connection
- [ ] Real-time messaging
- [ ] DMs
- [ ] Threads
- [ ] Reactions
- [ ] Presence
- [ ] Typing indicators

### Scalability

- [ ] Redis Pub/Sub
- [ ] Multiple server instances
- [ ] Background jobs
- [ ] Caching
- [ ] Rate limiting

### Platform

- [ ] File uploads
- [ ] Notifications
- [ ] Search
- [ ] Audit logs
- [ ] Analytics
- [ ] Stripe subscriptions

### Production

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load testing
- [ ] Docker
- [ ] CI/CD
- [ ] Production deployment
- [ ] Monitoring
- [ ] Failure testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Final polish
- [ ] 🚀 Production release

---

## 🎯 Project Goal

TeamSpace isn't just being built to create another chat application.

The goal is to understand how a modern SaaS platform evolves from:

```text
Single Fastify Server
        ↓
Database-backed REST API
        ↓
Authentication
        ↓
Authorization
        ↓
Real-time communication
        ↓
Redis + distributed systems
        ↓
Horizontal scaling
        ↓
Production SaaS
```

---

## 📌 Project Status

**Currently:** Backend foundation + authenticated REST API

**Next milestone:** Google OAuth

The project is actively under development. 🚧

---

<div align="center">

### Made with 💖 by COACH

</div>
