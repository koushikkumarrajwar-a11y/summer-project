# Library Management System (LMS)

A modern, responsive, role-aware Library Management System built strictly according to the **Product Requirements Document (PRD)** specifications.

---

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Design Tokens, Flexbox, Grid), Vanilla JavaScript (ES6+ Modules, async/await, Canvas API for 2:3 cover cropping, Native SVG Charts). **No external UI/CSS frameworks (React/Bootstrap/Tailwind are strictly prohibited per PRD).**
- **Backend**: Node.js, Express.js, RESTful API architecture (`/api/v1`), JWT authentication with refresh token HTTP-only cookies, bcrypt (cost factor 12), Helmet, express-rate-limit, Multer, Nodemailer.
- **Database**: MongoDB with Mongoose schema validation, indexes, and automated aggregation pipelines.
- **Automation**: `node-cron` background scheduler for nightly fine accruals, overdue tracking, and reservation hold expirations.

---

## 🔑 Pre-Configured Demo Credentials

The database comes pre-seeded with full datasets and accounts for all roles:

| Role | Email / Identifier | Password | Student ID | Permissions & Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@library.com` | `Admin@12345` | — | Full system access, analytics, settings, audit trail, user CRUD |
| **Librarian** | `librarian@library.com` | `Librarian@12345` | — | Desk workspace (Issue/Return), overdue lists, fine payments & waivers, student approvals |
| **Student (Active)** | `student@library.com` | `Student@12345` | `STU-2026-001` | Browse catalogue, check borrowed books, 1-click renewal, place holds, view fines |
| **Student 2 (Overdue)** | `maya@library.com` | `Student@12345` | `STU-2026-002` | Demonstrates overdue loan (red urgency) and fine tracking |
| **Student 3 (Pending)** | `david@library.com` | `Student@12345` | `STU-2026-003` | Demonstrates self-registration pending librarian verification |

---

## 🏃 Quick Start Guide

### 1. Ensure MongoDB is Running
Make sure MongoDB is running locally on `mongodb://127.0.0.1:27017/lms`.

### 2. Seed Database (Optional / Already Initialized)
```bash
npm run seed
```

### 3. Start the Application Server
```bash
npm start
```
The application will be live at:
**[http://localhost:5000](http://localhost:5000)**

---

## ✨ Key Features & PRD Modules

1. **Authentication & Security (Section A)**
   - Student self-registration with password strength meter (min 8 chars, letter + number).
   - Account lockout for 15 minutes after 5 consecutive failed login attempts.
   - 30-minute inactivity auto-logout.
   - Single-use hashed password reset tokens (30-minute expiry) with anti-enumeration protection.

2. **Role-Aware Dashboards (Section B)**
   - **Admin**: Summary KPI cards, Native SVG circulation trends (issues vs returns), category donut chart, real-time audit feed.
   - **Librarian**: Overdue queue with 1-click return & reminder notice dispatch, daily revenue metrics.
   - **Student**: Currently borrowed books with color-coded urgency (green, amber for $\le$ 3 days, red for overdue) with 1-click loan renewals.

3. **Catalogue & Book Management (Section C)**
   - Grid and List views with debounced live search across title, author, and ISBN.
   - Faceted filters by Category, Availability, and Publication Year.
   - Add/Edit book modal with duplicate ISBN detection and **client-side Canvas 2:3 aspect ratio cover image cropper**.
   - Bulk CSV import with validation dry run and CSV export.

4. **Circulation Desk Workspace (Section E)**
   - Split-screen workspace (Student borrower on the left, Book copy on the right).
   - Enforces business rules: borrowing limits (max 3), overdue/unpaid fine blocking threshold ($20), title duplicate checks.
   - Return desk with book condition grading (Good, Damaged with repair charge, Lost with replacement + processing fee).
   - Automatic rollover of returned books to students with pending reservation holds.

5. **FIFO Reservations & Automated Fines (Sections F & G)**
   - Title hold queue when all physical copies are checked out.
   - 3-day pickup window when a book is returned before hold expires.
   - Fines ledger with partial/full payments, receipt generation, and waiver audit approval.

6. **System Settings & Audit Log (Sections J & K)**
   - Configurable loan periods, fine rates, maximum limits, and registration approval modes.
   - Immutable security audit log tracking actor, IP address, timestamp, and sensitive state changes.
