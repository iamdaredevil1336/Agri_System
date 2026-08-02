// ============================================================
//  AgriSystem — Authentication Module (auth.js)
//  Client-side email auth using localStorage
// ============================================================

const AUTH_STORAGE_KEY = 'agri_users';
const SESSION_KEY = 'agri_session';

// ── Helpers ──────────────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

function getCurrentUser() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session) return null;
    // 24-hour session expiry check (if expiresAt is set)
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch { return null; }
}

function continueAsGuest(e) {
  if (e) e.preventDefault();
  localStorage.setItem('agri_guest_mode', 'true');
  const gate = document.getElementById('contentGate');
  if (gate) {
    gate.classList.add('gate-exit');
    setTimeout(() => gate.remove(), 400);
    document.body.classList.remove('content-locked');
  }
  updateAuthUI();
  if (window.location.pathname.endsWith('login.html')) {
    window.location.href = 'index.html';
  }
}

function setSession(user) {
  // Clear guest mode when logging in
  localStorage.removeItem('agri_guest_mode');
  const sessionData = {
    ...user,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('agri_guest_mode');
}

// Simple hash for localStorage passwords (client-side project)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// ── Auth Actions ─────────────────────────────────────────────
function authSignup(name, email, password) {
  const users = getUsers();
  const emailLower = email.toLowerCase().trim();

  if (users.find(u => u.email === emailLower)) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const user = {
    id: Date.now().toString(36),
    name: name.trim(),
    email: emailLower,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
    avatar: name.trim().charAt(0).toUpperCase()
  };

  users.push(user);
  saveUsers(users);
  setSession({ id: user.id, name: user.name, email: user.email, avatar: user.avatar });
  return { success: true, user };
}

function authLogin(email, password) {
  const users = getUsers();
  const emailLower = email.toLowerCase().trim();
  const user = users.find(u => u.email === emailLower);

  if (!user) {
    return { success: false, error: 'No account found with this email.' };
  }

  if (user.passwordHash !== simpleHash(password)) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  setSession({ id: user.id, name: user.name, email: user.email, avatar: user.avatar });
  return { success: true, user };
}

function authLogout() {
  clearSession();
  updateAuthUI();
}

// ── UI Updates (runs on every page) ──────────────────────────
function updateAuthUI() {
  const user = getCurrentUser();
  const isGuest = localStorage.getItem('agri_guest_mode') === 'true';
  const authBtn = document.getElementById('authNavBtn');
  const authBtnMobile = document.getElementById('authNavBtnMobile');

  if (!authBtn) return;

  if (user) {
    const safeAvatar = escapeHtml(user.avatar);
    const safeName = escapeHtml(user.name);
    const safeEmail = escapeHtml(user.email);

    authBtn.innerHTML = `
      <div class="auth-user-pill" onclick="toggleUserDropdown(event)">
        <div class="auth-avatar">${safeAvatar}</div>
        <span class="auth-user-name">${safeName}</span>
      </div>
      <div class="auth-dropdown" id="authDropdown">
        <div class="auth-dropdown-header">
          <div class="auth-avatar auth-avatar-lg">${safeAvatar}</div>
          <div>
            <div class="auth-dropdown-name">${safeName}</div>
            <div class="auth-dropdown-email">${safeEmail}</div>
          </div>
        </div>
        <div class="auth-dropdown-divider"></div>
        <button class="auth-dropdown-item auth-logout-btn" onclick="authLogout(); window.location.reload();">
          <span>⏻</span> Sign Out
        </button>
      </div>`;
    authBtn.classList.add('logged-in');
  } else if (isGuest) {
    authBtn.innerHTML = `
      <div class="auth-user-pill" onclick="toggleUserDropdown(event)">
        <div class="auth-avatar">👤</div>
        <span class="auth-user-name">Guest</span>
      </div>
      <div class="auth-dropdown" id="authDropdown">
        <div class="auth-dropdown-header">
          <div class="auth-avatar auth-avatar-lg">👤</div>
          <div>
            <div class="auth-dropdown-name">Guest User</div>
            <div class="auth-dropdown-email">Browsing as Guest</div>
          </div>
        </div>
        <div class="auth-dropdown-divider"></div>
        <a href="login.html" class="auth-dropdown-item" onclick="localStorage.removeItem('agri_guest_mode');">
          <span>🔑</span> Sign In / Sign Up
        </a>
      </div>`;
    authBtn.classList.add('logged-in');
  } else {
    authBtn.innerHTML = `<a href="login.html" class="auth-login-link">Sign In</a>`;
    authBtn.classList.remove('logged-in');
  }

  // Mobile nav
  if (authBtnMobile) {
    if (user) {
      const safeAvatar = escapeHtml(user.avatar);
      const safeName = escapeHtml(user.name);
      authBtnMobile.innerHTML = `
        <div class="auth-mobile-user">
          <div class="auth-avatar">${safeAvatar}</div>
          <span>${safeName}</span>
        </div>
        <a href="#" onclick="authLogout(); window.location.reload(); return false;" class="auth-mobile-logout">Sign Out</a>`;
    } else if (isGuest) {
      authBtnMobile.innerHTML = `
        <div class="auth-mobile-user">
          <div class="auth-avatar">👤</div>
          <span>Guest User</span>
        </div>
        <a href="login.html" class="auth-mobile-logout" onclick="localStorage.removeItem('agri_guest_mode');">Sign In</a>`;
    } else {
      authBtnMobile.innerHTML = `<a href="login.html">Sign In</a>`;
    }
  }
}

function toggleUserDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('authDropdown');
  if (dd) dd.classList.toggle('open');
}

