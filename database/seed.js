require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Demo data IDs (consistent across seeding)
const IDS = {
  departments: {
    procurement: 'a0000000-0000-0000-0000-000000000001',
    finance: 'a0000000-0000-0000-0000-000000000002',
    hr: 'a0000000-0000-0000-0000-000000000003',
    operations: 'a0000000-0000-0000-0000-000000000004',
    quality: 'a0000000-0000-0000-0000-000000000005'
  },
  users: {
    admin: 'b0000000-0000-0000-0000-000000000001',
    kwame: 'b0000000-0000-0000-0000-000000000002',
    ama: 'b0000000-0000-0000-0000-000000000003',
    kofi: 'b0000000-0000-0000-0000-000000000004',
    akua: 'b0000000-0000-0000-0000-000000000005',
    yaw: 'b0000000-0000-0000-0000-000000000006',
    efua: 'b0000000-0000-0000-0000-000000000007'
  },
  workflows: {
    procurement: 'c0000000-0000-0000-0000-000000000001',
    finance: 'c0000000-0000-0000-0000-000000000002'
  },
  documents: {
    cocoa: 'd0000000-0000-0000-0000-000000000001',
    report: 'd0000000-0000-0000-0000-000000000002',
    equipment: 'd0000000-0000-0000-0000-000000000003'
  },
  tasks: {
    review: 'e0000000-0000-0000-0000-000000000001',
    verify: 'e0000000-0000-0000-0000-000000000002',
    update: 'e0000000-0000-0000-0000-000000000003'
  }
};

