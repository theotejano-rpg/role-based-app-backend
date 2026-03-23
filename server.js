const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret';

app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));

app.use(express.json());

let users = [
  {
    id: 1,
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: '',
    role: 'admin',
    verified: true
  },
  {
    id: 2,
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
    password: '',
    role: 'user',
    verified: true
  }
];

(async () => {
  users[0].password = bcrypt.hashSync('Password123!', 10);
  users[1].password = bcrypt.hashSync('user123', 10);
})();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    firstName,
    lastName,
    email,
    password: hashedPassword,
    role: 'user',
    verified: false
  };

  users.push(newUser);
  res.status(201).json({ message: 'User registered', email, role: newUser.role });
});

app.post('/api/verify-email', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  user.verified = true;
  res.json({ message: 'Email verified successfully!' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);

  if (!user || !user.verified || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password, or account not verified.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    SECRET_KEY,
    { expiresIn: '1m' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      verified: user.verified
    }
  });
});

app.get('/api/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({ message: 'Welcome to admin dashboard!', data: 'Secret admin info' });
});

app.get('/api/content/guest', (req, res) => {
  res.json({ message: 'Public content for all visitors' });
});

app.get('/api/accounts', authenticateToken, authorizeRole('admin'), (req, res) => {
  const safeUsers = users.map(({ password, ...rest }) => rest);
  res.json(safeUsers);
});

app.post('/api/accounts', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { firstName, lastName, email, password, role, verified } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const existing = users.find(u => u.email === email);
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now(),
    firstName, lastName, email,
    password: hashedPassword,
    role: role || 'user',
    verified: verified || false
  };
  users.push(newUser);
  const { password: _, ...safe } = newUser;
  res.status(201).json(safe);
});

app.put('/api/accounts/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const { firstName, lastName, email, password, role, verified } = req.body;
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;
  if (password) user.password = await bcrypt.hash(password, 10);
  if (role) user.role = role;
  if (verified !== undefined) user.verified = verified;

  const { password: _, ...safe } = user;
  res.json(safe);
});

app.put('/api/accounts/:id/reset-password', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  user.password = await bcrypt.hash(newPassword, 10);
  res.json({ message: 'Password reset successfully!' });
});

app.delete('/api/accounts/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: 'Account not found' });
  users.splice(index, 1);
  res.json({ message: 'Account deleted' });
});

let departments = [
  { id: 1, name: 'Engineering', description: 'Software team' },
  { id: 2, name: 'HR', description: 'Human Resources' }
];

app.get('/api/departments', authenticateToken, (req, res) => {
  res.json(departments);
});

app.post('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) return res.status(400).json({ error: 'Name and description required' });
  const dept = { id: Date.now(), name, description };
  departments.push(dept);
  res.status(201).json(dept);
});

app.put('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const dept = departments.find(d => d.id === id);
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  const { name, description } = req.body;
  if (name) dept.name = name;
  if (description) dept.description = description;
  res.json(dept);
});

app.delete('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const index = departments.findIndex(d => d.id === id);
  if (index === -1) return res.status(404).json({ error: 'Department not found' });
  departments.splice(index, 1);
  res.json({ message: 'Department deleted' });
});

let employees = [];

app.get('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json(employees);
});

app.post('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
  const { employeeId, userEmail, position, deptId, hireDate } = req.body;
  if (!employeeId || !userEmail || !position || !hireDate) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const userExists = users.find(u => u.email === userEmail);
  if (!userExists) return res.status(404).json({ error: 'No account found with that email!' });

  const emp = { id: Date.now(), employeeId, userEmail, position, deptId: parseInt(deptId), hireDate };
  employees.push(emp);
  res.status(201).json(emp);
});

app.delete('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const index = employees.findIndex(e => e.id === id);
  if (index === -1) return res.status(404).json({ error: 'Employee not found' });
  employees.splice(index, 1);
  res.json({ message: 'Employee deleted' });
});

let requests = [];

app.get('/api/requests', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    res.json(requests);
  } else {
    res.json(requests.filter(r => r.employeeEmail === req.user.email));
  }
});

app.post('/api/requests', authenticateToken, (req, res) => {
  const { type, items } = req.body;
  if (!type || !items || items.length === 0) {
    return res.status(400).json({ error: 'Type and at least one item are required' });
  }
  const newRequest = {
    id: Date.now(),
    type,
    items,
    status: 'Pending',
    date: new Date().toLocaleDateString(),
    employeeEmail: req.user.email
  };
  requests.push(newRequest);
  res.status(201).json(newRequest);
});

app.put('/api/requests/:id/approve', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const request = requests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  request.status = 'Approved';
  res.json(request);
});

app.put('/api/requests/:id/reject', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  const request = requests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  request.status = 'Rejected';
  res.json(request);
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`🔑 Try logging in with:`);
  console.log(`   - Admin: email=admin@example.com, password=Password123!`);
  console.log(`   - User:  email=alice@example.com, password=user123`);
});