// Close dropdown on outside click
document.addEventListener('click', () => {
  const dd = document.getElementById('authDropdown');
  if (dd) dd.classList.remove('open');
});

// ── CONTENT GATE (block pages until login) ───────────────────
function isLoginPage() {
  return window.location.pathname.endsWith('login.html');
}

function showContentGate() {
  if (isLoginPage()) return;
  const user = getCurrentUser();
  const isGuest = localStorage.getItem('agri_guest_mode') === 'true';

  if (user || isGuest) {
    // Remove gate if it exists (e.g. after login or guest click)
    const existing = document.getElementById('contentGate');
    if (existing) {
      existing.classList.add('gate-exit');
      setTimeout(() => existing.remove(), 500);
    }
    document.body.classList.remove('content-locked');
    return;
  }

  // Don't double-inject
  if (document.getElementById('contentGate')) return;

  // Lock body scrolling
  document.body.classList.add('content-locked');

  // Create gate overlay
  const gate = document.createElement('div');
  gate.id = 'contentGate';
  gate.className = 'content-gate';
  gate.innerHTML = `
    <div class="gate-backdrop"></div>
    <div class="gate-card">
      <div class="gate-icon">🔒</div>
      <h2 class="gate-title">Sign in to Continue</h2>
      <p class="gate-desc">Create a free account or sign in to access crop data, seed guides, season calendars & soil matching tools.</p>
      <div class="gate-actions">
        <a href="login.html" class="btn btn-primary gate-btn">Sign In</a>
        <a href="login.html" class="btn btn-outline gate-btn" onclick="localStorage.setItem('agri_auth_mode','signup')">Create Account</a>
      </div>
      <div style="text-align:center; margin-top:14px;">
        <button type="button" class="auth-guest-link" style="background:none; border:none; color:inherit; font-size:0.9rem; cursor:pointer; text-decoration:underline;" onclick="continueAsGuest(event)">Continue as Guest →</button>
      </div>
      <div class="gate-features">
        <div class="gate-feat"><span>🌾</span> 92+ Crops Database</div>
        <div class="gate-feat"><span>🌱</span> Detailed Seed Info</div>
        <div class="gate-feat"><span>📅</span> Sowing Calendars</div>
        <div class="gate-feat"><span>🪱</span> Soil Type Matching</div>
      </div>
    </div>
  `;
  document.body.appendChild(gate);

  // Trigger entrance animation
  requestAnimationFrame(() => gate.classList.add('gate-visible'));
}

// Init auth UI + content gate on page load
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  showContentGate();
});

