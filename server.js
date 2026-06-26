// =====================================================
// NASSOR TRAVEL TOURS — Backend Server
// Stack: Node.js + Express
// Storage: JSON file (no database needed — simple!)
// =====================================================

const express  = require('express');
const bcrypt   = require('bcryptjs');   // for hashing passwords
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// A secret key used to sign JWT tokens — in production, store this in an env variable
const JWT_SECRET = 'nassor-travel-secret-2024';

// ── Middleware ──────────────────────────────────────
app.use(cors());                        // allow requests from the front-end (different port)
app.use(express.json());                // parse incoming JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // serve front-end files

// ── Simple JSON file database ───────────────────────
// Instead of a real database, we store data in JSON files.
// Easy to read, easy to reset, good enough for a simple site.

const DB_DIR   = path.join(__dirname, 'data');
const USERS_FILE     = path.join(DB_DIR, 'users.json');
const GUESTBOOK_FILE = path.join(DB_DIR, 'guestbook.json');

// Create the data folder and files if they don't exist yet
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
if (!fs.existsSync(USERS_FILE))     fs.writeFileSync(USERS_FILE,     '[]');
if (!fs.existsSync(GUESTBOOK_FILE)) fs.writeFileSync(GUESTBOOK_FILE, '[]');

// Helper: read a JSON file and return parsed array
function readDB(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Helper: write an array back to a JSON file
function writeDB(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Auth middleware ─────────────────────────────────
// This runs before any protected route to verify the user's token
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Token comes as "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // verify + decode
    req.user = decoded;   // attach user info to the request object
    next();               // continue to the actual route handler
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// =====================================================
// AUTH ROUTES
// =====================================================

// ── POST /api/register ──────────────────────────────
// Creates a new user account
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const users = readDB(USERS_FILE);

  // Check if email is already registered
  if (users.find(u => u.email === email.toLowerCase()))
    return res.status(409).json({ error: 'An account with that email already exists.' });

  // Hash the password — NEVER store plain text passwords
  const hashed = await bcrypt.hash(password, 10); // 10 = salt rounds (higher = slower but safer)

  // Build the new user object
  const newUser = {
    id:       Date.now(),             // simple unique ID using timestamp
    name:     name.trim(),
    email:    email.toLowerCase().trim(),
    password: hashed,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeDB(USERS_FILE, users);

  // Create a JWT token for the new user (so they're logged in immediately)
  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email },
    JWT_SECRET,
    { expiresIn: '7d' }  // token expires in 7 days
  );

  res.status(201).json({
    message: 'Account created!',
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

// ── POST /api/login ─────────────────────────────────
// Logs in an existing user and returns a token
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const users = readDB(USERS_FILE);
  const user  = users.find(u => u.email === email.toLowerCase().trim());

  // Don't tell the user specifically which is wrong (security best practice)
  if (!user)
    return res.status(401).json({ error: 'Invalid email or password.' });

  // Compare entered password with stored hash
  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.status(401).json({ error: 'Invalid email or password.' });

  // Issue a JWT token
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login successful!',
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

// ── GET /api/me ──────────────────────────────────────
// Returns the currently logged-in user's info (used on page load to restore session)
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// =====================================================
// GUESTBOOK ROUTES
// =====================================================

// ── GET /api/guestbook ──────────────────────────────
// Returns all guestbook messages (newest first)
app.get('/api/guestbook', (req, res) => {
  const msgs = readDB(GUESTBOOK_FILE);
  res.json(msgs);
});

// ── POST /api/guestbook ─────────────────────────────
// Adds a new guestbook message (no auth required — guests can post too)
app.post('/api/guestbook', (req, res) => {
  const { name, from, msg } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!msg  || msg.trim().length < 5) return res.status(400).json({ error: 'Message must be at least 5 characters.' });

  const msgs = readDB(GUESTBOOK_FILE);

  const newMsg = {
    id:   Date.now(),
    name: name.trim(),
    from: from ? from.trim() : '',
    msg:  msg.trim(),
    date: new Date().toISOString()
  };

  msgs.unshift(newMsg); // add to top of the list
  writeDB(GUESTBOOK_FILE, msgs);

  res.status(201).json(newMsg);
});

// ── DELETE /api/guestbook/:id ────────────────────────
// Deletes a message — only allowed if you're logged in (requireAuth)
app.delete('/api/guestbook/:id', requireAuth, (req, res) => {
  const id   = Number(req.params.id);
  let msgs   = readDB(GUESTBOOK_FILE);
  const idx  = msgs.findIndex(m => m.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Message not found.' });

  msgs.splice(idx, 1);
  writeDB(GUESTBOOK_FILE, msgs);
  res.json({ message: 'Deleted.' });
});

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, () => {
  console.log(`\n🌍 Nassor Travel Tours backend running!`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   API ready at http://localhost:${PORT}/api\n`);
});
