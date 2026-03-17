# COCOBOD Workflow & Document Approval System

A desktop application for managing internal document processing, task assignment, approval workflows, and communication between administrators, HR, and staff members.

## Features

- **User Authentication** - Secure login with role-based access control
- **Document Management** - Upload, track, and manage documents with version control
- **Task Management** - Create, assign, and track tasks with deadlines and priorities
- **Workflow Routes** - Define custom approval workflows between departments
- **Document Approval** - Multi-stage document approval process
- **Real-time Chat** - Project-based messaging with file attachments
- **Activity Logs** - Comprehensive audit trail of all system activities
- **Notifications** - Real-time notifications for tasks and approvals

## Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop Framework | Electron |
| Database | PostgreSQL |
| Backend | Node.js |
| Frontend | HTML/CSS/JavaScript |
| Styling | Tailwind CSS |
| Icons | Font Awesome |

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/

2. **PostgreSQL** (v14 or higher)
   - Download from: https://www.postgresql.org/download/
   - Make sure PostgreSQL service is running

3. **npm** (comes with Node.js)

## Installation

### Step 1: Install PostgreSQL

**Windows:**
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Default port: 5432

**Verify PostgreSQL is running:**
```bash
# Windows (PowerShell)
pg_isready

# Or connect via psql
psql -U postgres
```

### Step 2: Configure Environment

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` with your PostgreSQL credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cocobod_workflow
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   ```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Initialize Database

The database will be automatically initialized on first run, or you can manually initialize:

```bash
npm run db:init
```

This will:
- Create the `cocobod_workflow` database (if not exists)
- Create all required tables
- Seed demo data

### Step 5: Build CSS

```bash
npm run build:css
```

### Step 6: Start the Application

```bash
npm start
```

## Default Login Credentials

### Administrator Account
| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

### Demo User Accounts
| Username | Password | Role | Department |
|----------|----------|------|------------|
| `kwame.asante` | `password123` | HR Admin | Human Resources |
| `ama.mensah` | `password123` | Head of Dept | Procurement |
| `kofi.owusu` | `password123` | Staff | Procurement |
| `akua.bonsu` | `password123` | Staff | Finance |
| `yaw.darko` | `password123` | Head of Dept | Finance |
| `efua.boateng` | `password123` | Staff | Operations |

## User Roles

| Role | Permissions |
|------|-------------|
| **Administrator** | Full system access, user management, workflow configuration |
| **HR/Department Admin** | Task assignment, staff supervision |
| **Staff** | Process tasks, upload documents |
| **Head of Department** | Review and approve documents |

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts and authentication |
| `departments` | Organization departments |
| `workflow_routes` | Document workflow definitions |
| `workflow_stages` | Individual stages in workflows |
| `documents` | Uploaded documents |
| `document_versions` | Document version history |
| `document_approvals` | Approval records |
| `tasks` | Task assignments |
| `chat_messages` | Chat communications |
| `notifications` | User notifications |
| `activity_logs` | System audit trail |

### Database Diagram

```
users ──────────┬─── departments
                │
                ├─── documents ──── document_versions
                │        │
                │        ├─── document_approvals
                │        │
                │        └─── chat_messages
                │
                └─── tasks ──── chat_messages
                     │
                     └─── notifications

workflow_routes ──── workflow_stages
```

## Building for Windows

### Development Build

```bash
npm run build:css
npm start
```

### Production Build (Installer)

```bash
npm run build:win
```

The installer will be created in the `dist` directory:
```
dist/COCOBOD Workflow System Setup 1.0.0.exe
```

### Build Output
- **NSIS Installer**: Windows 10/11 compatible
- **Architectures**: x64 and ia32

## Project Structure

```
cocobod-workflow-system/
├── assets/
│   ├── icon.png          # Application icon (PNG)
│   └── icon.ico          # Application icon (Windows)
├── database/
│   ├── db.js             # Database connection module
│   ├── schema.sql        # PostgreSQL schema
│   ├── seed.js           # Demo data seeder
│   └── init.js           # Database initialization
├── src/
│   ├── components/       # Reusable UI components
│   ├── js/
│   │   └── app.js        # Main application JavaScript
│   ├── pages/            # Page templates
│   ├── styles/
│   │   ├── input.css     # Tailwind input CSS
│   │   └── output.css    # Compiled CSS
│   └── index.html        # Main HTML file
├── main.js               # Electron main process
├── preload.js            # Electron preload script
├── package.json          # Project configuration
├── tailwind.config.js    # Tailwind configuration
├── .env.example          # Environment template
└── README.md             # This file
```

## Development

### Run in Development Mode

```bash
npm run dev
```

This runs both the Tailwind CSS watcher and Electron simultaneously.

### Database Commands

```bash
# Initialize database
npm run db:init

# Seed demo data only
npm run db:seed
```

### Useful SQL Queries

```sql
-- View all users
SELECT id, username, full_name, role, is_active FROM users;

-- View document workflow progress
SELECT * FROM v_document_progress;

-- View user task summary
SELECT * FROM v_user_task_summary;

-- Check pending approvals
SELECT d.title, d.status, d.current_stage 
FROM documents d 
WHERE d.status IN ('pending', 'in_review');
```

## Troubleshooting

### Application won't start

1. **Check PostgreSQL is running:**
   ```bash
   pg_isready
   ```

2. **Verify database credentials in `.env`**

3. **Check Node.js version:**
   ```bash
   node --version  # Should be v18+
   ```

### Database connection errors

1. **Verify PostgreSQL service:**
   - Windows: Open Services, find 'postgresql-x64-14' (or similar), ensure it's running

2. **Test connection manually:**
   ```bash
   psql -U postgres -h localhost
   ```

3. **Check firewall settings:**
   - Ensure port 5432 is not blocked

### Build errors

1. **Clean install:**
   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Rebuild CSS:**
   ```bash
   npm run build:css
   ```

### Reset database

```sql
-- Connect as superuser
psql -U postgres

-- Drop and recreate database
DROP DATABASE cocobod_workflow;
CREATE DATABASE cocobod_workflow;
```

Then run:
```bash
npm run db:init
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Password Storage**: Demo uses plain text passwords. For production:
   - Implement bcrypt or argon2 password hashing
   - Never store plain text passwords

2. **Database Security**:
   - Use strong PostgreSQL passwords
   - Create a dedicated application user with limited permissions
   - Enable SSL for database connections in production

3. **Session Management**:
   - Implement session timeout
   - Add secure session handling

4. **Consider implementing**:
   - Two-factor authentication
   - Password encryption at rest
   - Audit log encryption
   - Rate limiting for login attempts

## License

MIT License - COCOBOD (Ghana Cocoa Board)

## Support

For technical support, contact the IT Department at COCOBOD.

---

**Version:** 1.0.0  
**Last Updated:** 2024