// ── Login Page Logic ─────────────────────────────────────────
function initLoginPage() {
  const form = document.getElementById('authForm');
  const toggleBtn = document.getElementById('authToggle');
  const submitBtn = document.getElementById('authSubmit');
  const nameField = document.getElementById('authNameGroup');
  const errorEl = document.getElementById('authError');
  const successEl = document.getElementById('authSuccess');
  const titleEl = document.getElementById('authTitle');
  const subtitleEl = document.getElementById('authSubtitle');
  const toggleText = document.getElementById('authToggleText');
  const passwordInput = document.getElementById('authPassword');
  const togglePwdBtn = document.getElementById('togglePassword');

  if (!form) return;

  // Redirect if already logged in
  const currentUser = getCurrentUser();
  if (currentUser) {
    window.location.href = 'index.html';
    return;
  }

  // Check if we came from a reset link
  const urlParams = new URLSearchParams(window.location.search);
  const resetEmailParam = urlParams.get('reset_email');
  if (resetEmailParam) {
    _forgotEmail = resetEmailParam;
    openForgotPassword();
    // Clean up URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  let isLogin = true;

  function setMode(login) {
    isLogin = login;
    nameField.style.display = login ? 'none' : 'block';
    submitBtn.textContent = login ? 'Sign In' : 'Create Account';
    titleEl.textContent = login ? 'Welcome Back' : 'Create Account';
    subtitleEl.textContent = login ? 'Sign in to your AgriSystem account' : 'Join AgriSystem — your agriculture companion';
    toggleText.innerHTML = login
      ? 'Don\'t have an account? <button type="button" class="auth-toggle-link" onclick="initLoginPage.switchMode(false)">Sign Up</button>'
      : 'Already have an account? <button type="button" class="auth-toggle-link" onclick="initLoginPage.switchMode(true)">Sign In</button>';
    errorEl.textContent = '';
    successEl.textContent = '';
    errorEl.classList.remove('visible');
    successEl.classList.remove('visible');
    // Show/hide forgot password link
    const forgotWrap = document.getElementById('authForgotWrap');
    if (forgotWrap) forgotWrap.style.display = login ? '' : 'none';
  }

  initLoginPage.switchMode = setMode;

  // Password visibility toggle
  if (togglePwdBtn) {
    togglePwdBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePwdBtn.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    successEl.textContent = '';
    errorEl.classList.remove('visible');
    successEl.classList.remove('visible');

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    if (isLogin) {
      const result = authLogin(email, password);
      if (result.success) {
        successEl.textContent = 'Login successful! Redirecting…';
        successEl.classList.add('visible');
        submitBtn.classList.add('btn-loading');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      } else {
        errorEl.textContent = result.error;
        errorEl.classList.add('visible');
        shakeForm();
      }
    } else {
      const name = document.getElementById('authName').value;
      if (!name.trim()) {
        errorEl.textContent = 'Please enter your full name.';
        errorEl.classList.add('visible');
        shakeForm();
        return;
      }
      const result = authSignup(name, email, password);
      if (result.success) {
        successEl.textContent = 'Account created! Redirecting…';
        successEl.classList.add('visible');
        submitBtn.classList.add('btn-loading');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      } else {
        errorEl.textContent = result.error;
        errorEl.classList.add('visible');
        shakeForm();
      }
    }
  });

  function shakeForm() {
    const card = document.querySelector('.auth-card');
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
  }

  setMode(true);

  // If redirected from content gate "Create Account" button
  const authMode = localStorage.getItem('agri_auth_mode');
  if (authMode === 'signup') {
    setMode(false);
    localStorage.removeItem('agri_auth_mode');
  }
}

// ── FORGOT PASSWORD FLOW (6-Digit Email OTP System) ────────────
let _forgotEmail = '';
let _otpVerified = false;
let _otpTimerInterval = null;