async function seedDatabase() {
  console.log('Starting database seeding...');
  
  try {
    // Check if data already exists
    const existingUsers = await db.queryOne('SELECT COUNT(*) as count FROM users');
    if (parseInt(existingUsers.count) > 0) {
      console.log('Database already seeded. Skipping...');
      return;
    }

    // Seed Departments
    console.log('Seeding departments...');
    await db.query(`
      INSERT INTO departments (id, name, description) VALUES
        ($1, 'Procurement', 'Handles all procurement activities and vendor management'),
        ($2, 'Finance', 'Financial management, accounting, and budgeting'),
        ($3, 'Human Resources', 'Staff management, recruitment, and welfare'),
        ($4, 'Operations', 'Core cocoa operations and logistics'),
        ($5, 'Quality Assurance', 'Quality control, standards, and compliance')
    `, [
      IDS.departments.procurement,
      IDS.departments.finance,
      IDS.departments.hr,
      IDS.departments.operations,
      IDS.departments.quality
    ]);

    // Seed Users
    console.log('Seeding users...');
    await db.query(`
      INSERT INTO users (id, username, password, full_name, email, role, department_id) VALUES
        ($1, 'admin', 'admin123', 'System Administrator', 'admin@cocobod.gh', 'admin', NULL),
        ($2, 'kwame.asante', 'password123', 'Kwame Asante', 'kwame@cocobod.gh', 'hr', $7),
        ($3, 'ama.mensah', 'password123', 'Ama Mensah', 'ama@cocobod.gh', 'head', $8),
        ($4, 'kofi.owusu', 'password123', 'Kofi Owusu', 'kofi@cocobod.gh', 'staff', $9),
        ($5, 'akua.bonsu', 'password123', 'Akua Bonsu', 'akua@cocobod.gh', 'staff', $10),
        ($6, 'yaw.darko', 'password123', 'Yaw Darko', 'yaw@cocobod.gh', 'head', $11),
        ($12, 'efua.boateng', 'password123', 'Efua Boateng', 'efua@cocobod.gh', 'staff', $13)
    `, [
      IDS.users.admin,
      IDS.users.kwame,
      IDS.users.ama,
      IDS.users.kofi,
      IDS.users.akua,
      IDS.users.yaw,
      IDS.users.efua,
      IDS.departments.hr,        // $7
      IDS.departments.procurement, // $8
      IDS.departments.procurement, // $9
      IDS.departments.finance,     // $10
      IDS.departments.finance,     // $11
      IDS.users.efua,              // $12
      IDS.departments.operations   // $13
    ]);

    // Update department heads
    await db.query(`
      UPDATE departments SET head_id = $1 WHERE id = $2
    `, [IDS.users.ama, IDS.departments.procurement]);
    
    await db.query(`
      UPDATE departments SET head_id = $1 WHERE id = $2
    `, [IDS.users.yaw, IDS.departments.finance]);

    // Seed Workflow Routes
    console.log('Seeding workflow routes...');
    await db.query(`
      INSERT INTO workflow_routes (id, name, description, created_by, is_active) VALUES
        ($1, 'Standard Procurement Approval', 'Standard workflow for procurement requests and purchase orders', $3, TRUE),
        ($2, 'Financial Document Approval', 'Workflow for financial documents, reports, and budget approvals', $3, TRUE)
    `, [
      IDS.workflows.procurement,
      IDS.workflows.finance,
      IDS.users.admin
    ]);

    // Seed Workflow Stages
    console.log('Seeding workflow stages...');
    await db.query(`
      INSERT INTO workflow_stages (id, route_id, stage_order, name, department_id, approver_role) VALUES
        -- Procurement workflow stages
        ($1, $7, 1, 'Department Review', $9, 'hr'),
        ($2, $7, 2, 'Finance Review', $10, 'head'),
        ($3, $7, 3, 'Final Approval', NULL, 'admin'),
        -- Finance workflow stages
        ($4, $8, 1, 'Initial Review', $10, 'staff'),
        ($5, $8, 2, 'Manager Approval', $10, 'head'),
        ($6, $8, 3, 'Director Approval', NULL, 'admin')
    `, [
      'f0000000-0000-0000-0000-000000000001',
      'f0000000-0000-0000-0000-000000000002',
      'f0000000-0000-0000-0000-000000000003',
      'f0000000-0000-0000-0000-000000000004',
      'f0000000-0000-0000-0000-000000000005',
      'f0000000-0000-0000-0000-000000000006',
      IDS.workflows.procurement, // $7
      IDS.workflows.finance,     // $8
      IDS.departments.procurement, // $9
      IDS.departments.finance      // $10
    ]);

    // Seed Documents
    console.log('Seeding documents...');
    await db.query(`
      INSERT INTO documents (id, title, description, workflow_route_id, uploaded_by, department_id, status, priority, current_stage) VALUES
        ($1, 'Cocoa Purchasing Agreement 2024', 'Annual cocoa purchasing agreement with local farmers for the 2024 season', $7, $9, $10, 'pending', 'high', 0),
        ($2, 'Q1 Financial Report', 'First quarter financial summary including revenue, expenses, and projections', $8, $11, $12, 'in_review', 'normal', 1),
        ($3, 'Equipment Procurement Request', 'Request for new cocoa processing equipment and machinery', $7, $13, $14, 'pending', 'urgent', 0)
    `, [
      IDS.documents.cocoa,
      IDS.documents.report,
      IDS.documents.equipment,
      IDS.workflows.procurement, // $7
      IDS.workflows.finance,     // $8
      IDS.users.kwame,           // $9 - uploaded_by
      IDS.departments.procurement, // $10
      IDS.documents.report,      // $11 - placeholder, will be replaced
      IDS.users.akua,            // $11 - uploaded_by for doc2
      IDS.departments.finance,   // $12
      IDS.users.kofi,            // $13 - uploaded_by for doc3
      IDS.departments.operations  // $14
    ]);

    // Fix: Re-insert documents with correct parameters
    await db.query(`DELETE FROM documents WHERE id IN ($1, $2, $3)`, [
      IDS.documents.cocoa,
      IDS.documents.report,
      IDS.documents.equipment
    ]);

    await db.query(`
      INSERT INTO documents (id, title, description, workflow_route_id, uploaded_by, department_id, status, priority, current_stage, created_at) VALUES
        ($1, 'Cocoa Purchasing Agreement 2024', 'Annual cocoa purchasing agreement with local farmers for the 2024 season', $4, $5, $6, 'pending', 'high', 0, NOW() - INTERVAL '5 days'),
        ($2, 'Q1 Financial Report', 'First quarter financial summary including revenue, expenses, and projections', $7, $8, $9, 'in_review', 'normal', 1, NOW() - INTERVAL '3 days'),
        ($3, 'Equipment Procurement Request', 'Request for new cocoa processing equipment and machinery', $4, $10, $11, 'pending', 'urgent', 0, NOW() - INTERVAL '1 day')
    `, [
      IDS.documents.cocoa,
      IDS.documents.report,
      IDS.documents.equipment,
      IDS.workflows.procurement,
      IDS.users.kwame,
      IDS.departments.procurement,
      IDS.workflows.finance,
      IDS.users.akua,
      IDS.departments.finance,
      IDS.users.kofi,
      IDS.departments.operations
    ]);

    // Seed Tasks
    console.log('Seeding tasks...');
    await db.query(`
      INSERT INTO tasks (id, title, description, assigned_to, assigned_by, department_id, document_id, status, priority, deadline, created_at) VALUES
        ($1, 'Review Cocoa Purchasing Agreement', 'Please review the terms and conditions in the cocoa purchasing agreement document', $7, $8, $9, $10, 'pending', 'high', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 days'),
        ($2, 'Verify Financial Calculations', 'Double check all financial figures in the Q1 financial report', $11, $12, $13, $14, 'in_progress', 'normal', NOW() + INTERVAL '5 days', NOW() - INTERVAL '1 day'),
        ($3, 'Update Staff Records', 'Update employee information in the HR database system', $15, $8, $16, NULL, 'pending', 'low', NOW() + INTERVAL '14 days', NOW())
    `, [
      IDS.tasks.review,
      IDS.tasks.verify,
      IDS.tasks.update,
      IDS.users.kofi,              // $7
      IDS.users.kwame,             // $8
      IDS.departments.procurement, // $9
      IDS.documents.cocoa,         // $10
      IDS.users.akua,              // $11
      IDS.users.yaw,               // $12
      IDS.departments.finance,     // $13
      IDS.documents.report,        // $14
      IDS.users.efua,              // $15
      IDS.departments.hr           // $16
    ]);

    // Seed Activity Logs
    console.log('Seeding activity logs...');
    await db.query(`
      INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES
        ($1, $2, 'login', 'user', $2, 'User logged into the system', NOW() - INTERVAL '1 hour'),
        ($3, $4, 'create', 'document', $5, 'Created document: Cocoa Purchasing Agreement 2024', NOW() - INTERVAL '5 days'),
        ($6, $7, 'create', 'document', $8, 'Created document: Q1 Financial Report', NOW() - INTERVAL '3 days'),
        ($9, $10, 'create', 'task', $11, 'Created task: Review Cocoa Purchasing Agreement', NOW() - INTERVAL '2 days'),
        ($12, $13, 'status_change', 'task', $14, 'Task status changed to in_progress', NOW() - INTERVAL '1 day')
    `, [
      'g0000000-0000-0000-0000-000000000001',
      IDS.users.admin,
      'g0000000-0000-0000-0000-000000000002',
      IDS.users.kwame,
      IDS.documents.cocoa,
      'g0000000-0000-0000-0000-000000000003',
      IDS.users.akua,
      IDS.documents.report,
      'g0000000-0000-0000-0000-000000000004',
      IDS.users.kwame,
      IDS.tasks.review,
      'g0000000-0000-0000-0000-000000000005',
      IDS.users.akua,
      IDS.tasks.verify
    ]);

    // Seed Notifications
    console.log('Seeding notifications...');
    await db.query(`
      INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, is_read, created_at) VALUES
        ($1, $2, 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: Review Cocoa Purchasing Agreement', 'task', $3, FALSE, NOW() - INTERVAL '2 days'),
        ($4, $5, 'document_pending', 'Document Requires Review', 'Document Q1 Financial Report requires your review', 'document', $6, TRUE, NOW() - INTERVAL '3 days'),
        ($7, $8, 'deadline_reminder', 'Deadline Approaching', 'Task "Verify Financial Calculations" deadline is approaching', 'task', $9, FALSE, NOW())
    `, [
      'h0000000-0000-0000-0000-000000000001',
      IDS.users.kofi,
      IDS.tasks.review,
      'h0000000-0000-0000-0000-000000000002',
      IDS.users.yaw,
      IDS.documents.report,
      'h0000000-0000-0000-0000-000000000003',
      IDS.users.akua,
      IDS.tasks.verify
    ]);

    console.log('Database seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase, IDS };
