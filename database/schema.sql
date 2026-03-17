-- =====================================================
-- COCOBOD Workflow System - PostgreSQL Database Schema
-- =====================================================

-- Drop existing tables if they exist (for fresh install)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS document_approvals CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS workflow_stages CASCADE;
DROP TABLE IF EXISTS workflow_routes CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- Users Table
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK(role IN ('admin', 'hr', 'staff', 'head')),
    department_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================
-- Departments Table
-- =====================================================
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    head_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- Workflow Routes Table
-- =====================================================
CREATE TABLE workflow_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- Workflow Stages Table
-- =====================================================
CREATE TABLE workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL,
    stage_order INTEGER NOT NULL,
    department_id UUID,
    approver_role VARCHAR(20),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES workflow_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE INDEX idx_workflow_stages_route ON workflow_stages(route_id);

-- =====================================================
-- Documents Table
-- =====================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size BIGINT,
    department_id UUID,
    uploaded_by UUID NOT NULL,
    workflow_route_id UUID,
    current_stage INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'in_review', 'approved', 'rejected', 'archived')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_route_id) REFERENCES workflow_routes(id) ON DELETE SET NULL
);

CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_department ON documents(department_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_workflow ON documents(workflow_route_id);

-- =====================================================
-- Document Versions Table
-- =====================================================
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255),
    uploaded_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_document_versions_doc ON document_versions(document_id);

-- =====================================================
-- Tasks Table
-- =====================================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_id UUID,
    assigned_by UUID NOT NULL,
    assigned_to UUID NOT NULL,
    department_id UUID,
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'rejected')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX idx_tasks_status ON tasks(status);

-- =====================================================
-- Document Approvals Table
-- =====================================================
CREATE TABLE document_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    approver_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK(action IN ('approved', 'rejected', 'revision_requested')),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES workflow_stages(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_approvals_document ON document_approvals(document_id);
CREATE INDEX idx_approvals_approver ON document_approvals(approver_id);

-- =====================================================
-- Chat Messages Table
-- =====================================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID,
    document_id UUID,
    sender_id UUID NOT NULL,
    receiver_id UUID,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_task ON chat_messages(task_id);
CREATE INDEX idx_messages_document ON chat_messages(document_id);
CREATE INDEX idx_messages_sender ON chat_messages(sender_id);

-- =====================================================
-- Attachments Table
-- =====================================================
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('document', 'task', 'message')),
    entity_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);

-- =====================================================
-- Notifications Table
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    entity_type VARCHAR(50),
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- =====================================================
-- Activity Logs Table
-- =====================================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_action ON activity_logs(action);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- View for document workflow progress
CREATE OR REPLACE VIEW v_document_progress AS
SELECT 
    d.id,
    d.title,
    d.status,
    d.current_stage,
    COUNT(ws.id) as total_stages,
    ROUND(CAST(d.current_stage AS numeric) / NULLIF(COUNT(ws.id), 0) * 100, 0) as progress_percentage
FROM documents d
LEFT JOIN workflow_stages ws ON ws.route_id = d.workflow_route_id
GROUP BY d.id, d.title, d.status, d.current_stage;

-- View for user task summary
CREATE OR REPLACE VIEW v_user_task_summary AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.role,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM users u
LEFT JOIN tasks t ON t.assigned_to = u.id
WHERE u.is_active = TRUE
GROUP BY u.id, u.full_name, u.role;

-- =====================================================
-- Grant permissions (adjust as needed)
-- =====================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cocobod_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cocobod_user;