function openForgotPassword() {
  const overlay = document.getElementById('forgotOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  // Reset to step 1
  document.getElementById('forgotStep1').style.display = '';
  document.getElementById('forgotStep2').style.display = 'none';
  document.getElementById('forgotStep3').style.display = 'none';
  clearForgotErrors();
  _otpVerified = false;
  document.getElementById('forgotEmail').value = _forgotEmail || '';
  document.getElementById('forgotEmail').focus();
  setupOTPInputHandlers();
}

function closeForgotPassword() {
  const overlay = document.getElementById('forgotOverlay');
  if (overlay) overlay.classList.remove('open');
  if (_otpTimerInterval) clearInterval(_otpTimerInterval);
}

function forgotGoBack(toStep) {
  if (toStep === 1) {
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep1').style.display = '';
    clearForgotErrors();
    _otpVerified = false;
  }
}

function clearForgotErrors() {
  ['forgotError1', 'forgotError2', 'forgotError3', 'forgotSuccess3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });
}

function showForgotError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

// Attach auto-advance and backspace listeners to 6-digit OTP inputs
function setupOTPInputHandlers() {
  const inputs = document.querySelectorAll('.otp-digit');
  if (!inputs.length) return;

  inputs.forEach((input, index) => {
    input.oninput = (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val;

      if (val) {
        input.classList.add('filled');
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else {
        input.classList.remove('filled');
      }
    };

    input.onkeydown = (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    };

    input.onpaste = (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
      if (!pastedData) return;

      const digits = pastedData.slice(0, 6).split('');
      digits.forEach((digit, i) => {
        if (inputs[i]) {
          inputs[i].value = digit;
          inputs[i].classList.add('filled');
        }
      });

      const nextFocus = Math.min(digits.length, inputs.length - 1);
      inputs[nextFocus].focus();
    };
  });
}

// Safe JSON Response Parser (prevents "Unexpected end of JSON input" errors)
async function safeParseJsonResponse(res) {
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    throw new Error(`Network response error (${res.status}).`);
  }

  if (!text || !text.trim()) {
    throw new Error(`Server returned an empty response (Status ${res.status}). Is the server running?`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Non-JSON Response body:', text);
    throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
  }
}

// STEP 1: Request 6-Digit OTP via Server
async function forgotSendOTP(e) {
  if (e) e.preventDefault();
  clearForgotErrors();

  const emailInput = document.getElementById('forgotEmail');
  const email = emailInput ? emailInput.value.trim().toLowerCase() : _forgotEmail;
  if (!email) {
    showForgotError('forgotError1', 'Please enter a valid email address.');
    return;
  }

  _forgotEmail = email;
  _otpVerified = false;

  const sendBtn = document.getElementById('forgotSendBtn');
  if (sendBtn) {
    sendBtn.classList.add('btn-loading');
    sendBtn.textContent = 'Sending OTP…';
  }

  try {
    const res = await fetch('/api/send-reset-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await safeParseJsonResponse(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to send OTP code. Please check email configuration.');
    }

    // Display email in Step 2
    document.getElementById('forgotEmailDisplay').textContent = email;

    // Clear previous inputs
    document.querySelectorAll('.otp-digit').forEach(inp => {
      inp.value = '';
      inp.classList.remove('filled');
    });

    // Switch to step 2
    document.getElementById('forgotStep1').style.display = 'none';
    document.getElementById('forgotStep2').style.display = '';

    setupOTPInputHandlers();
    const firstInput = document.getElementById('otp1');
    if (firstInput) firstInput.focus();

    startOTPTimer(60);
  } catch (err) {
    console.error('OTP send failed:', err);
    showForgotError('forgotError1', err.message || 'Error sending OTP. Please check server settings.');
  } finally {
    if (sendBtn) {
      sendBtn.classList.remove('btn-loading');
      sendBtn.textContent = 'Send 6-Digit OTP';
    }
  }
}

// Timer for OTP resend button
function startOTPTimer(seconds) {
  if (_otpTimerInterval) clearInterval(_otpTimerInterval);
  let timeLeft = seconds;

  const resendBtn = document.getElementById('otpResendBtn');
  const timerText = document.getElementById('otpTimerText');

  if (resendBtn) {
    resendBtn.style.pointerEvents = 'none';
    resendBtn.style.opacity = '0.5';
  }

  function update() {
    if (timeLeft <= 0) {
      clearInterval(_otpTimerInterval);
      if (timerText) timerText.textContent = '';
      if (resendBtn) {
        resendBtn.style.pointerEvents = '';
        resendBtn.style.opacity = '1';
        resendBtn.textContent = 'Resend OTP';
      }
    } else {
      if (timerText) timerText.textContent = `(${timeLeft}s)`;
      timeLeft--;
    }
  }

  update();
  _otpTimerInterval = setInterval(update, 1000);
}

// Resend OTP handler
function forgotResendOTP() {
  forgotSendOTP(null);
}

// STEP 2: Verify 6-Digit OTP with Server
async function forgotVerifyOTP(e) {
  e.preventDefault();
  clearForgotErrors();

  const inputs = document.querySelectorAll('.otp-digit');
  let enteredOTP = '';
  inputs.forEach(inp => enteredOTP += inp.value.trim());

  if (enteredOTP.length < 6) {
    showForgotError('forgotError2', 'Please enter all 6 digits of the verification code.');
    return;
  }

  const verifyBtn = document.getElementById('forgotVerifyBtn');
  if (verifyBtn) {
    verifyBtn.classList.add('btn-loading');
    verifyBtn.textContent = 'Verifying…';
  }

  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _forgotEmail, otp: enteredOTP })
    });

    const data = await safeParseJsonResponse(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid 6-digit OTP code.');
    }

    _otpVerified = true;

    // Proceed to Step 3
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep3').style.display = '';
    const newPwdInput = document.getElementById('forgotNewPwd');
    if (newPwdInput) {
      newPwdInput.value = '';
      newPwdInput.focus();
    }
    const confirmPwdInput = document.getElementById('forgotConfirmPwd');
    if (confirmPwdInput) confirmPwdInput.value = '';

  } catch (err) {
    console.error('OTP verification failed:', err);
    showForgotError('forgotError2', err.message || 'Invalid OTP code. Please check your code and try again.');
  } finally {
    if (verifyBtn) {
      verifyBtn.classList.remove('btn-loading');
      verifyBtn.textContent = 'Verify OTP & Continue';
    }
  }
}

