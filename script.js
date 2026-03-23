const API = 'http://localhost:3000';
let currentUser = null;

function getAuthHeader() {
  const token = sessionStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: getAuthHeader(),
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const routes = {
  '#/': 'home-page',
  '#/register': 'register-page',
  '#/verify-email': 'verify-email-page',
  '#/login': 'login-page',
  '#/profile': 'profile-page',
  '#/employees': 'employees-page',
  '#/departments': 'departments-page',
  '#/accounts': 'accounts-page',
  '#/requests': 'requests-page'
};

const protectedRoutes = ['#/profile', '#/requests'];
const adminRoutes = ['#/employees', '#/departments', '#/accounts'];

function navigateTo(hash) {
  window.location.hash = hash;
}

function handleRouting() {
  const hash = window.location.hash || '#/';

  if (protectedRoutes.includes(hash) && !currentUser) {
    navigateTo('#/login');
    return;
  }
  if (adminRoutes.includes(hash) && (!currentUser || currentUser.role !== 'admin')) {
    alert('Access denied. Admins only.');
    navigateTo('#/');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageId = routes[hash];
  if (pageId && document.getElementById(pageId)) {
    document.getElementById(pageId).classList.add('active');
  } else {
    document.getElementById('home-page').classList.add('active');
  }

  if (hash === '#/verify-email') {
    const email = sessionStorage.getItem('unverified_email') || '';
    document.getElementById('verify-email-display').textContent = email;
  }
  if (hash === '#/login') {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    const errorDiv = document.getElementById('login-error');
    errorDiv.classList.add('d-none');
    errorDiv.textContent = '';
  }
  if (hash === '#/register') {
    ['reg-fname','reg-lname','reg-email','reg-password'].forEach(id => document.getElementById(id).value = '');
    const errorDiv = document.getElementById('reg-error');
    errorDiv.classList.add('d-none');
    errorDiv.textContent = '';
  }

  if (hash === '#/profile') renderProfile();
  if (hash === '#/accounts') renderAccountsList();
  if (hash === '#/departments') renderDepartmentsTable();
  if (hash === '#/employees') renderEmployeesTable();
  if (hash === '#/requests') renderRequestsTable();
}

function setAuthState(isAuth, user) {
  currentUser = user || null;
  document.body.classList.remove('authenticated', 'not-authenticated', 'is-admin');
  if (isAuth && user) {
    document.body.classList.add('authenticated');
    if (user.role === 'admin') document.body.classList.add('is-admin');
    document.getElementById('navUsername').textContent = user.firstName + ' ' + user.lastName;
  } else {
    document.body.classList.add('not-authenticated');
  }
}

async function checkExistingSession() {
  const token = sessionStorage.getItem('authToken');
  if (!token) return;
  try {
    const data = await apiFetch('/api/profile');
    setAuthState(true, data.user);
  } catch {
    sessionStorage.removeItem('authToken');
    setAuthState(false);
  }
}

async function handleRegister() {
  const firstName = document.getElementById('reg-fname').value.trim();
  const lastName  = document.getElementById('reg-lname').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const password  = document.getElementById('reg-password').value;
  const errorDiv  = document.getElementById('reg-error');
  errorDiv.classList.add('d-none');
  errorDiv.textContent = '';

  if (!firstName || !lastName || !email || !password) {
    errorDiv.textContent = 'All fields are required.';
    errorDiv.classList.remove('d-none');
    return;
  }
  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters.';
    errorDiv.classList.remove('d-none');
    return;
  }

  try {
    await apiFetch('/api/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, password })
    });
    sessionStorage.setItem('unverified_email', email);
    navigateTo('#/verify-email');
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
}

async function simulateVerification() {
  const email = sessionStorage.getItem('unverified_email');
  if (!email) { alert('No email to verify.'); return; }

  try {
    await apiFetch('/api/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    sessionStorage.removeItem('unverified_email');
    alert('Email verified! You can now log in.');
    navigateTo('#/login');
  } catch (err) {
    alert('Verification failed: ' + err.message);
  }
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('d-none');
  errorDiv.textContent = '';

  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    sessionStorage.setItem('authToken', data.token);
    setAuthState(true, data.user);
    navigateTo('#/profile');
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
}

function logout() {
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('unverified_email');
  setAuthState(false);
  navigateTo('#/login');
}

function renderProfile() {
  if (!currentUser) return;
  document.getElementById('profile-content').innerHTML =
    '<p><strong>Name:</strong> ' + currentUser.firstName + ' ' + currentUser.lastName + '</p>' +
    '<p><strong>Email:</strong> ' + currentUser.email + '</p>' +
    '<p><strong>Role:</strong> <span class="badge bg-' + (currentUser.role === 'admin' ? 'danger' : 'primary') + '">' + currentUser.role + '</span></p>' +
    '<button class="btn btn-sm btn-primary mt-3" onclick="alert(\'Edit Profile — coming soon!\')">Edit Profile</button>';
}

async function renderAccountsList() {
  const tbody = document.getElementById('accounts-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';
  try {
    const accounts = await apiFetch('/api/accounts');
    tbody.innerHTML = '';
    accounts.forEach(acc => {
      const row = document.createElement('tr');
      row.innerHTML =
        '<td>' + acc.firstName + ' ' + acc.lastName + '</td>' +
        '<td>' + acc.email + '</td>' +
        '<td><span class="badge bg-' + (acc.role === 'admin' ? 'danger' : 'secondary') + '">' + acc.role + '</span></td>' +
        '<td>' + (acc.verified ? '✅' : '❌') + '</td>' +
        '<td>' +
          '<button class="btn btn-sm btn-warning me-1" onclick="openAccountForm(' + acc.id + ')">Edit</button>' +
          '<button class="btn btn-sm btn-info me-1 text-white" onclick="resetPassword(' + acc.id + ')">Reset PW</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteAccount(' + acc.id + ')">Delete</button>' +
        '</td>';
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">' + err.message + '</td></tr>';
  }
}

function openAccountForm(id) {
  const container = document.getElementById('account-form-container');
  container.classList.remove('d-none');
  if (id) {
    apiFetch('/api/accounts').then(accounts => {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;
      document.getElementById('account-form-title').textContent = 'Edit Account';
      document.getElementById('acc-id').value = acc.id;
      document.getElementById('acc-fname').value = acc.firstName;
      document.getElementById('acc-lname').value = acc.lastName;
      document.getElementById('acc-email').value = acc.email;
      document.getElementById('acc-password').value = '';
      document.getElementById('acc-role').value = acc.role;
      document.getElementById('acc-verified').checked = acc.verified;
    });
  } else {
    document.getElementById('account-form-title').textContent = 'Add Account';
    document.getElementById('acc-id').value = '';
    document.getElementById('acc-fname').value = '';
    document.getElementById('acc-lname').value = '';
    document.getElementById('acc-email').value = '';
    document.getElementById('acc-password').value = '';
    document.getElementById('acc-role').value = 'user';
    document.getElementById('acc-verified').checked = false;
  }
}

function closeAccountForm() {
  document.getElementById('account-form-container').classList.add('d-none');
}

async function saveAccount() {
  const id        = document.getElementById('acc-id').value;
  const firstName = document.getElementById('acc-fname').value.trim();
  const lastName  = document.getElementById('acc-lname').value.trim();
  const email     = document.getElementById('acc-email').value.trim();
  const password  = document.getElementById('acc-password').value;
  const role      = document.getElementById('acc-role').value;
  const verified  = document.getElementById('acc-verified').checked;

  if (!firstName || !lastName || !email) { alert('All fields are required.'); return; }
  if (!id && !password) { alert('Password is required for new accounts.'); return; }

  try {
    const body = { firstName, lastName, email, role, verified };
    if (password) body.password = password;

    if (id) {
      await apiFetch('/api/accounts/' + id, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/accounts', { method: 'POST', body: JSON.stringify(body) });
    }
    closeAccountForm();
    renderAccountsList();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function resetPassword(id) {
  const newPw = prompt('Enter new password (min 6 characters):');
  if (!newPw) return;
  if (newPw.length < 6) { alert('Password must be at least 6 characters!'); return; }
  try {
    await apiFetch('/api/accounts/' + id + '/reset-password', {
      method: 'PUT',
      body: JSON.stringify({ newPassword: newPw })
    });
    alert('Password reset successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteAccount(id) {
  if (currentUser && currentUser.id === id) { alert('You cannot delete your own account!'); return; }
  if (!confirm('Are you sure you want to delete this account?')) return;
  try {
    await apiFetch('/api/accounts/' + id, { method: 'DELETE' });
    renderAccountsList();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function renderDepartmentsTable() {
  const tbody = document.getElementById('departments-tbody');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Loading...</td></tr>';
  try {
    const departments = await apiFetch('/api/departments');
    tbody.innerHTML = '';
    if (departments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No departments yet.</td></tr>';
      return;
    }
    departments.forEach(dept => {
      const row = document.createElement('tr');
      row.innerHTML =
        '<td>' + dept.name + '</td>' +
        '<td>' + dept.description + '</td>' +
        '<td>' +
          '<button class="btn btn-sm btn-warning me-1" onclick="openDeptForm(' + dept.id + ')">Edit</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteDept(' + dept.id + ')">Delete</button>' +
        '</td>';
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">' + err.message + '</td></tr>';
  }
}

function openDeptForm(id) {
  const container = document.getElementById('dept-form-container');
  container.classList.remove('d-none');
  if (id) {
    apiFetch('/api/departments').then(departments => {
      const dept = departments.find(d => d.id === id);
      if (!dept) return;
      document.getElementById('dept-form-title').textContent = 'Edit Department';
      document.getElementById('dept-record-id').value = dept.id;
      document.getElementById('dept-name').value = dept.name;
      document.getElementById('dept-desc').value = dept.description;
    });
  } else {
    document.getElementById('dept-form-title').textContent = 'Add Department';
    document.getElementById('dept-record-id').value = '';
    document.getElementById('dept-name').value = '';
    document.getElementById('dept-desc').value = '';
  }
}

function closeDeptForm() {
  document.getElementById('dept-form-container').classList.add('d-none');
}

async function saveDept() {
  const id   = document.getElementById('dept-record-id').value;
  const name = document.getElementById('dept-name').value.trim();
  const desc = document.getElementById('dept-desc').value.trim();
  if (!name || !desc) { alert('Name and description are required.'); return; }
  try {
    if (id) {
      await apiFetch('/api/departments/' + id, { method: 'PUT', body: JSON.stringify({ name, description: desc }) });
    } else {
      await apiFetch('/api/departments', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
    }
    closeDeptForm();
    renderDepartmentsTable();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteDept(id) {
  if (!confirm('Delete this department?')) return;
  try {
    await apiFetch('/api/departments/' + id, { method: 'DELETE' });
    renderDepartmentsTable();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function renderEmployeesTable() {
  const tbody = document.getElementById('employees-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';
  try {
    const [employees, departments] = await Promise.all([
      apiFetch('/api/employees'),
      apiFetch('/api/departments')
    ]);
    tbody.innerHTML = '';
    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No employees yet.</td></tr>';
      return;
    }
    employees.forEach(emp => {
      const dept = departments.find(d => d.id === emp.deptId);
      const row = document.createElement('tr');
      row.innerHTML =
        '<td>' + emp.employeeId + '</td>' +
        '<td>' + emp.userEmail + '</td>' +
        '<td>' + emp.position + '</td>' +
        '<td>' + (dept ? dept.name : 'Unknown') + '</td>' +
        '<td>' + emp.hireDate + '</td>' +
        '<td><button class="btn btn-sm btn-danger" onclick="deleteEmployee(' + emp.id + ')">Delete</button></td>';
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-danger text-center">' + err.message + '</td></tr>';
  }
}

async function openEmployeeForm() {
  const container = document.getElementById('employee-form-container');
  container.classList.remove('d-none');
  document.getElementById('emp-id').value = '';
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-position').value = '';
  document.getElementById('emp-date').value = '';

  const deptSelect = document.getElementById('emp-dept');
  deptSelect.innerHTML = '<option>Loading...</option>';
  try {
    const departments = await apiFetch('/api/departments');
    deptSelect.innerHTML = '';
    departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      deptSelect.appendChild(option);
    });
  } catch {
    deptSelect.innerHTML = '<option>Failed to load departments</option>';
  }
}

function closeEmployeeForm() {
  document.getElementById('employee-form-container').classList.add('d-none');
}

async function saveEmployee() {
  const employeeId = document.getElementById('emp-id').value.trim();
  const userEmail  = document.getElementById('emp-email').value.trim();
  const position   = document.getElementById('emp-position').value.trim();
  const deptId     = document.getElementById('emp-dept').value;
  const hireDate   = document.getElementById('emp-date').value;

  if (!employeeId || !userEmail || !position || !hireDate) { alert('All fields are required.'); return; }

  try {
    await apiFetch('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ employeeId, userEmail, position, deptId, hireDate })
    });
    closeEmployeeForm();
    renderEmployeesTable();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteEmployee(id) {
  if (!confirm('Delete this employee record?')) return;
  try {
    await apiFetch('/api/employees/' + id, { method: 'DELETE' });
    renderEmployeesTable();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

let requestModalInstance = null;

function openRequestModal() {
  document.getElementById('req-items-container').innerHTML = '';
  addRequestItem();
  if (!requestModalInstance) {
    requestModalInstance = new bootstrap.Modal(document.getElementById('requestModal'));
  }
  requestModalInstance.show();
}

function addRequestItem() {
  const container = document.getElementById('req-items-container');
  const row = document.createElement('div');
  row.className = 'd-flex gap-2 mb-2';
  row.innerHTML =
    '<input type="text" class="form-control req-item-name" placeholder="Item name">' +
    '<input type="number" class="form-control req-item-qty" value="1" min="1" style="width:80px">' +
    '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>';
  container.appendChild(row);
}

async function submitRequest() {
  const type = document.getElementById('req-type').value;
  const nameInputs = document.querySelectorAll('.req-item-name');
  const qtyInputs  = document.querySelectorAll('.req-item-qty');
  const items = [];
  nameInputs.forEach((input, i) => {
    const name = input.value.trim();
    if (name) items.push({ name, qty: qtyInputs[i].value });
  });
  if (items.length === 0) { alert('Please add at least one item.'); return; }

  try {
    await apiFetch('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ type, items })
    });
    if (requestModalInstance) requestModalInstance.hide();
    renderRequestsTable();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function renderRequestsTable() {
  const titleEl = document.getElementById('requests-page-title');
  if (titleEl && currentUser) {
    titleEl.textContent = currentUser.role === 'admin' ? 'All Employee Requests' : 'My Requests';
  }

  const tbody    = document.getElementById('requests-tbody');
  const emptyDiv = document.getElementById('requests-empty');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';

  try {
    const myRequests = await apiFetch('/api/requests');
    tbody.innerHTML = '';

    if (myRequests.length === 0) {
      emptyDiv.classList.remove('d-none');
      return;
    }
    emptyDiv.classList.add('d-none');

    myRequests.forEach((req, index) => {
      const badgeClass = req.status === 'Approved' ? 'bg-success' : req.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark';
      const itemsText  = req.items.map(i => i.name + ' ×' + i.qty).join(', ');
      const row = document.createElement('tr');

      let actionsHtml = '';
      if (currentUser.role === 'admin' && req.status === 'Pending') {
        actionsHtml =
          '<td>' +
            '<button class="btn btn-sm btn-success me-1" onclick="approveRequest(' + req.id + ')">Approve</button>' +
            '<button class="btn btn-sm btn-danger" onclick="rejectRequest(' + req.id + ')">Reject</button>' +
          '</td>';
      } else {
        actionsHtml = '<td>-</td>';
      }

      row.innerHTML =
        '<td>' + (index + 1) + '</td>' +
        '<td>' + req.type + '</td>' +
        '<td>' + itemsText + '</td>' +
        '<td>' + req.date + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + req.status + '</span></td>' +
        actionsHtml;
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-danger text-center">' + err.message + '</td></tr>';
  }
}

async function approveRequest(id) {
  try {
    await apiFetch('/api/requests/' + id + '/approve', { method: 'PUT' });
    renderRequestsTable();
    alert('Request approved!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function rejectRequest(id) {
  try {
    await apiFetch('/api/requests/' + id + '/reject', { method: 'PUT' });
    renderRequestsTable();
    alert('Request rejected!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

window.addEventListener('hashchange', handleRouting);

window.addEventListener('load', async () => {
  await checkExistingSession();
  if (!window.location.hash) window.location.hash = '#/';
  handleRouting();
});