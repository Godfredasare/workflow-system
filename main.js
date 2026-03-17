const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');

// Database module
let db;

// Initialize persistent store for app settings
const store = new Store();

// Main window reference
let mainWindow;

// Database initialization status
let dbInitialized = false;

// =====================================================
// Database Initialization
// =====================================================

async function initDatabase() {
  console.log('Initializing database connection...');
  
  try {
    db = require('./database/db');
    
    // Check if we need to setup database
    const needsSetup = store.get('needsDbSetup', true);
    
    if (needsSetup) {
      console.log('First run - setting up database...');
      
      // Try to create database and initialize
      try {
        await db.createDatabase();
        await db.initializeDatabase();
        
        // Seed demo data
        const { seedDatabase } = require('./database/seed');
        await seedDatabase();
        
        store.set('needsDbSetup', false);
        console.log('Database setup complete');
      } catch (setupError) {
        console.error('Database setup error:', setupError.message);
        console.log('Attempting to connect anyway...');
      }
    }
    
    // Test connection
    const connected = await db.checkConnection();
    dbInitialized = connected;
    
    if (!connected) {
      console.error('Could not connect to database');
    }
    
    return connected;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

// =====================================================
// Window Creation
// =====================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('src/index.html');

  // Create application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { label: 'Refresh', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =====================================================
// App Lifecycle
// =====================================================

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (db) {
    await db.closePool();
  }
});

// =====================================================
// IPC Handlers - Window Controls
// =====================================================

ipcMain.on('window-minimize', () => mainWindow?.minimize());

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => mainWindow?.close());

// =====================================================
// IPC Handlers - Authentication
// =====================================================

