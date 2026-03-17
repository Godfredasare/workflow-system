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
  console.log('Initializing Supabase connection...');
  
  try {
    db = require('./database/db');
    
    // Test connection
    const connected = await db.checkConnection();
    dbInitialized = connected;
    
    if (!connected) {
      console.error('Could not connect to Supabase');
      console.log('Please check your SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
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
    const client = db.getClient();
    
    // Query user with credentials
    const { data: user, error } = await client
      .from('users')
      .select('id, username, full_name, email, role, department_id, is_active')
      .eq('username', username)
      .eq('password', password)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return { success: false, message: error.message };
    }

    if (user) {
      // Update last login
      await client
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
      
      // Log activity
      logActivity(user.id, 'login', 'user', user.id, 'User logged in');
      
      // Get department name if assigned
      let department = null;
      if (user.department_id) {
        const { data: dept } = await client
          .from('departments')
          .select('id, name')
          .eq('id', user.department_id)
          .single();
        department = dept;
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
    const client = db.getClient();
    const { data: users, error } = await client
      .from('users')
      .select(`
        id, username, full_name, email, role, department_id, is_active, created_at,
        departments ( name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, message: error.message };
    }

    // Transform data to match expected format
    const transformedUsers = users.map(u => ({
      ...u,
      department_name: u.departments?.name || null
    }));

    return { success: true, users: transformedUsers };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('users:create', async (event, userData) => {
  try {
    const id = uuidv4();
    const client = db.getClient();
    
    const { error } = await client
      .from('users')
      .insert({
        id,
        username: userData.username,
        password: userData.password,
        full_name: userData.full_name,
        email: userData.email,
        role: userData.role,
        department_id: userData.department_id
      });

    if (error) {
      return { success: false, message: error.message };
    }
    
    logActivity(userData.createdBy, 'create', 'user', id, `Created user: ${userData.username}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('users:update', async (event, { id, data, updatedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('users')
      .update(data)
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
    logActivity(updatedBy, 'update', 'user', id, 'Updated user profile');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('users:delete', async (event, { id, deletedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
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
    const client = db.getClient();
    
    // Get departments with staff count
    const { data: departments, error } = await client
      .from('departments')
      .select(`
        id, name, description, created_at,
        users ( id )
      `)
      .order('name');

    if (error) {
      return { success: false, message: error.message };
    }

    // Transform to include staff count
    const transformed = departments.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.created_at,
      staff_count: d.users?.length || 0
    }));

    return { success: true, departments: transformed };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('departments:create', async (event, { data, createdBy }) => {
  try {
    const id = uuidv4();
    const client = db.getClient();
    
    const { error } = await client
      .from('departments')
      .insert({
        id,
        name: data.name,
        description: data.description,
        head_id: data.head_id
      });

    if (error) {
      return { success: false, message: error.message };
    }
    
    logActivity(createdBy, 'create', 'department', id, `Created department: ${data.name}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('departments:update', async (event, { id, data, updatedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('departments')
      .update({
        name: data.name,
        description: data.description,
        head_id: data.head_id
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
    logActivity(updatedBy, 'update', 'department', id, 'Updated department');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('departments:delete', async (event, { id, deletedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
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
    const client = db.getClient();
    
    const { data: routes, error } = await client
      .from('workflow_routes')
      .select(`
        id, name, description, is_active, created_at,
        workflow_stages ( id )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, message: error.message };
    }

    const transformed = routes.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      is_active: r.is_active,
      created_at: r.created_at,
      stage_count: r.workflow_stages?.length || 0
    }));

    return { success: true, routes: transformed };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:getById', async (event, id) => {
  try {
    const client = db.getClient();
    
    const { data: route, error: routeError } = await client
      .from('workflow_routes')
      .select('id, name, description, is_active, created_at, created_by')
      .eq('id', id)
      .single();

    if (routeError) {
      return { success: false, message: routeError.message };
    }

    const { data: stages, error: stagesError } = await client
      .from('workflow_stages')
      .select(`
        id, route_id, stage_order, name, description,
        department_id, approver_role,
        departments ( name )
      `)
      .eq('route_id', id)
      .order('stage_order');

    if (stagesError) {
      return { success: false, message: stagesError.message };
    }

    const transformedStages = stages.map(s => ({
      ...s,
      department_name: s.departments?.name || null
    }));

    return { success: true, route: { ...route, stages: transformedStages } };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:create', async (event, { data, createdBy }) => {
  try {
    const id = uuidv4();
    const client = db.getClient();
    
    // Create route
    const { error: routeError } = await client
      .from('workflow_routes')
      .insert({
        id,
        name: data.name,
        description: data.description,
        created_by: createdBy
      });

    if (routeError) {
      return { success: false, message: routeError.message };
    }

    // Create stages
    const stagesToInsert = data.stages.map(stage => ({
      id: uuidv4(),
      route_id: id,
      stage_order: stage.order,
      name: stage.name,
      description: stage.description,
      department_id: stage.department_id,
      approver_role: stage.approver_role
    }));

    const { error: stagesError } = await client
      .from('workflow_stages')
      .insert(stagesToInsert);

    if (stagesError) {
      return { success: false, message: stagesError.message };
    }

    logActivity(createdBy, 'create', 'workflow', id, `Created workflow: ${data.name}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:update', async (event, { id, data, updatedBy }) => {
  try {
    const client = db.getClient();
    
    // Update route
    const { error: routeError } = await client
      .from('workflow_routes')
      .update({
        name: data.name,
        description: data.description,
        is_active: data.is_active
      })
      .eq('id', id);

    if (routeError) {
      return { success: false, message: routeError.message };
    }

    // Delete existing stages
    await client.from('workflow_stages').delete().eq('route_id', id);

    // Create new stages
    const stagesToInsert = data.stages.map(stage => ({
      id: uuidv4(),
      route_id: id,
      stage_order: stage.order,
      name: stage.name,
      description: stage.description,
      department_id: stage.department_id,
      approver_role: stage.approver_role
    }));

    const { error: stagesError } = await client
      .from('workflow_stages')
      .insert(stagesToInsert);

    if (stagesError) {
      return { success: false, message: stagesError.message };
    }

    logActivity(updatedBy, 'update', 'workflow', id, 'Updated workflow');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workflows:delete', async (event, { id, deletedBy }) => {
  try {
    const client = db.getClient();
    
    // Delete stages first
    await client.from('workflow_stages').delete().eq('route_id', id);
    
    // Delete route
    const { error } = await client
      .from('workflow_routes')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
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
    const client = db.getClient();
    
    let query = client
      .from('documents')
      .select(`
        id, title, description, file_name, file_type, current_stage,
        status, priority, deadline, created_at, updated_at,
        departments ( name ),
        users!documents_uploaded_by_fkey ( full_name ),
        workflow_routes ( name )
      `);

    if (filters?.department_id) {
      query = query.eq('department_id', filters.department_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.uploaded_by) {
      query = query.eq('uploaded_by', filters.uploaded_by);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data: documents, error } = await query;

    if (error) {
      return { success: false, message: error.message };
    }

    // Get stage counts for each document
    const transformedDocs = await Promise.all(documents.map(async (doc) => {
      const { count } = await client
        .from('workflow_stages')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', doc.workflow_route_id);

      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        file_name: doc.file_name,
        file_type: doc.file_type,
        current_stage: doc.current_stage,
        status: doc.status,
        priority: doc.priority,
        deadline: doc.deadline,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        department_name: doc.departments?.name || null,
        uploader_name: doc.users?.full_name || null,
        workflow_name: doc.workflow_routes?.name || null,
        total_stages: count || 0
      };
    }));

    return { success: true, documents: transformedDocs };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:getById', async (event, id) => {
  try {
    const client = db.getClient();
    
    const { data: doc, error: docError } = await client
      .from('documents')
      .select(`
        *,
        departments ( name ),
        users!documents_uploaded_by_fkey ( full_name ),
        workflow_routes ( name )
      `)
      .eq('id', id)
      .single();

    if (docError) {
      return { success: false, message: docError.message };
    }

    if (!doc) {
      return { success: false, message: 'Document not found' };
    }

    // Get versions
    const { data: versions } = await client
      .from('document_versions')
      .select(`
        *,
        users ( full_name )
      `)
      .eq('document_id', id)
      .order('version_number', { ascending: false });

    // Get approvals
    const { data: approvals } = await client
      .from('document_approvals')
      .select(`
        *,
        users ( full_name ),
        workflow_stages ( name )
      `)
      .eq('document_id', id)
      .order('created_at', { ascending: false });

    // Get stages
    const { data: stages } = await client
      .from('workflow_stages')
      .select(`
        *,
        departments ( name )
      `)
      .eq('route_id', doc.workflow_route_id)
      .order('stage_order');

    const document = {
      ...doc,
      department_name: doc.departments?.name || null,
      uploader_name: doc.users?.full_name || null,
      workflow_name: doc.workflow_routes?.name || null,
      versions: versions?.map(v => ({
        ...v,
        uploader_name: v.users?.full_name || null
      })) || [],
      approvals: approvals?.map(a => ({
        ...a,
        approver_name: a.users?.full_name || null,
        stage_name: a.workflow_stages?.name || null
      })) || [],
      workflowStages: stages?.map(s => ({
        ...s,
        department_name: s.departments?.name || null
      })) || []
    };

    return { success: true, document };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:upload', async (event, { data, uploadedBy }) => {
  try {
    const id = uuidv4();
    const client = db.getClient();
    
    // Store file locally (or use Supabase Storage)
    const documentsDir = path.join(app.getPath('userData'), 'documents');
    
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const fileName = `${id}_${data.file_name}`;
    const filePath = path.join(documentsDir, fileName);
    fs.copyFileSync(data.temp_path, filePath);

    const { error } = await client
      .from('documents')
      .insert({
        id,
        title: data.title,
        description: data.description,
        file_path: filePath,
        file_name: data.file_name,
        file_type: data.file_type,
        file_size: data.file_size,
        department_id: data.department_id,
        uploaded_by: uploadedBy,
        workflow_route_id: data.workflow_route_id,
        priority: data.priority,
        deadline: data.deadline
      });

    if (error) {
      return { success: false, message: error.message };
    }

    logActivity(uploadedBy, 'upload', 'document', id, `Uploaded document: ${data.title}`);
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:update', async (event, { id, data, updatedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('documents')
      .update({
        title: data.title,
        description: data.description,
        priority: data.priority,
        deadline: data.deadline,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }

    logActivity(updatedBy, 'update', 'document', id, 'Updated document');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:approve', async (event, { documentId, stageId, action, comments, approverId }) => {
  try {
    const client = db.getClient();
    
    // Record approval
    const approvalId = uuidv4();
    const { error: approvalError } = await client
      .from('document_approvals')
      .insert({
        id: approvalId,
        document_id: documentId,
        stage_id: stageId,
        approver_id: approverId,
        action,
        comments
      });

    if (approvalError) {
      return { success: false, message: approvalError.message };
    }

    // Get current document
    const { data: doc } = await client
      .from('documents')
      .select('current_stage, workflow_route_id')
      .eq('id', documentId)
      .single();

    // Get total stages
    const { count } = await client
      .from('workflow_stages')
      .select('id', { count: 'exact', head: true })
      .eq('route_id', doc.workflow_route_id);

    let newStatus = 'in_review';
    let newStage = doc.current_stage;

    if (action === 'approved') {
      newStage = doc.current_stage + 1;
      if (newStage >= count) {
        newStatus = 'approved';
      }
    } else if (action === 'rejected') {
      newStatus = 'rejected';
    }

    // Update document
    const { error: updateError } = await client
      .from('documents')
      .update({
        current_stage: newStage,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    logActivity(approverId, action, 'document', documentId, comments || `Document ${action}`);
    
    // Get uploader and send notification
    const { data: uploader } = await client
      .from('documents')
      .select('uploaded_by')
      .eq('id', documentId)
      .single();

    if (uploader) {
      createNotification(
        uploader.uploaded_by,
        action,
        `Document ${action}`,
        `Your document has been ${action}. ${comments || ''}`,
        'document',
        documentId
      );
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('documents:delete', async (event, { id, deletedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('documents')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
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
    const client = db.getClient();
    
    let query = client
      .from('tasks')
      .select(`
        id, title, description, status, priority, deadline, created_at, completed_at,
        documents ( title ),
        users!tasks_assigned_by_fkey ( full_name ),
        users!tasks_assigned_to_fkey ( full_name ),
        departments ( name )
      `);

    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters?.assigned_by) {
      query = query.eq('assigned_by', filters.assigned_by);
    }
    if (filters?.department_id) {
      query = query.eq('department_id', filters.department_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data: tasks, error } = await query;

    if (error) {
      return { success: false, message: error.message };
    }

    // Transform results
    const transformedTasks = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      created_at: t.created_at,
      completed_at: t.completed_at,
      document_title: t.documents?.title || null,
      assigned_by_name: t.users?.[0]?.full_name || null,
      assigned_to_name: t.users?.[1]?.full_name || null,
      department_name: t.departments?.name || null
    }));

    return { success: true, tasks: transformedTasks };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:getById', async (event, id) => {
  try {
    const client = db.getClient();
    
    const { data: task, error } = await client
      .from('tasks')
      .select(`
        *,
        documents ( title ),
        users!tasks_assigned_by_fkey ( full_name ),
        users!tasks_assigned_to_fkey ( full_name ),
        departments ( name )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    const transformedTask = {
      ...task,
      document_title: task.documents?.title || null,
      assigned_by_name: task.users?.[0]?.full_name || null,
      assigned_to_name: task.users?.[1]?.full_name || null,
      department_name: task.departments?.name || null
    };

    return { success: true, task: transformedTask };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:create', async (event, { data, createdBy }) => {
  try {
    const id = uuidv4();
    const client = db.getClient();
    
    const { error } = await client
      .from('tasks')
      .insert({
        id,
        title: data.title,
        description: data.description,
        document_id: data.document_id,
        assigned_by: createdBy,
        assigned_to: data.assigned_to,
        department_id: data.department_id,
        priority: data.priority,
        deadline: data.deadline
      });

    if (error) {
      return { success: false, message: error.message };
    }

    logActivity(createdBy, 'create', 'task', id, `Created task: ${data.title}`);
    createNotification(
      data.assigned_to,
      'task_assigned',
      'New Task Assigned',
      `You have been assigned a new task: ${data.title}`,
      'task',
      id
    );

    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:update', async (event, { id, data, updatedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('tasks')
      .update({
        title: data.title,
        description: data.description,
        priority: data.priority,
        deadline: data.deadline,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }

    logActivity(updatedBy, 'update', 'task', id, 'Updated task');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:updateStatus', async (event, { id, status, updatedBy }) => {
  try {
    const client = db.getClient();
    
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    
    const { error } = await client
      .from('tasks')
      .update({
        status,
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }

    logActivity(updatedBy, 'status_change', 'task', id, `Task status changed to ${status}`);
    
    // Get task details and notify creator
    const { data: task } = await client
      .from('tasks')
      .select('assigned_by, title')
      .eq('id', id)
      .single();

    if (task && status === 'completed') {
      createNotification(
        task.assigned_by,
        'task_completed',
        'Task Completed',
        `Task "${task.title}" has been completed`,
        'task',
        id
      );
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('tasks:delete', async (event, { id, deletedBy }) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, message: error.message };
    }
    
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
    const client = db.getClient();
    
    const { data: messages, error } = await client
      .from('chat_messages')
      .select(`
        *,
        users ( full_name, role )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, message: error.message };
    }

    const transformed = messages.map(m => ({
      ...m,
      sender_name: m.users?.full_name || null,
      sender_role: m.users?.role || null
    }));

    return { success: true, messages: transformed };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('messages:getByDocument', async (event, documentId) => {
  try {
    const client = db.getClient();
    
    const { data: messages, error } = await client
      .from('chat_messages')
      .select(`
        *,
        users ( full_name, role )
      `)
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, message: error.message };
    }

    const transformed = messages.map(m => ({
      ...m,
      sender_name: m.users?.full_name || null,
      sender_role: m.users?.role || null
    }));

    return { success: true, messages: transformed };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('messages:send', async (event, { data, senderId }) => {
  try {
    const id = uuidv4();
    const client = db.getClient();
    
    const { error } = await client
      .from('chat_messages')
      .insert({
        id,
        task_id: data.task_id,
        document_id: data.document_id,
        sender_id: senderId,
        receiver_id: data.receiver_id,
        message: data.message
      });

    if (error) {
      return { success: false, message: error.message };
    }

    if (data.receiver_id) {
      createNotification(
        data.receiver_id,
        'new_message',
        'New Message',
        'You have a new message',
        'message',
        id
      );
    }

    return { success: true, id };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('messages:markAsRead', async (event, messageId) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('chat_messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) {
      return { success: false, message: error.message };
    }

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
    const client = db.getClient();
    
    const { data: notifications, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, notifications };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('notifications:markAsRead', async (event, notificationId) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('notifications:markAllAsRead', async (event, userId) => {
  try {
    const client = db.getClient();
    
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) {
      return { success: false, message: error.message };
    }

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
    const client = db.getClient();
    
    let query = client
      .from('activity_logs')
      .select(`
        *,
        users ( full_name )
      `);

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    query = query.order('created_at', { ascending: false }).limit(100);

    const { data: logs, error } = await query;

    if (error) {
      return { success: false, message: error.message };
    }

    const transformed = logs.map(l => ({
      ...l,
      user_name: l.users?.full_name || null
    }));

    return { success: true, logs: transformed };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// =====================================================
// IPC Handlers - Dashboard Stats
// =====================================================

ipcMain.handle('dashboard:getStats', async (event, userId, role) => {
  try {
    const client = db.getClient();
    let stats = {};

    if (role === 'admin') {
      const [users, departments, documents, tasks, pendingApprovals] = await Promise.all([
        client.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        client.from('departments').select('id', { count: 'exact', head: true }),
        client.from('documents').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
        client.from('tasks').select('id', { count: 'exact', head: true }),
        client.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      stats.users = { count: users.count };
      stats.departments = { count: departments.count };
      stats.documents = { count: documents.count };
      stats.tasks = { count: tasks.count };
      stats.pendingApprovals = { count: pendingApprovals.count };
    } else if (role === 'hr') {
      const [totalTasks, pendingTasks, completedTasks] = await Promise.all([
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_by', userId),
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_by', userId).eq('status', 'pending'),
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_by', userId).eq('status', 'completed')
      ]);

      stats.totalTasks = { count: totalTasks.count };
      stats.pendingTasks = { count: pendingTasks.count };
      stats.completedTasks = { count: completedTasks.count };
    } else if (role === 'head') {
      const [pendingApprovals, approvedThisMonth] = await Promise.all([
        client.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
        client.from('document_approvals').select('id', { count: 'exact', head: true }).eq('approver_id', userId).eq('action', 'approved')
      ]);

      stats.pendingApprovals = { count: pendingApprovals.count };
      stats.approvedThisMonth = { count: approvedThisMonth.count };
    } else if (role === 'staff') {
      const [assignedTasks, pendingTasks, inProgressTasks, completedTasks, documents] = await Promise.all([
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId),
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('status', 'pending'),
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('status', 'in_progress'),
        client.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('status', 'completed'),
        client.from('documents').select('id', { count: 'exact', head: true }).eq('uploaded_by', userId)
      ]);

      stats.assignedTasks = { count: assignedTasks.count };
      stats.pendingTasks = { count: pendingTasks.count };
      stats.inProgressTasks = { count: inProgressTasks.count };
      stats.completedTasks = { count: completedTasks.count };
      stats.documents = { count: documents.count };
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

async function logActivity(userId, action, entityType, entityId, details) {
  const id = uuidv4();
  const client = db.getClient();
  
  try {
    const { error } = await client
      .from('activity_logs')
      .insert({
        id,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details
      });
    
    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

async function createNotification(userId, type, title, message, entityType, entityId) {
  const id = uuidv4();
  const client = db.getClient();
  
  try {
    const { error } = await client
      .from('notifications')
      .insert({
        id,
        user_id: userId,
        type,
        title,
        message,
        entity_type: entityType,
        entity_id: entityId
      });
    
    if (error) {
      console.error('Error creating notification:', error);
    }
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}
