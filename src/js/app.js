// =====================================================
// COCOBOD Workflow System - Main Application JavaScript
// =====================================================

// Global State
let currentUser = null;
let currentPage = 'dashboard';
let workflowStageCount = 0;

// =====================================================
// Initialization
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  // Check for stored session
  const storedUser = localStorage.getItem('cocobodUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    showMainApp();
  }

  // Initialize form handlers
  initializeFormHandlers();
});

function initializeFormHandlers() {
  // Login form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  
  // Upload form
  document.getElementById('uploadForm').addEventListener('submit', handleUpload);
  
  // Create task form
  document.getElementById('createTaskForm').addEventListener('submit', handleCreateTask);
  
  // Create workflow form
  document.getElementById('createWorkflowForm').addEventListener('submit', handleCreateWorkflow);
  
  // Create department form
  document.getElementById('createDepartmentForm').addEventListener('submit', handleCreateDepartment);
  
  // Create user form
  document.getElementById('createUserForm').addEventListener('submit', handleCreateUser);
  
  // Profile form
  document.getElementById('profileForm').addEventListener('submit', handleUpdateProfile);
  
  // Password form
  document.getElementById('passwordForm').addEventListener('submit', handleChangePassword);
  
  // Chat form
  document.getElementById('chatForm').addEventListener('submit', handleSendMessage);
  
  // File input handler
  document.getElementById('uploadFile').addEventListener('change', handleFileSelect);
}

// =====================================================
// Authentication
// =====================================================

async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  
  try {
    const result = await window.electronAPI.login({ username, password });
    
    if (result.success) {
      currentUser = result.user;
      localStorage.setItem('cocobodUser', JSON.stringify(currentUser));
      showMainApp();
    } else {
      errorDiv.textContent = result.message;
      errorDiv.classList.remove('hidden');
    }
  } catch (error) {
    errorDiv.textContent = 'An error occurred. Please try again.';
    errorDiv.classList.remove('hidden');
  }
}

