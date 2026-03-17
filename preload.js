const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Authentication
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: (userId) => ipcRenderer.invoke('auth:logout', userId),

  // Users
  getUsers: () => ipcRenderer.invoke('users:getAll'),
  createUser: (userData) => ipcRenderer.invoke('users:create', userData),
  updateUser: (id, data, updatedBy) => ipcRenderer.invoke('users:update', { id, data, updatedBy }),
  deleteUser: (id, deletedBy) => ipcRenderer.invoke('users:delete', { id, deletedBy }),

  // Departments
  getDepartments: () => ipcRenderer.invoke('departments:getAll'),
  createDepartment: (data, createdBy) => ipcRenderer.invoke('departments:create', { data, createdBy }),
  updateDepartment: (id, data, updatedBy) => ipcRenderer.invoke('departments:update', { id, data, updatedBy }),
  deleteDepartment: (id, deletedBy) => ipcRenderer.invoke('departments:delete', { id, deletedBy }),

  // Workflows
  getWorkflows: () => ipcRenderer.invoke('workflows:getAll'),
  getWorkflow: (id) => ipcRenderer.invoke('workflows:getById', id),
  createWorkflow: (data, createdBy) => ipcRenderer.invoke('workflows:create', { data, createdBy }),
  updateWorkflow: (id, data, updatedBy) => ipcRenderer.invoke('workflows:update', { id, data, updatedBy }),
  deleteWorkflow: (id, deletedBy) => ipcRenderer.invoke('workflows:delete', { id, deletedBy }),

  // Documents
  getDocuments: (filters) => ipcRenderer.invoke('documents:getAll', filters),
  getDocument: (id) => ipcRenderer.invoke('documents:getById', id),
  uploadDocument: (data, uploadedBy) => ipcRenderer.invoke('documents:upload', { data, uploadedBy }),
  updateDocument: (id, data, updatedBy) => ipcRenderer.invoke('documents:update', { id, data, updatedBy }),
  approveDocument: (documentId, stageId, action, comments, approverId) => 
    ipcRenderer.invoke('documents:approve', { documentId, stageId, action, comments, approverId }),
  deleteDocument: (id, deletedBy) => ipcRenderer.invoke('documents:delete', { id, deletedBy }),

  // Tasks
  getTasks: (filters) => ipcRenderer.invoke('tasks:getAll', filters),
  getTask: (id) => ipcRenderer.invoke('tasks:getById', id),
  createTask: (data, createdBy) => ipcRenderer.invoke('tasks:create', { data, createdBy }),
  updateTask: (id, data, updatedBy) => ipcRenderer.invoke('tasks:update', { id, data, updatedBy }),
  updateTaskStatus: (id, status, updatedBy) => ipcRenderer.invoke('tasks:updateStatus', { id, status, updatedBy }),
  deleteTask: (id, deletedBy) => ipcRenderer.invoke('tasks:delete', { id, deletedBy }),

  // Messages/Chat
  getTaskMessages: (taskId) => ipcRenderer.invoke('messages:getByTask', taskId),
  getDocumentMessages: (documentId) => ipcRenderer.invoke('messages:getByDocument', documentId),
  sendMessage: (data, senderId) => ipcRenderer.invoke('messages:send', { data, senderId }),
  markMessageAsRead: (messageId) => ipcRenderer.invoke('messages:markAsRead', messageId),

  // Notifications
  getNotifications: (userId) => ipcRenderer.invoke('notifications:getAll', userId),
  markNotificationAsRead: (notificationId) => ipcRenderer.invoke('notifications:markAsRead', notificationId),
  markAllNotificationsAsRead: (userId) => ipcRenderer.invoke('notifications:markAllAsRead', userId),

  // Activity Logs
  getActivityLogs: (filters) => ipcRenderer.invoke('logs:getAll', filters),

  // Dashboard
  getDashboardStats: (userId, role) => ipcRenderer.invoke('dashboard:getStats', userId, role),

  // File Dialog
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile')
});
