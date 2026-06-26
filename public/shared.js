// =====================================================
// NASSOR TRAVEL TOURS — shared.js
// This file is loaded on every page.
// It handles: login, register, session, nav display.
// =====================================================

// The URL of your backend server — change this if you deploy
var API = 'http://localhost:3001/api';

// ── Token helpers ────────────────────────────────────
// We store the JWT token in localStorage so the user stays logged in
// even if they refresh the page or open a new tab.

function getToken() {
  return localStorage.getItem('ntt_token');
}

function saveToken(token) {
  localStorage.setItem('ntt_token', token);
}

function clearToken() {
  localStorage.removeItem('ntt_token');
  localStorage.removeItem('ntt_user');
}

function getUser() {
  // Returns the saved user object (name, email, id)
  var raw = localStorage.getItem('ntt_user');
  return raw ? JSON.parse(raw) : null;
}

function saveUser(user) {
  localStorage.setItem('ntt_user', JSON.stringify(user));
}

// ── Auth overlay helpers ─────────────────────────────

// Show/hide the overlay that blocks the page until you sign in
function showOverlay() {
  var el = document.getElementById('auth-overlay');
  if (el) el.classList.remove('gone');
}

function hideOverlay() {
  var el = document.getElementById('auth-overlay');
  if (el) el.classList.add('gone');
}

// Switch between "Login" and "Register" forms on the overlay
function switchAuth(mode) {
  document.getElementById('login-form').classList.toggle('on', mode === 'login');
  document.getElementById('reg-form').classList.toggle('on',   mode === 'register');
}

// ── Guest mode ───────────────────────────────────────
// User can browse without an account — we mark them as a guest
function guestMode() {
  saveUser({ name: 'Guest', guest: true });
  updateNav();
  hideOverlay();
}

// ── Register ─────────────────────────────────────────
async function handleRegister() {
  var name  = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var pass  = document.getElementById('reg-pass').value;
  var err   = document.getElementById('reg-err');
  err.textContent = '';

  // Client-side check before even hitting the server
  if (!name || !email || !pass) {
    err.textContent = 'All fields are required.'; return;
  }
  if (pass.length < 6) {
    err.textContent = 'Password must be at least 6 characters.'; return;
  }

  try {
    var res  = await fetch(API + '/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password: pass })
    });
    var data = await res.json();

    if (!res.ok) {
      // Server returned an error (e.g. email already taken)
      err.textContent = data.error || 'Registration failed.';
      return;
    }

    // Success — save token and user, then hide the overlay
    saveToken(data.token);
    saveUser(data.user);
    updateNav();
    hideOverlay();

  } catch (e) {
    // Network error (server probably not running)
    err.textContent = 'Cannot reach server. Is it running?';
  }
}

// ── Login ─────────────────────────────────────────────
async function handleLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-password').value;
  var err   = document.getElementById('login-err');
  err.textContent = '';

  if (!email || !pass) {
    err.textContent = 'Please enter your email and password.'; return;
  }

  try {
    var res  = await fetch(API + '/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password: pass })
    });
    var data = await res.json();

    if (!res.ok) {
      err.textContent = data.error || 'Login failed.';
      return;
    }

    saveToken(data.token);
    saveUser(data.user);
    updateNav();
    hideOverlay();

  } catch (e) {
    err.textContent = 'Cannot reach server. Is it running?';
  }
}

// ── Logout ────────────────────────────────────────────
function logout() {
  clearToken();
  // Show the auth overlay again so they have to log back in
  showOverlay();
  updateNav();
}

// ── Nav display ───────────────────────────────────────
// Updates the top-right area of the navbar to show who is logged in
function updateNav() {
  var who = document.getElementById('nav-who');
  var out = document.getElementById('nav-out');
  var user = getUser();

  if (user && !user.guest) {
    // Logged-in user: show their name + sign out button
    if (who) who.textContent = '👤 ' + user.name;
    if (out) out.style.display = 'inline-block';
  } else if (user && user.guest) {
    if (who) who.textContent = 'Guest';
    if (out) { out.style.display = 'inline-block'; out.textContent = 'Sign In'; out.onclick = function(){ showOverlay(); }; }
  } else {
    if (who) who.textContent = '';
    if (out) out.style.display = 'none';
  }
}

// ── Mobile nav toggle ─────────────────────────────────
function toggleNav() {
  var drawer = document.getElementById('drawer');
  if (drawer) drawer.classList.toggle('open');
}

// ── On page load ──────────────────────────────────────
// This runs when every page first loads.
// It checks if the user is already logged in and skips the overlay if so.
window.addEventListener('DOMContentLoaded', function () {
  var user  = getUser();
  var token = getToken();

  if (user && token) {
    // Already logged in — skip the overlay
    hideOverlay();
    updateNav();

    // Optionally pre-fill guestbook name field if on that page
    var gbName = document.getElementById('gb-name');
    if (gbName && !user.guest) gbName.value = user.name || '';

  } else {
    // Not logged in — show the auth overlay
    showOverlay();
  }
});