ipcMain.handle('auth:login', async (event, { username, password }) => {
  try {
    const user = await db.queryOne(`
      SELECT id, username, full_name, email, role, department_id, is_active
      FROM users 
      WHERE username = $1 AND password = $2 AND is_active = TRUE
    `, [username, password]);

    if (user) {
      // Update last login
      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
      
      // Log activity
      logActivity(user.id, 'login', 'user', user.id, 'User logged in');
      
      // Get department name if assigned
      let department = null;
      if (user.department_id) {
        department = await db.queryOne('SELECT id, name FROM departments WHERE id = $1', [user.department_id]);
      }

      return { success: true, user: { ...user, department } };
    }
    return { success: false, message: 'Invalid username or password' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:logout', async (event, userId) => {
  logActivity(userId, 'logout', 'user', userId, 'User logged out');
  return { success: true };
});

// =====================================================
// IPC Handlers - Users
// =====================================================

ipcMain.handle('users:getAll', async () => {
  try {
    const users = await db.queryAll(`
      SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.created_at DESC
    `);
    return { success: true, users };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('users:create', async (event, userData) => {
  try {
    const id = uuidv4();
    await db.query(`
      INSERT INTO users (id, username, password, full_name, email, role, department_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, userData.username, userData.password, userData.full_name, userData.email, userData.role, userData.department_id]);
    
    logActivity(userData.createdBy, 'create', 'user', id, `Created user: ${userData.username}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('users:update', async (event, { id, data, updatedBy }) => {
  try {
    const setClauses = [];
    const values = [];
    let paramCount = 1;
    
    if (data.full_name) { setClauses.push(`full_name = $${paramCount++}`); values.push(data.full_name); }
    if (data.email) { setClauses.push(`email = $${paramCount++}`); values.push(data.email); }
    if (data.role) { setClauses.push(`role = $${paramCount++}`); values.push(data.role); }
    if (data.department_id !== undefined) { setClauses.push(`department_id = $${paramCount++}`); values.push(data.department_id); }
    if (data.is_active !== undefined) { setClauses.push(`is_active = $${paramCount++}`); values.push(data.is_active); }
    if (data.password) { setClauses.push(`password = $${paramCount++}`); values.push(data.password); }

    values.push(id);
    await db.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramCount}`, values);
    
    logActivity(updatedBy, 'update', 'user', id, 'Updated user profile');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('users:delete', async (event, { id, deletedBy }) => {
  try {
    await db.query('UPDATE users SET is_active = FALSE WHERE id = $1', [id]);
    logActivity(deletedBy, 'delete', 'user', id, 'Deactivated user');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Departments
// =====================================================

ipcMain.handle('departments:getAll', async () => {
  try {
    const departments = await db.queryAll(`
      SELECT d.id, d.name, d.description, d.created_at,
             u.full_name as head_name,
             (SELECT COUNT(*) FROM users WHERE department_id = d.id AND is_active = TRUE) as staff_count
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      ORDER BY d.name
    `);
    return { success: true, departments };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('departments:create', async (event, { data, createdBy }) => {
  try {
    const id = uuidv4();
    await db.query(`
      INSERT INTO departments (id, name, description, head_id)
      VALUES ($1, $2, $3, $4)
    `, [id, data.name, data.description, data.head_id]);
    
    logActivity(createdBy, 'create', 'department', id, `Created department: ${data.name}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('departments:update', async (event, { id, data, updatedBy }) => {
  try {
    await db.query(`
      UPDATE departments SET name = $1, description = $2, head_id = $3 WHERE id = $4
    `, [data.name, data.description, data.head_id, id]);
    
    logActivity(updatedBy, 'update', 'department', id, 'Updated department');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('departments:delete', async (event, { id, deletedBy }) => {
  try {
    await db.query('DELETE FROM departments WHERE id = $1', [id]);
    logActivity(deletedBy, 'delete', 'department', id, 'Deleted department');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Workflows
// =====================================================

ipcMain.handle('workflows:getAll', async () => {
  try {
    const routes = await db.queryAll(`
      SELECT wr.id, wr.name, wr.description, wr.is_active, wr.created_at,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM workflow_stages WHERE route_id = wr.id) as stage_count
      FROM workflow_routes wr
      LEFT JOIN users u ON wr.created_by = u.id
      ORDER BY wr.created_at DESC
    `);
    return { success: true, routes };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:getById', async (event, id) => {
  try {
    const route = await db.queryOne(`
      SELECT wr.id, wr.name, wr.description, wr.is_active, wr.created_at, wr.created_by
      FROM workflow_routes wr
      WHERE wr.id = $1
    `, [id]);

    const stages = await db.queryAll(`
      SELECT ws.id, ws.route_id, ws.stage_order, ws.name, ws.description,
             ws.department_id, ws.approver_role,
             d.name as department_name
      FROM workflow_stages ws
      LEFT JOIN departments d ON ws.department_id = d.id
      WHERE ws.route_id = $1
      ORDER BY ws.stage_order
    `, [id]);

    return { success: true, route: { ...route, stages } };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:create', async (event, { data, createdBy }) => {
  try {
    const id = uuidv4();
    
    await db.transaction(async (client) => {
      // Create route
      await client.query(`
        INSERT INTO workflow_routes (id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
      `, [id, data.name, data.description, createdBy]);

      // Create stages
      for (const stage of data.stages) {
        await client.query(`
          INSERT INTO workflow_stages (id, route_id, stage_order, name, description, department_id, approver_role)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuidv4(), id, stage.order, stage.name, stage.description, stage.department_id, stage.approver_role]);
      }
    });

    logActivity(createdBy, 'create', 'workflow', id, `Created workflow: ${data.name}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:update', async (event, { id, data, updatedBy }) => {
  try {
    await db.transaction(async (client) => {
      // Update route
      await client.query(`
        UPDATE workflow_routes SET name = $1, description = $2, is_active = $3 WHERE id = $4
      `, [data.name, data.description, data.is_active, id]);

      // Delete existing stages
      await client.query('DELETE FROM workflow_stages WHERE route_id = $1', [id]);

      // Create new stages
      for (const stage of data.stages) {
        await client.query(`
          INSERT INTO workflow_stages (id, route_id, stage_order, name, description, department_id, approver_role)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuidv4(), id, stage.order, stage.name, stage.description, stage.department_id, stage.approver_role]);
      }
    });

    logActivity(updatedBy, 'update', 'workflow', id, 'Updated workflow');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:delete', async (event, { id, deletedBy }) => {
  try {
    await db.query('DELETE FROM workflow_stages WHERE route_id = $1', [id]);
    await db.query('DELETE FROM workflow_routes WHERE id = $1', [id]);
    logActivity(deletedBy, 'delete', 'workflow', id, 'Deleted workflow');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Documents
// =====================================================

ipcMain.handle('documents:getAll', async (event, filters) => {
  try {
    let query = `
      SELECT d.id, d.title, d.description, d.file_name, d.file_type, d.current_stage,
             d.status, d.priority, d.deadline, d.created_at, d.updated_at,
             dep.name as department_name,
             u.full_name as uploader_name,
             wr.name as workflow_name,
             (SELECT COUNT(*) FROM workflow_stages WHERE route_id = d.workflow_route_id) as total_stages
      FROM documents d
      LEFT JOIN departments dep ON d.department_id = dep.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN workflow_routes wr ON d.workflow_route_id = wr.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters?.department_id) {
      query += ` AND d.department_id = $${paramCount++}`;
      params.push(filters.department_id);
    }
    if (filters?.status) {
      query += ` AND d.status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters?.uploaded_by) {
      query += ` AND d.uploaded_by = $${paramCount++}`;
      params.push(filters.uploaded_by);
    }
    if (filters?.search) {
      query += ` AND (d.title ILIKE $${paramCount} OR d.description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY d.created_at DESC';

    const documents = await db.queryAll(query, params);
    return { success: true, documents };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:getById', async (event, id) => {
  try {
    const doc = await db.queryOne(`
      SELECT d.*, 
             dep.name as department_name,
             u.full_name as uploader_name,
             wr.name as workflow_name
      FROM documents d
      LEFT JOIN departments dep ON d.department_id = dep.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN workflow_routes wr ON d.workflow_route_id = wr.id
      WHERE d.id = $1
    `, [id]);

    if (!doc) {
      return { success: false, message: 'Document not found' };
    }

    const versions = await db.queryAll(`
      SELECT dv.*, u.full_name as uploader_name
      FROM document_versions dv
      LEFT JOIN users u ON dv.uploaded_by = u.id
      WHERE dv.document_id = $1
      ORDER BY dv.version_number DESC
    `, [id]);

    const approvals = await db.queryAll(`
      SELECT da.*, u.full_name as approver_name, ws.name as stage_name
      FROM document_approvals da
      LEFT JOIN users u ON da.approver_id = u.id
      LEFT JOIN workflow_stages ws ON da.stage_id = ws.id
      WHERE da.document_id = $1
      ORDER BY da.created_at DESC
    `, [id]);

    const stages = await db.queryAll(`
      SELECT ws.*, d.name as department_name
      FROM workflow_stages ws
      LEFT JOIN departments d ON ws.department_id = d.id
      WHERE ws.route_id = $1
      ORDER BY ws.stage_order
    `, [doc.workflow_route_id]);

    return { success: true, document: { ...doc, versions, approvals, workflowStages: stages } };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:upload', async (event, { data, uploadedBy }) => {
  try {
    const id = uuidv4();
    const documentsDir = path.join(app.getPath('userData'), 'documents');
    
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const fileName = `${id}_${data.file_name}`;
    const filePath = path.join(documentsDir, fileName);
    fs.copyFileSync(data.temp_path, filePath);

    await db.query(`
      INSERT INTO documents (id, title, description, file_path, file_name, file_type, file_size,
                             department_id, uploaded_by, workflow_route_id, priority, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [id, data.title, data.description, filePath, data.file_name, data.file_type, data.file_size,
        data.department_id, uploadedBy, data.workflow_route_id, data.priority, data.deadline]);

    logActivity(uploadedBy, 'upload', 'document', id, `Uploaded document: ${data.title}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:update', async (event, { id, data, updatedBy }) => {
  try {
    await db.query(`
      UPDATE documents SET title = $1, description = $2, priority = $3, deadline = $4, updated_at = NOW()
      WHERE id = $5
    `, [data.title, data.description, data.priority, data.deadline, id]);

    logActivity(updatedBy, 'update', 'document', id, 'Updated document');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:approve', async (event, { documentId, stageId, action, comments, approverId }) => {
  try {
    await db.transaction(async (client) => {
      // Record approval
      await client.query(`
        INSERT INTO document_approvals (id, document_id, stage_id, approver_id, action, comments)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), documentId, stageId, approverId, action, comments]);

      // Get current stage and total stages
      const doc = await client.queryOne('SELECT current_stage, workflow_route_id FROM documents WHERE id = $1', [documentId]);
      const totalStages = await client.queryOne('SELECT COUNT(*) as count FROM workflow_stages WHERE route_id = $1', [doc.workflow_route_id]);

      let newStatus = 'in_review';
      let newStage = doc.current_stage;

      if (action === 'approved') {
        newStage = doc.current_stage + 1;
        if (newStage >= totalStages.count) {
          newStatus = 'approved';
        }
      } else if (action === 'rejected') {
        newStatus = 'rejected';
      }

      // Update document
      await client.query(`
        UPDATE documents SET current_stage = $1, status = $2, updated_at = NOW() WHERE id = $3
      `, [newStage, newStatus, documentId]);
    });

    logActivity(approverId, action, 'document', documentId, comments || `Document ${action}`);
    
    const uploader = await db.queryOne('SELECT uploaded_by FROM documents WHERE id = $1', [documentId]);
    createNotification(uploader.uploaded_by, action, `Document ${action}`, 
                      `Your document has been ${action}. ${comments || ''}`, 'document', documentId);

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:delete', async (event, { id, deletedBy }) => {
  try {
    await db.query('UPDATE documents SET status = $1 WHERE id = $2', ['archived', id]);
    logActivity(deletedBy, 'delete', 'document', id, 'Archived document');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Tasks
// =====================================================

ipcMain.handle('tasks:getAll', async (event, filters) => {
  try {
    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.deadline, t.created_at, t.completed_at,
             d.title as document_title,
             u1.full_name as assigned_by_name,
             u2.full_name as assigned_to_name,
             dep.name as department_name
      FROM tasks t
      LEFT JOIN documents d ON t.document_id = d.id
      LEFT JOIN users u1 ON t.assigned_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN departments dep ON t.department_id = dep.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters?.assigned_to) {
      query += ` AND t.assigned_to = $${paramCount++}`;
      params.push(filters.assigned_to);
    }
    if (filters?.assigned_by) {
      query += ` AND t.assigned_by = $${paramCount++}`;
      params.push(filters.assigned_by);
    }
    if (filters?.department_id) {
      query += ` AND t.department_id = $${paramCount++}`;
      params.push(filters.department_id);
    }
    if (filters?.status) {
      query += ` AND t.status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters?.search) {
      query += ` AND (t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY t.created_at DESC';

    const tasks = await db.queryAll(query, params);
    return { success: true, tasks };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:getById', async (event, id) => {
  try {
    const task = await db.queryOne(`
      SELECT t.*, 
             d.title as document_title,
             u1.full_name as assigned_by_name,
             u2.full_name as assigned_to_name,
             dep.name as department_name
      FROM tasks t
      LEFT JOIN documents d ON t.document_id = d.id
      LEFT JOIN users u1 ON t.assigned_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN departments dep ON t.department_id = dep.id
      WHERE t.id = $1
    `, [id]);

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    return { success: true, task };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:create', async (event, { data, createdBy }) => {
  try {
    const id = uuidv4();
    await db.query(`
      INSERT INTO tasks (id, title, description, document_id, assigned_by, assigned_to, department_id, priority, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, data.title, data.description, data.document_id, createdBy, data.assigned_to, 
        data.department_id, data.priority, data.deadline]);

    logActivity(createdBy, 'create', 'task', id, `Created task: ${data.title}`);
    createNotification(data.assigned_to, 'task_assigned', 'New Task Assigned',
                      `You have been assigned a new task: ${data.title}`, 'task', id);

    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:update', async (event, { id, data, updatedBy }) => {
  try {
    await db.query(`
      UPDATE tasks SET title = $1, description = $2, priority = $3, deadline = $4, updated_at = NOW()
      WHERE id = $5
    `, [data.title, data.description, data.priority, data.deadline, id]);

    logActivity(updatedBy, 'update', 'task', id, 'Updated task');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:updateStatus', async (event, { id, status, updatedBy }) => {
  try {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    await db.query(`
      UPDATE tasks SET status = $1, completed_at = $2, updated_at = NOW() WHERE id = $3
    `, [status, completedAt, id]);

    logActivity(updatedBy, 'status_change', 'task', id, `Task status changed to ${status}`);
    
    const task = await db.queryOne('SELECT assigned_by, title FROM tasks WHERE id = $1', [id]);
    if (task && status === 'completed') {
      createNotification(task.assigned_by, 'task_completed', 'Task Completed',
                        `Task "${task.title}" has been completed`, 'task', id);
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:delete', async (event, { id, deletedBy }) => {
  try {
    await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    logActivity(deletedBy, 'delete', 'task', id, 'Deleted task');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Messages
// =====================================================

ipcMain.handle('messages:getByTask', async (event, taskId) => {
  try {
    const messages = await db.queryAll(`
      SELECT cm.*, u.full_name as sender_name, u.role as sender_role
      FROM chat_messages cm
      LEFT JOIN users u ON cm.sender_id = u.id
      WHERE cm.task_id = $1
      ORDER BY cm.created_at ASC
    `, [taskId]);
    return { success: true, messages };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('messages:getByDocument', async (event, documentId) => {
  try {
    const messages = await db.queryAll(`
      SELECT cm.*, u.full_name as sender_name, u.role as sender_role
      FROM chat_messages cm
      LEFT JOIN users u ON cm.sender_id = u.id
      WHERE cm.document_id = $1
      ORDER BY cm.created_at ASC
    `, [documentId]);
    return { success: true, messages };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('messages:send', async (event, { data, senderId }) => {
  try {
    const id = uuidv4();
    await db.query(`
      INSERT INTO chat_messages (id, task_id, document_id, sender_id, receiver_id, message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, data.task_id, data.document_id, senderId, data.receiver_id, data.message]);

    if (data.receiver_id) {
      createNotification(data.receiver_id, 'new_message', 'New Message',
                        `You have a new message`, 'message', id);
    }

    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('messages:markAsRead', async (event, messageId) => {
  try {
    await db.query('UPDATE chat_messages SET is_read = TRUE WHERE id = $1', [messageId]);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Notifications
// =====================================================

ipcMain.handle('notifications:getAll', async (event, userId) => {
  try {
    const notifications = await db.queryAll(`
      SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
    `, [userId]);
    return { success: true, notifications };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('notifications:markAsRead', async (event, notificationId) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [notificationId]);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('notifications:markAllAsRead', async (event, userId) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Activity Logs
// =====================================================

ipcMain.handle('logs:getAll', async (event, filters) => {
  try {
    let query = `
      SELECT al.*, u.full_name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters?.user_id) {
      query += ` AND al.user_id = $${paramCount++}`;
      params.push(filters.user_id);
    }
    if (filters?.entity_type) {
      query += ` AND al.entity_type = $${paramCount++}`;
      params.push(filters.entity_type);
    }
    if (filters?.action) {
      query += ` AND al.action = $${paramCount++}`;
      params.push(filters.action);
    }

    query += ' ORDER BY al.created_at DESC LIMIT 100';

    const logs = await db.queryAll(query, params);
    return { success: true, logs };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Dashboard Stats
// =====================================================

ipcMain.handle('dashboard:getStats', async (event, userId, role) => {
  try {
    let stats = {};

    if (role === 'admin') {
      stats.users = await db.queryOne('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
      stats.departments = await db.queryOne('SELECT COUNT(*) as count FROM departments');
      stats.documents = await db.queryOne('SELECT COUNT(*) as count FROM documents WHERE status != $1', ['archived']);
      stats.tasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks');
      stats.pendingApprovals = await db.queryOne('SELECT COUNT(*) as count FROM documents WHERE status = $1', ['pending']);
    } else if (role === 'hr') {
      stats.totalTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_by = $1', [userId]);
      stats.pendingTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_by = $1 AND status = $2', [userId, 'pending']);
      stats.completedTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_by = $1 AND status = $2', [userId, 'completed']);
    } else if (role === 'head') {
      stats.pendingApprovals = await db.queryOne('SELECT COUNT(*) as count FROM documents WHERE status = $1', ['in_review']);
      stats.approvedThisMonth = await db.queryOne(
        'SELECT COUNT(*) as count FROM document_approvals WHERE approver_id = $1 AND action = $2',
        [userId, 'approved']
      );
    } else if (role === 'staff') {
      stats.assignedTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1', [userId]);
      stats.pendingTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 AND status = $2', [userId, 'pending']);
      stats.inProgressTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 AND status = $2', [userId, 'in_progress']);
      stats.completedTasks = await db.queryOne('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 AND status = $2', [userId, 'completed']);
      stats.documents = await db.queryOne('SELECT COUNT(*) as count FROM documents WHERE uploaded_by = $1', [userId]);
    }

    return { success: true, stats };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - File Dialog
// =====================================================

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'] }
    ]
  });
  return result;
});

// =====================================================
// Helper Functions
// =====================================================

function logActivity(userId, action, entityType, entityId, details) {
  const id = uuidv4();
  db.query(`
    INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, userId, action, entityType, entityId, details]).catch(err => {
    console.error('Error logging activity:', err);
  });
}

function createNotification(userId, type, title, message, entityType, entityId) {
  const id = uuidv4();
  db.query(`
    INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [id, userId, type, title, message, entityType, entityId]).catch(err => {
    console.error('Error creating notification:', err);
  });
}