// STEP 3: Reset Password (Enforces verified OTP)
function forgotResetPassword(e) {
  e.preventDefault();
  clearForgotErrors();

  if (!_otpVerified) {
    showForgotError('forgotError3', 'Security verification required. Please complete OTP verification first.');
    return;
  }

  const newPwd = document.getElementById('forgotNewPwd').value;
  const confirmPwd = document.getElementById('forgotConfirmPwd').value;

  if (newPwd.length < 6) {
    showForgotError('forgotError3', 'Password must be at least 6 characters.');
    return;
  }

  if (newPwd !== confirmPwd) {
    showForgotError('forgotError3', 'Passwords do not match.');
    return;
  }

  const targetEmail = _forgotEmail;
  if (!targetEmail) {
    showForgotError('forgotError3', 'Email address missing. Please request a new OTP.');
    return;
  }

  // Update password in localStorage
  const users = getUsers();
  const userIdx = users.findIndex(u => u.email === targetEmail);
  if (userIdx === -1) {
    const newUser = {
      id: Date.now().toString(36),
      name: targetEmail.split('@')[0],
      email: targetEmail,
      passwordHash: simpleHash(newPwd),
      createdAt: new Date().toISOString(),
      avatar: targetEmail.charAt(0).toUpperCase()
    };
    users.push(newUser);
    saveUsers(users);
  } else {
    users[userIdx].passwordHash = simpleHash(newPwd);
    saveUsers(users);
  }

  // Show success
  const successEl = document.getElementById('forgotSuccess3');
  successEl.textContent = 'Password reset successful! Redirecting to sign in…';
  successEl.classList.add('visible');

  const resetBtn = document.getElementById('forgotResetBtn');
  if (resetBtn) resetBtn.classList.add('btn-loading');

  setTimeout(() => {
    closeForgotPassword();
    if (resetBtn) resetBtn.classList.remove('btn-loading');
    // Pre-fill email on login form
    const emailInput = document.getElementById('authEmail');
    if (emailInput) emailInput.value = targetEmail;
    _forgotEmail = '';
    _otpVerified = false;
  }, 1500);
}
