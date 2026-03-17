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
| Backend | Supabase (PostgreSQL) |
| Frontend | HTML/CSS/JavaScript |
| Styling | Tailwind CSS |
| Icons | Font Awesome |

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/

2. **Supabase Account** (Free tier available)
   - Sign up at: https://supabase.com/

3. **npm** (comes with Node.js)

## Installation

### Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign in
2. Create a new project
3. Note down your project URL and API keys from **Settings > API**

### Step 2: Set Up Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `database/schema.sql` from this project
3. Run the SQL to create all tables, views, and indexes

### Step 3: Seed Demo Data (Optional)

1. In the Supabase SQL Editor
2. Copy the contents of `database/seed.sql` (or run `database/seed.js` locally)
3. Run the SQL to populate demo data

### Step 4: Configure Environment

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` with your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

   You can find these values in Supabase Dashboard > Settings > API:
   - **URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_KEY`

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Build CSS

```bash
npm run build:css
```

### Step 7: Start the Application

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

## Supabase Configuration

### Row Level Security (RLS)

For production, enable RLS on all tables. Example policies:

```sql
-- Users can only see their own data (unless admin)
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid()::text = id OR auth.jwt() ->> 'role' = 'admin');

-- Staff can only see tasks assigned to them
CREATE POLICY "Users can view assigned tasks"
ON tasks FOR SELECT
USING (assigned_to = auth.uid()::text OR assigned_by = auth.uid()::text);
```

### Storage Buckets (Optional)

For document storage, create a bucket in Supabase Storage:

1. Go to Storage in Supabase dashboard
2. Create a bucket named `documents`
3. Configure access policies

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
│   ├── db.js             # Supabase client module
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

## Troubleshooting

### Application won't start

1. **Check Supabase credentials in `.env`**

2. **Verify Supabase project is running:**
   - Go to your Supabase dashboard
   - Ensure project status is "Active"

3. **Check Node.js version:**
   ```bash
   node --version  # Should be v18+
   ```

### Connection errors

1. **Verify API keys:**
   - Go to Supabase Dashboard > Settings > API
   - Ensure URL and keys are correct in `.env`

2. **Check network connectivity:**
   - Ensure you can reach `https://your-project.supabase.co`

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

1. Go to Supabase SQL Editor
2. Run:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
3. Re-run the schema.sql

## Security Notes

⚠️ **Important Security Considerations:**

1. **Password Storage**: Demo uses plain text passwords. For production:
   - Implement bcrypt or argon2 password hashing
   - Never store plain text passwords

2. **Supabase Security**:
   - Enable Row Level Security (RLS) on all tables
   - Use anon key for client-side, service_role key only on server
   - Review security policies regularly

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