async function logout() {
  if (currentUser) {
    await window.electronAPI.logout(currentUser.id);
  }
  currentUser = null;
  localStorage.removeItem('cocobodUser');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

function togglePassword() {
  const input = document.getElementById('loginPassword');
  const icon = document.getElementById('passwordToggleIcon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// =====================================================
// Main Application
// =====================================================

function showMainApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  // Update user info in sidebar
  document.getElementById('sidebarUserName').textContent = currentUser.full_name;
  document.getElementById('sidebarUserRole').textContent = formatRole(currentUser.role);
  
  // Show/hide admin-only navigation items
  const adminItems = document.querySelectorAll('.admin-only');
  adminItems.forEach(item => {
    if (currentUser.role === 'admin') {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
  
  // Show/hide approval navigation for heads
  const navApprovals = document.getElementById('navApprovals');
  if (currentUser.role === 'head' || currentUser.role === 'admin') {
    navApprovals.classList.remove('hidden');
  } else {
    navApprovals.classList.add('hidden');
  }
  
  // Load dashboard
  showPage('dashboard');
  loadNotifications();
}

function showPage(pageName) {
  currentPage = pageName;
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
  
  // Show selected page
  const page = document.getElementById(pageName + 'Page');
  if (page) {
    page.classList.remove('hidden');
  }
  
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === pageName) {
      link.classList.add('active');
    }
  });
  
  // Update page title
  const titles = {
    dashboard: { title: 'Dashboard', subtitle: 'Welcome back, ' + currentUser.full_name },
    documents: { title: 'Documents', subtitle: 'Manage your documents and files' },
    tasks: { title: 'Tasks', subtitle: 'Track and manage your tasks' },
    approvals: { title: 'Approvals', subtitle: 'Review and approve documents' },
    workflows: { title: 'Workflow Routes', subtitle: 'Configure document routing workflows' },
    departments: { title: 'Departments', subtitle: 'Manage organization departments' },
    users: { title: 'Users', subtitle: 'Manage system users' },
    activity: { title: 'Activity Logs', subtitle: 'View system activity history' },
    settings: { title: 'Settings', subtitle: 'Manage your profile and preferences' }
  };
  
  const pageInfo = titles[pageName] || { title: pageName, subtitle: '' };
  document.getElementById('pageTitle').textContent = pageInfo.title;
  document.getElementById('pageSubtitle').textContent = pageInfo.subtitle;
  
  // Load page data
  switch (pageName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'documents':
      loadDocuments();
      loadDepartmentsDropdown('uploadDepartment');
      loadWorkflowsDropdown('uploadWorkflow');
      break;
    case 'tasks':
      loadTasks();
      loadUsersDropdown('taskAssignee');
      loadDepartmentsDropdown('taskDepartment');
      loadDocumentsDropdown('taskDocument');
      break;
    case 'approvals':
      loadApprovals();
      break;
    case 'workflows':
      loadWorkflows();
      break;
    case 'departments':
      loadDepartments();
      loadUsersDropdown('departmentHead');
      break;
    case 'users':
      loadUsers();
      loadDepartmentsDropdown('newUserDepartment');
      break;
    case 'activity':
      loadActivityLogs();
      break;
    case 'settings':
      loadUserSettings();
      break;
  }
}

// =====================================================
// Dashboard
// =====================================================

async function loadDashboard() {
  try {
    const result = await window.electronAPI.getDashboardStats(currentUser.id, currentUser.role);
    
    if (result.success) {
      renderDashboardStats(result.stats);
    }
    
    // Load recent documents
    const docsResult = await window.electronAPI.getDocuments({ uploaded_by: currentUser.id });
    if (docsResult.success) {
      renderRecentDocuments(docsResult.documents.slice(0, 5));
    }
    
    // Load recent tasks
    const tasksResult = await window.electronAPI.getTasks({ assigned_to: currentUser.id });
    if (tasksResult.success) {
      renderRecentTasks(tasksResult.tasks.slice(0, 5));
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function renderDashboardStats(stats) {
  const container = document.getElementById('dashboardStats');
  let html = '';
  
  if (currentUser.role === 'admin') {
    html = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Total Users</p>
            <p class="text-2xl font-bold text-gray-800">${stats.users?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-users text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Departments</p>
            <p class="text-2xl font-bold text-gray-800">${stats.departments?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-building text-purple-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Documents</p>
            <p class="text-2xl font-bold text-gray-800">${stats.documents?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-file-alt text-green-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Pending Approvals</p>
            <p class="text-2xl font-bold text-gray-800">${stats.pendingApprovals?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-clock text-yellow-600 text-xl"></i>
          </div>
        </div>
      </div>
    `;
  } else if (currentUser.role === 'hr') {
    html = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Total Tasks</p>
            <p class="text-2xl font-bold text-gray-800">${stats.totalTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-tasks text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Pending Tasks</p>
            <p class="text-2xl font-bold text-gray-800">${stats.pendingTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-hourglass-half text-yellow-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Completed Tasks</p>
            <p class="text-2xl font-bold text-gray-800">${stats.completedTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-check-circle text-green-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Overdue Tasks</p>
            <p class="text-2xl font-bold text-gray-800">${stats.overdueTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-exclamation-triangle text-red-600 text-xl"></i>
          </div>
        </div>
      </div>
    `;
  } else if (currentUser.role === 'head') {
    html = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Pending Approvals</p>
            <p class="text-2xl font-bold text-gray-800">${stats.pendingApprovals?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-hourglass-half text-yellow-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Approved This Month</p>
            <p class="text-2xl font-bold text-gray-800">${stats.approvedThisMonth?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-check-circle text-green-600 text-xl"></i>
          </div>
        </div>
      </div>
    `;
  } else {
    // Staff
    html = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Assigned Tasks</p>
            <p class="text-2xl font-bold text-gray-800">${stats.assignedTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-tasks text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Pending</p>
            <p class="text-2xl font-bold text-gray-800">${stats.pendingTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-clock text-yellow-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">In Progress</p>
            <p class="text-2xl font-bold text-gray-800">${stats.inProgressTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-spinner text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Completed</p>
            <p class="text-2xl font-bold text-gray-800">${stats.completedTasks?.count || 0}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-check-circle text-green-600 text-xl"></i>
          </div>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function renderRecentDocuments(documents) {
  const container = document.getElementById('recentDocuments');
  
  if (!documents || documents.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No documents yet</p>';
    return;
  }
  
  const html = documents.map(doc => `
    <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <i class="fas fa-file-alt text-gray-500"></i>
        </div>
        <div>
          <p class="font-medium text-gray-800">${doc.title}</p>
          <p class="text-xs text-gray-500">${formatDate(doc.created_at)}</p>
        </div>
      </div>
      <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(doc.status)}">${formatStatus(doc.status)}</span>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recentTasks');
  
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No tasks yet</p>';
    return;
  }
  
  const html = tasks.map(task => `
    <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <i class="fas fa-tasks text-gray-500"></i>
        </div>
        <div>
          <p class="font-medium text-gray-800">${task.title}</p>
          <p class="text-xs text-gray-500">Due: ${task.deadline ? formatDate(task.deadline) : 'No deadline'}</p>
        </div>
      </div>
      <span class="px-2 py-1 text-xs rounded-full ${getTaskStatusClass(task.status)}">${formatStatus(task.status)}</span>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// =====================================================
// Documents
// =====================================================

async function loadDocuments() {
  try {
    const result = await window.electronAPI.getDocuments({});
    if (result.success) {
      renderDocumentsTable(result.documents);
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}

function renderDocumentsTable(documents) {
  const tbody = document.getElementById('documentsTableBody');
  
  if (!documents || documents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No documents found</td></tr>';
    return;
  }
  
  const html = documents.map(doc => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <i class="fas ${getFileIcon(doc.file_type)} text-gray-500"></i>
          </div>
          <div>
            <p class="font-medium text-gray-800">${doc.title}</p>
            <p class="text-xs text-gray-500">${doc.file_name || 'No file'}</p>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-gray-600">${doc.department_name || '-'}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(doc.status)}">${formatStatus(doc.status)}</span>
      </td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${getPriorityClass(doc.priority)}">${doc.priority}</span>
      </td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-green-500 rounded-full" style="width: ${doc.total_stages ? (doc.current_stage / doc.total_stages * 100) : 0}%"></div>
          </div>
          <span class="text-xs text-gray-500">${doc.current_stage}/${doc.total_stages || 0}</span>
        </div>
      </td>
      <td class="px-6 py-4 text-gray-600 text-sm">${formatDate(doc.created_at)}</td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <button onclick="viewDocument('${doc.id}')" class="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="View">
            <i class="fas fa-eye"></i>
          </button>
          <button onclick="openChat('document', '${doc.id}', '${doc.title}')" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chat">
            <i class="fas fa-comment"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  tbody.innerHTML = html;
}

async function filterDocuments() {
  const search = document.getElementById('documentSearch').value;
  const status = document.getElementById('documentStatusFilter').value;
  
  const filters = {};
  if (search) filters.search = search;
  if (status) filters.status = status;
  
  try {
    const result = await window.electronAPI.getDocuments(filters);
    if (result.success) {
      renderDocumentsTable(result.documents);
    }
  } catch (error) {
    console.error('Error filtering documents:', error);
  }
}

async function handleUpload(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('uploadFile');
  if (!fileInput.files[0]) {
    showToast('Please select a file', 'error');
    return;
  }
  
  const data = {
    title: document.getElementById('uploadTitle').value,
    description: document.getElementById('uploadDescription').value,
    file_name: fileInput.files[0].name,
    file_type: fileInput.files[0].type,
    file_size: fileInput.files[0].size,
    temp_path: fileInput.files[0].path,
    department_id: document.getElementById('uploadDepartment').value || null,
    workflow_route_id: document.getElementById('uploadWorkflow').value || null,
    priority: document.getElementById('uploadPriority').value,
    deadline: document.getElementById('uploadDeadline').value || null
  };
  
  try {
    const result = await window.electronAPI.uploadDocument(data, currentUser.id);
    if (result.success) {
      showToast('Document uploaded successfully');
      closeModal('uploadModal');
      loadDocuments();
      document.getElementById('uploadForm').reset();
      document.getElementById('uploadFileName').textContent = 'Click to select file';
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to upload document', 'error');
  }
}

function selectFile() {
  document.getElementById('uploadFile').click();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('uploadFileName').textContent = file.name;
  }
}

async function viewDocument(id) {
  try {
    const result = await window.electronAPI.getDocument(id);
    if (result.success) {
      renderDocumentDetail(result.document);
      openModal('documentDetailModal');
    }
  } catch (error) {
    showToast('Failed to load document details', 'error');
  }
}

function renderDocumentDetail(doc) {
  document.getElementById('documentDetailTitle').textContent = doc.title;
  
  const content = document.getElementById('documentDetailContent');
  content.innerHTML = `
    <div class="space-y-6">
      <!-- Document Info -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm text-gray-500">Status</label>
          <p><span class="px-2 py-1 text-xs rounded-full ${getStatusClass(doc.status)}">${formatStatus(doc.status)}</span></p>
        </div>
        <div>
          <label class="text-sm text-gray-500">Priority</label>
          <p><span class="px-2 py-1 text-xs rounded-full ${getPriorityClass(doc.priority)}">${doc.priority}</span></p>
        </div>
        <div>
          <label class="text-sm text-gray-500">Department</label>
          <p class="font-medium">${doc.department_name || '-'}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">Uploaded By</label>
          <p class="font-medium">${doc.uploader_name}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">Created</label>
          <p class="font-medium">${formatDate(doc.created_at)}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">Deadline</label>
          <p class="font-medium">${doc.deadline ? formatDate(doc.deadline) : 'No deadline'}</p>
        </div>
      </div>
      
      <div>
        <label class="text-sm text-gray-500">Description</label>
        <p class="font-medium">${doc.description || 'No description'}</p>
      </div>
      
      <!-- Workflow Progress -->
      ${doc.workflowStages ? `
        <div>
          <label class="text-sm text-gray-500 block mb-2">Workflow Progress</label>
          <div class="flex items-center gap-2">
            ${doc.workflowStages.map((stage, index) => `
              <div class="flex items-center">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < doc.current_stage ? 'bg-green-500 text-white' :
                  index === doc.current_stage ? 'bg-blue-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }">
                  ${index < doc.current_stage ? '<i class="fas fa-check"></i>' : index + 1}
                </div>
                ${index < doc.workflowStages.length - 1 ? '<div class="w-8 h-0.5 bg-gray-200"></div>' : ''}
              </div>
            `).join('')}
          </div>
          <div class="flex mt-2 text-xs text-gray-500">
            ${doc.workflowStages.map(stage => `<div class="w-16 text-center truncate">${stage.name}</div>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Approvals History -->
      ${doc.approvals && doc.approvals.length > 0 ? `
        <div>
          <label class="text-sm text-gray-500 block mb-2">Approval History</label>
          <div class="space-y-2">
            ${doc.approvals.map(approval => `
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center ${
                    approval.action === 'approved' ? 'bg-green-100 text-green-600' :
                    approval.action === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-600'
                  }">
                    <i class="fas ${approval.action === 'approved' ? 'fa-check' : approval.action === 'rejected' ? 'fa-times' : 'fa-redo'}"></i>
                  </div>
                  <div>
                    <p class="font-medium">${approval.approver_name}</p>
                    <p class="text-xs text-gray-500">${approval.stage_name} - ${formatDate(approval.created_at)}</p>
                  </div>
                </div>
                <span class="text-sm ${approval.action === 'approved' ? 'text-green-600' : approval.action === 'rejected' ? 'text-red-600' : 'text-yellow-600'}">
                  ${formatStatus(approval.action)}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- File Info -->
      ${doc.file_name ? `
        <div class="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <i class="fas ${getFileIcon(doc.file_type)} text-2xl text-gray-400"></i>
          </div>
          <div class="flex-1">
            <p class="font-medium">${doc.file_name}</p>
            <p class="text-sm text-gray-500">${formatFileSize(doc.file_size)}</p>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// =====================================================
// Tasks
// =====================================================

async function loadTasks() {
  try {
    const filters = {};
    if (currentUser.role === 'staff') {
      filters.assigned_to = currentUser.id;
    } else if (currentUser.role === 'hr') {
      filters.assigned_by = currentUser.id;
    }
    
    const result = await window.electronAPI.getTasks(filters);
    if (result.success) {
      renderTasks(result.tasks);
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('tasksContainer');
  
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No tasks found</div>';
    return;
  }
  
  const html = tasks.map(task => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 card-hover">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-800">${task.title}</h4>
          <p class="text-sm text-gray-500 mt-1">${task.description || 'No description'}</p>
        </div>
        <span class="px-2 py-1 text-xs rounded-full ${getPriorityClass(task.priority)}">${task.priority}</span>
      </div>
      
      <div class="flex items-center gap-4 text-sm text-gray-500 mb-3">
        ${task.assigned_to_name ? `
          <div class="flex items-center gap-1">
            <i class="fas fa-user"></i>
            <span>${task.assigned_to_name}</span>
          </div>
        ` : ''}
        ${task.deadline ? `
          <div class="flex items-center gap-1">
            <i class="fas fa-calendar"></i>
            <span>${formatDate(task.deadline)}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="flex items-center justify-between pt-3 border-t border-gray-100">
        <span class="px-2 py-1 text-xs rounded-full ${getTaskStatusClass(task.status)}">${formatStatus(task.status)}</span>
        <div class="flex items-center gap-1">
          ${task.status !== 'completed' && task.status !== 'rejected' ? `
            <button onclick="updateTaskStatus('${task.id}', 'completed')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Complete">
              <i class="fas fa-check"></i>
            </button>
          ` : ''}
          <button onclick="openChat('task', '${task.id}', '${task.title}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chat">
            <i class="fas fa-comment"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

async function filterTasks() {
  const search = document.getElementById('taskSearch').value;
  const status = document.getElementById('taskStatusFilter').value;
  
  const filters = {};
  if (search) filters.search = search;
  if (status) filters.status = status;
  
  if (currentUser.role === 'staff') {
    filters.assigned_to = currentUser.id;
  } else if (currentUser.role === 'hr') {
    filters.assigned_by = currentUser.id;
  }
  
  try {
    const result = await window.electronAPI.getTasks(filters);
    if (result.success) {
      renderTasks(result.tasks);
    }
  } catch (error) {
    console.error('Error filtering tasks:', error);
  }
}

async function handleCreateTask(e) {
  e.preventDefault();
  
  const data = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDescription').value,
    assigned_to: document.getElementById('taskAssignee').value,
    department_id: document.getElementById('taskDepartment').value || null,
    document_id: document.getElementById('taskDocument').value || null,
    priority: document.getElementById('taskPriority').value,
    deadline: document.getElementById('taskDeadline').value || null
  };
  
  try {
    const result = await window.electronAPI.createTask(data, currentUser.id);
    if (result.success) {
      showToast('Task created successfully');
      closeModal('createTaskModal');
      loadTasks();
      document.getElementById('createTaskForm').reset();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to create task', 'error');
  }
}

async function updateTaskStatus(id, status) {
  try {
    const result = await window.electronAPI.updateTaskStatus(id, status, currentUser.id);
    if (result.success) {
      showToast('Task status updated');
      loadTasks();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to update task status', 'error');
  }
}

// =====================================================
// Approvals
// =====================================================

async function loadApprovals() {
  try {
    // Get documents that need approval
    const result = await window.electronAPI.getDocuments({ status: 'in_review' });
    if (result.success) {
      renderApprovals(result.documents);
    }
  } catch (error) {
    console.error('Error loading approvals:', error);
  }
}

function renderApprovals(documents) {
  const container = document.getElementById('approvalsContainer');
  
  if (!documents || documents.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-500">No documents awaiting approval</div>';
    return;
  }
  
  const html = documents.map(doc => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h4 class="font-semibold text-gray-800 text-lg">${doc.title}</h4>
          <p class="text-sm text-gray-500 mt-1">${doc.description || 'No description'}</p>
        </div>
        <span class="px-3 py-1 text-sm rounded-full ${getPriorityClass(doc.priority)}">${doc.priority}</span>
      </div>
      
      <div class="grid grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <span class="text-gray-500">Department:</span>
          <p class="font-medium">${doc.department_name || '-'}</p>
        </div>
        <div>
          <span class="text-gray-500">Uploaded By:</span>
          <p class="font-medium">${doc.uploader_name}</p>
        </div>
        <div>
          <span class="text-gray-500">Submitted:</span>
          <p class="font-medium">${formatDate(doc.created_at)}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button onclick="openApprovalModal('${doc.id}')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <i class="fas fa-check mr-2"></i>Review
        </button>
        <button onclick="viewDocument('${doc.id}')" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <i class="fas fa-eye mr-2"></i>View Details
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

async function openApprovalModal(docId) {
  try {
    const result = await window.electronAPI.getDocument(docId);
    if (result.success) {
      const doc = result.document;
      const currentStage = doc.workflowStages?.[doc.current_stage];
      
      document.getElementById('approvalContent').innerHTML = `
        <div class="space-y-4">
          <div class="p-4 bg-gray-50 rounded-lg">
            <h4 class="font-medium mb-2">${doc.title}</h4>
            <p class="text-sm text-gray-600">Current Stage: ${currentStage?.name || 'N/A'}</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea id="approvalComments" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Add your comments..."></textarea>
          </div>
          
          <div class="flex gap-3">
            <button onclick="submitApproval('${doc.id}', '${currentStage?.id}', 'approved')" class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <i class="fas fa-check mr-2"></i>Approve
            </button>
            <button onclick="submitApproval('${doc.id}', '${currentStage?.id}', 'rejected')" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              <i class="fas fa-times mr-2"></i>Reject
            </button>
            <button onclick="submitApproval('${doc.id}', '${currentStage?.id}', 'revision_requested')" class="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
              <i class="fas fa-redo mr-2"></i>Revision
            </button>
          </div>
        </div>
      `;
      
      openModal('approvalModal');
    }
  } catch (error) {
    showToast('Failed to load approval details', 'error');
  }
}

async function submitApproval(docId, stageId, action) {
  const comments = document.getElementById('approvalComments').value;
  
  try {
    const result = await window.electronAPI.approveDocument(docId, stageId, action, comments, currentUser.id);
    if (result.success) {
      showToast(`Document ${action} successfully`);
      closeModal('approvalModal');
      loadApprovals();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to submit approval', 'error');
  }
}

// =====================================================
// Workflows
// =====================================================

async function loadWorkflows() {
  try {
    const result = await window.electronAPI.getWorkflows();
    if (result.success) {
      renderWorkflows(result.routes);
    }
  } catch (error) {
    console.error('Error loading workflows:', error);
  }
}

function renderWorkflows(workflows) {
  const container = document.getElementById('workflowsContainer');
  
  if (!workflows || workflows.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No workflow routes found</div>';
    return;
  }
  
  const html = workflows.map(wf => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h4 class="font-semibold text-gray-800">${wf.name}</h4>
          <p class="text-sm text-gray-500 mt-1">${wf.description || 'No description'}</p>
        </div>
        <span class="px-2 py-1 text-xs rounded-full ${wf.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
          ${wf.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      
      <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <i class="fas fa-project-diagram"></i>
        <span>${wf.stage_count} stages</span>
        <span class="mx-2">•</span>
        <span>Created ${formatDate(wf.created_at)}</span>
      </div>
      
      <div class="flex gap-2">
        <button onclick="viewWorkflow('${wf.id}')" class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <i class="fas fa-eye mr-1"></i>View
        </button>
        <button onclick="deleteWorkflow('${wf.id}')" class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
          <i class="fas fa-trash mr-1"></i>Delete
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

async function viewWorkflow(id) {
  try {
    const result = await window.electronAPI.getWorkflow(id);
    if (result.success) {
      const wf = result.route;
      showToast(`Workflow: ${wf.name} - ${wf.stages?.length || 0} stages`);
    }
  } catch (error) {
    showToast('Failed to load workflow details', 'error');
  }
}

async function handleCreateWorkflow(e) {
  e.preventDefault();
  
  const stages = [];
  document.querySelectorAll('.workflow-stage').forEach((el, index) => {
    stages.push({
      order: index + 1,
      name: el.querySelector('.stage-name').value,
      description: el.querySelector('.stage-description').value,
      department_id: el.querySelector('.stage-department').value || null,
      approver_role: el.querySelector('.stage-role').value || null
    });
  });
  
  const data = {
    name: document.getElementById('workflowName').value,
    description: document.getElementById('workflowDescription').value,
    stages: stages
  };
  
  try {
    const result = await window.electronAPI.createWorkflow(data, currentUser.id);
    if (result.success) {
      showToast('Workflow created successfully');
      closeModal('createWorkflowModal');
      loadWorkflows();
      document.getElementById('createWorkflowForm').reset();
      document.getElementById('workflowStagesContainer').innerHTML = '';
      workflowStageCount = 0;
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to create workflow', 'error');
  }
}

async function deleteWorkflow(id) {
  if (!confirm('Are you sure you want to delete this workflow?')) return;
  
  try {
    const result = await window.electronAPI.deleteWorkflow(id, currentUser.id);
    if (result.success) {
      showToast('Workflow deleted successfully');
      loadWorkflows();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to delete workflow', 'error');
  }
}

function addWorkflowStage() {
  workflowStageCount++;
  const container = document.getElementById('workflowStagesContainer');
  
  const stageHtml = `
    <div class="workflow-stage p-4 bg-gray-50 rounded-lg">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-gray-700">Stage ${workflowStageCount}</span>
        <button type="button" onclick="this.closest('.workflow-stage').remove()" class="text-red-500 hover:text-red-700">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Stage Name *" class="stage-name px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" required>
        <select class="stage-role px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white">
          <option value="">Approver Role</option>
          <option value="staff">Staff</option>
          <option value="hr">HR/Dept Admin</option>
          <option value="head">Head of Dept</option>
          <option value="admin">Administrator</option>
        </select>
        <input type="text" placeholder="Description" class="stage-description px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 col-span-2">
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', stageHtml);
}

// =====================================================
// Departments
// =====================================================

async function loadDepartments() {
  try {
    const result = await window.electronAPI.getDepartments();
    if (result.success) {
      renderDepartments(result.departments);
    }
  } catch (error) {
    console.error('Error loading departments:', error);
  }
}

function renderDepartments(departments) {
  const container = document.getElementById('departmentsContainer');
  
  if (!departments || departments.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No departments found</div>';
    return;
  }
  
  const html = departments.map(dept => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 card-hover">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
          <i class="fas fa-building text-green-600 text-xl"></i>
        </div>
        <div>
          <h4 class="font-semibold text-gray-800">${dept.name}</h4>
          <p class="text-sm text-gray-500">${dept.staff_count} staff members</p>
        </div>
      </div>
      
      <p class="text-sm text-gray-600 mb-4">${dept.description || 'No description'}</p>
      
      ${dept.head_name ? `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <i class="fas fa-user-tie"></i>
          <span>Head: ${dept.head_name}</span>
        </div>
      ` : ''}
      
      <div class="flex gap-2">
        <button onclick="editDepartment('${dept.id}')" class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <i class="fas fa-edit mr-1"></i>Edit
        </button>
        <button onclick="deleteDepartment('${dept.id}')" class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
          <i class="fas fa-trash mr-1"></i>Delete
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

async function handleCreateDepartment(e) {
  e.preventDefault();
  
  const data = {
    name: document.getElementById('departmentName').value,
    description: document.getElementById('departmentDescription').value,
    head_id: document.getElementById('departmentHead').value || null
  };
  
  try {
    const result = await window.electronAPI.createDepartment(data, currentUser.id);
    if (result.success) {
      showToast('Department created successfully');
      closeModal('createDepartmentModal');
      loadDepartments();
      document.getElementById('createDepartmentForm').reset();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to create department', 'error');
  }
}

async function deleteDepartment(id) {
  if (!confirm('Are you sure you want to delete this department?')) return;
  
  try {
    const result = await window.electronAPI.deleteDepartment(id, currentUser.id);
    if (result.success) {
      showToast('Department deleted successfully');
      loadDepartments();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to delete department', 'error');
  }
}

// =====================================================
// Users
// =====================================================

async function loadUsers() {
  try {
    const result = await window.electronAPI.getUsers();
    if (result.success) {
      renderUsersTable(result.users);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No users found</td></tr>';
    return;
  }
  
  const html = users.map(user => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <i class="fas fa-user text-green-600"></i>
          </div>
          <span class="font-medium text-gray-800">${user.full_name}</span>
        </div>
      </td>
      <td class="px-6 py-4 text-gray-600">${user.username}</td>
      <td class="px-6 py-4 text-gray-600">${user.email || '-'}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${getRoleClass(user.role)}">${formatRole(user.role)}</span>
      </td>
      <td class="px-6 py-4 text-gray-600">${user.department_name || '-'}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
          ${user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <button onclick="toggleUserStatus('${user.id}', ${user.is_active})" class="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="${user.is_active ? 'Deactivate' : 'Activate'}">
            <i class="fas ${user.is_active ? 'fa-user-minus' : 'fa-user-plus'}"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  tbody.innerHTML = html;
}

async function handleCreateUser(e) {
  e.preventDefault();
  
  const data = {
    username: document.getElementById('newUsername').value,
    password: document.getElementById('newUserPassword').value,
    full_name: document.getElementById('newUserFullName').value,
    email: document.getElementById('newUserEmail').value,
    role: document.getElementById('newUserRole').value,
    department_id: document.getElementById('newUserDepartment').value || null,
    createdBy: currentUser.id
  };
  
  try {
    const result = await window.electronAPI.createUser(data);
    if (result.success) {
      showToast('User created successfully');
      closeModal('createUserModal');
      loadUsers();
      document.getElementById('createUserForm').reset();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to create user', 'error');
  }
}

async function toggleUserStatus(id, currentStatus) {
  const action = currentStatus ? 'deactivate' : 'activate';
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;
  
  try {
    const result = await window.electronAPI.updateUser(id, { is_active: currentStatus ? 0 : 1 }, currentUser.id);
    if (result.success) {
      showToast(`User ${action}d successfully`);
      loadUsers();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast(`Failed to ${action} user`, 'error');
  }
}

// =====================================================
// Activity Logs
// =====================================================

async function loadActivityLogs() {
  const filter = document.getElementById('activityFilter').value;
  const filters = {};
  if (filter) filters.action = filter;
  
  try {
    const result = await window.electronAPI.getActivityLogs(filters);
    if (result.success) {
      renderActivityLogs(result.logs);
    }
  } catch (error) {
    console.error('Error loading activity logs:', error);
  }
}

function renderActivityLogs(logs) {
  const tbody = document.getElementById('activityTableBody');
  
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No activity logs found</td></tr>';
    return;
  }
  
  const html = logs.map(log => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-6 py-4 text-gray-800">${log.user_name || 'System'}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${getActionClass(log.action)}">${formatStatus(log.action)}</span>
      </td>
      <td class="px-6 py-4 text-gray-600">${log.entity_type || '-'}</td>
      <td class="px-6 py-4 text-gray-600">${log.details || '-'}</td>
      <td class="px-6 py-4 text-gray-500 text-sm">${formatDate(log.created_at)}</td>
    </tr>
  `).join('');
  
  tbody.innerHTML = html;
}

// =====================================================
// Settings
// =====================================================

function loadUserSettings() {
  document.getElementById('settingsFullName').value = currentUser.full_name || '';
  document.getElementById('settingsEmail').value = currentUser.email || '';
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  
  const data = {
    full_name: document.getElementById('settingsFullName').value,
    email: document.getElementById('settingsEmail').value
  };
  
  try {
    const result = await window.electronAPI.updateUser(currentUser.id, data, currentUser.id);
    if (result.success) {
      currentUser.full_name = data.full_name;
      currentUser.email = data.email;
      localStorage.setItem('cocobodUser', JSON.stringify(currentUser));
      document.getElementById('sidebarUserName').textContent = currentUser.full_name;
      showToast('Profile updated successfully');
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to update profile', 'error');
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    const result = await window.electronAPI.updateUser(currentUser.id, { password: newPassword }, currentUser.id);
    if (result.success) {
      showToast('Password changed successfully');
      document.getElementById('passwordForm').reset();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Failed to change password', 'error');
  }
}

// =====================================================
// Chat
// =====================================================

let currentChatEntity = null;

async function openChat(type, id, title) {
  currentChatEntity = { type, id };
  document.getElementById('chatTitle').textContent = `Chat - ${title}`;
  
  try {
    let result;
    if (type === 'task') {
      result = await window.electronAPI.getTaskMessages(id);
    } else {
      result = await window.electronAPI.getDocumentMessages(id);
    }
    
    if (result.success) {
      renderChatMessages(result.messages);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
  
  openModal('chatModal');
}

function renderChatMessages(messages) {
  const container = document.getElementById('chatMessages');
  
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-8">No messages yet</div>';
    return;
  }
  
  const html = messages.map(msg => `
    <div class="flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}">
      <div class="max-w-[70%] ${msg.sender_id === currentUser.id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'} rounded-lg px-4 py-2">
        <p class="text-sm font-medium mb-1">${msg.sender_name}</p>
        <p>${msg.message}</p>
        <p class="text-xs ${msg.sender_id === currentUser.id ? 'text-green-100' : 'text-gray-500'} mt-1">${formatTime(msg.created_at)}</p>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

async function handleSendMessage(e) {
  e.preventDefault();
  
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  const data = {
    message: message
  };
  
  if (currentChatEntity.type === 'task') {
    data.task_id = currentChatEntity.id;
  } else {
    data.document_id = currentChatEntity.id;
  }
  
  try {
    const result = await window.electronAPI.sendMessage(data, currentUser.id);
    if (result.success) {
      input.value = '';
      // Reload messages
      openChat(currentChatEntity.type, currentChatEntity.id, document.getElementById('chatTitle').textContent.replace('Chat - ', ''));
    }
  } catch (error) {
    showToast('Failed to send message', 'error');
  }
}

// =====================================================
// Notifications
// =====================================================

async function loadNotifications() {
  try {
    const result = await window.electronAPI.getNotifications(currentUser.id);
    if (result.success) {
      renderNotifications(result.notifications);
      updateNotificationBadge(result.notifications);
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

function renderNotifications(notifications) {
  const container = document.getElementById('notificationList');
  
  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-gray-500">No notifications</div>';
    return;
  }
  
  const html = notifications.slice(0, 10).map(notif => `
    <div class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${notif.is_read ? 'opacity-60' : ''}" onclick="markNotificationRead('${notif.id}')">
      <p class="font-medium text-gray-800">${notif.title}</p>
      <p class="text-sm text-gray-600 mt-1">${notif.message}</p>
      <p class="text-xs text-gray-400 mt-2">${formatDate(notif.created_at)}</p>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

function updateNotificationBadge(notifications) {
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const badge = document.getElementById('notificationBadge');
  
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleNotifications() {
  const dropdown = document.getElementById('notificationDropdown');
  dropdown.classList.toggle('hidden');
}

async function markNotificationRead(id) {
  try {
    await window.electronAPI.markNotificationAsRead(id);
    loadNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsRead() {
  try {
    await window.electronAPI.markAllNotificationsAsRead(currentUser.id);
    loadNotifications();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

// =====================================================
// Dropdown Loaders
// =====================================================

async function loadDepartmentsDropdown(elementId) {
  try {
    const result = await window.electronAPI.getDepartments();
    if (result.success) {
      const select = document.getElementById(elementId);
      const currentValue = select.value;
      
      select.innerHTML = '<option value="">Select Department</option>';
      result.departments.forEach(dept => {
        select.innerHTML += `<option value="${dept.id}">${dept.name}</option>`;
      });
      
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading departments dropdown:', error);
  }
}

async function loadUsersDropdown(elementId) {
  try {
    const result = await window.electronAPI.getUsers();
    if (result.success) {
      const select = document.getElementById(elementId);
      const currentValue = select.value;
      
      select.innerHTML = '<option value="">Select User</option>';
      result.users.filter(u => u.is_active).forEach(user => {
        select.innerHTML += `<option value="${user.id}">${user.full_name} (${formatRole(user.role)})</option>`;
      });
      
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading users dropdown:', error);
  }
}

async function loadWorkflowsDropdown(elementId) {
  try {
    const result = await window.electronAPI.getWorkflows();
    if (result.success) {
      const select = document.getElementById(elementId);
      const currentValue = select.value;
      
      select.innerHTML = '<option value="">Select Workflow</option>';
      result.routes.filter(w => w.is_active).forEach(wf => {
        select.innerHTML += `<option value="${wf.id}">${wf.name}</option>`;
      });
      
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading workflows dropdown:', error);
  }
}

async function loadDocumentsDropdown(elementId) {
  try {
    const result = await window.electronAPI.getDocuments({});
    if (result.success) {
      const select = document.getElementById(elementId);
      const currentValue = select.value;
      
      select.innerHTML = '<option value="">Select Document (Optional)</option>';
      result.documents.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.title}</option>`;
      });
      
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading documents dropdown:', error);
  }
}

// =====================================================
// Utility Functions
// =====================================================

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function openUploadModal() {
  document.getElementById('uploadForm').reset();
  document.getElementById('uploadFileName').textContent = 'Click to select file';
  openModal('uploadModal');
}

function openCreateTaskModal() {
  document.getElementById('createTaskForm').reset();
  openModal('createTaskModal');
}

function openCreateWorkflowModal() {
  document.getElementById('createWorkflowForm').reset();
  document.getElementById('workflowStagesContainer').innerHTML = '';
  workflowStageCount = 0;
  addWorkflowStage(); // Add first stage by default
  openModal('createWorkflowModal');
}

function openCreateDepartmentModal() {
  document.getElementById('createDepartmentForm').reset();
  openModal('createDepartmentModal');
}

function openCreateUserModal() {
  document.getElementById('createUserForm').reset();
  openModal('createUserModal');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const msg = document.getElementById('toastMessage');
  
  msg.textContent = message;
  
  if (type === 'success') {
    icon.className = 'fas fa-check-circle text-green-400';
  } else if (type === 'error') {
    icon.className = 'fas fa-exclamation-circle text-red-400';
  } else {
    icon.className = 'fas fa-info-circle text-blue-400';
  }
  
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(status) {
  if (!status) return '-';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatRole(role) {
  const roles = {
    admin: 'Administrator',
    hr: 'HR/Dept Admin',
    staff: 'Staff',
    head: 'Head of Dept'
  };
  return roles[role] || role;
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function getFileIcon(fileType) {
  if (!fileType) return 'fa-file';
  if (fileType.includes('pdf')) return 'fa-file-pdf';
  if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fa-file-excel';
  if (fileType.includes('image')) return 'fa-file-image';
  return 'fa-file';
}

function getStatusClass(status) {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_review: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function getTaskStatusClass(status) {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function getPriorityClass(priority) {
  const classes = {
    low: 'bg-gray-100 text-gray-800',
    normal: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return classes[priority] || 'bg-gray-100 text-gray-800';
}

function getRoleClass(role) {
  const classes = {
    admin: 'bg-purple-100 text-purple-800',
    hr: 'bg-blue-100 text-blue-800',
    head: 'bg-green-100 text-green-800',
    staff: 'bg-gray-100 text-gray-800'
  };
  return classes[role] || 'bg-gray-100 text-gray-800';
}

function getActionClass(action) {
  const classes = {
    login: 'bg-blue-100 text-blue-800',
    logout: 'bg-gray-100 text-gray-800',
    create: 'bg-green-100 text-green-800',
    update: 'bg-yellow-100 text-yellow-800',
    delete: 'bg-red-100 text-red-800',
    upload: 'bg-indigo-100 text-indigo-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800'
  };
  return classes[action] || 'bg-gray-100 text-gray-800';
}
