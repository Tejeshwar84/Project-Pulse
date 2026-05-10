# ProjectPulse Report

## 1. Project Overview

ProjectPulse is an AI-enabled project management dashboard built with Next.js 14 and Prisma. It centralizes project tracking, task management, budget monitoring, team collaboration, meetings, and risk analysis for organizations.

The application supports role-based access for Admin, Manager, and Employee users, includes real-time style chat and status updates, and integrates with Mistral AI to provide risk assessments for projects.

## 2. Core Features

- **Project Management**
  - Create, view, and manage projects
  - Track project status, deadlines, budget, spent amount, and risk metadata

- **Task Management**
  - Kanban-style task board with statuses such as todo, in-progress, blocked, and done
  - Task assignment to users with priority and deadline support

- **Budget Tracking**
  - Project budget and spending monitoring
  - Expense logging linked to projects and users

- **AI Risk Analysis**
  - AI-driven project risk assessment via Mistral API when a valid API key is configured
  - Rule-based fallback analysis when AI integration is unavailable
  - Risk score and analysis results stored on the project record

- **Team Collaboration**
  - Team creation and membership management
  - Project chat/messages per project

- **Meetings & Todos**
  - Meeting scheduling, participant tracking, notes, and completion status
  - Personal todos for users tied to a company context

- **Authentication & Access Control**
  - Email/password login with verification and approval workflows
  - Session cookie authentication using base64-encoded session payloads
  - User roles: `admin`, `manager`, `employee`

## 3. Technology Stack

- Frontend & backend: `Next.js 14` with App Router
- Database: `PostgreSQL` via Prisma ORM
- ORM: `Prisma`
- Authentication: custom session cookies using `lib/auth.ts`
- AI integration: `Mistral AI` chat completions
- Styling: `Tailwind CSS`
- Charts/visualization: `recharts`
- Email: `resend` (dependency included)
- Password hashing: `bcryptjs`

## 4. Database Model Summary

Key Prisma models and relationships:

- `Company`
  - Contains teams, users, meetings, todos, and expenses
- `Project`
  - Related to tasks, messages, expenses, and optionally a team
  - Stores budget, spent amount, risk score, and risk reason
- `Task`
  - Belongs to a project and optionally an assignee user
  - Supports statuses and priority levels
- `Message`
  - Project-specific chat history
- `User`
  - Includes verification and approval state
  - Connected to teams, tasks, todos, meetings, and expenses
- `Team` and `TeamMember`
  - Manage team membership and project association
- `Meeting` and `MeetingParticipant`
  - Track meeting scheduling, completion, notes, and participants
- `Expense`
  - Linked to projects, users, and companies
- `Todo`
  - User-specific action items in the company context

## 5. Key API Endpoints

### Authentication

- `POST /api/auth/login` — login user and set session cookie
- `POST /api/auth/register` — register new user
- `POST /api/auth/verify` — verify user email
- `POST /api/auth/logout` — clear session cookie

### Project & Task Operations

- `app/api/projects/route.ts` — project CRUD and query operations
- `app/api/tasks/route.ts` — task CRUD and board operations
- `app/api/expenses/route.ts` — expense creation and retrieval
- `app/api/meetings/route.ts` and `app/api/meetings/[id]/route.ts` — meeting scheduling and completion
- `app/api/messages/route.ts` — project chat messages

### AI and Risk Analysis

- `POST /api/ai-risk` — calculates project risk score and analysis
  - Uses data from project tasks, budget consumption, deadline proximity, and recent chat
  - Attempts Mistral AI completion when `MISTRAL_API_KEY` is configured
  - Falls back to internal rule-based scoring when AI is unavailable

### Administration

- `app/api/teams/route.ts` and `app/api/teams/[id]/route.ts` — manage teams
- `app/api/users/approvals/route.ts` — user approval workflows
- `app/api/companies/route.ts` — company data management

## 6. Authentication Approach

The app uses a lightweight session mechanism:

- Session payload is encoded in a cookie named `pp_session`
- Payload includes `userId`, `email`, `name`, and `role`
- `lib/auth.ts` handles encoding and decoding of the cookie
- `lib/db-auth.ts` handles user login and password verification with bcrypt

## 7. Deployment & Run Instructions

### Local development

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

### Production build

```bash
npm run build
npm start
```

### Required environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `DIRECT_URL` — direct database connection string
- `MISTRAL_API_KEY` — optional, for AI risk analysis
- `RESEND_API_KEY` — if email or Resend integration is used

## 8. Observations and Recommendations

- The architecture is modular and suited for future expansion with additional AI-driven analytics or reporting features.
- Adding stronger authorization middleware would improve security beyond role-based session payload handling.
- A dedicated admin audit dashboard or reporting page could make the risk and finance capabilities more valuable for executive users.
- If production-ready shipping is desired, consider replacing cookie session payload encoding with signed JWT or server-side session storage.

## 9. Suggested Improvements

- Add centralized API authorization and route protection middleware
- Expand AI use cases to include budget forecasting, timeline predictions, and meeting follow-up summaries
- Implement real-time updates using WebSockets or server-sent events for task board and chat
- Add more detailed reporting pages for budget variance, task throughput, and team workload
