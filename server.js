// ============================================================
//  AgriSystem — REST API Server
//  Run: node server.js   |   Port: 3000
// ============================================================
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto    = require('crypto');
const emailConfig = require('./email-config');
const { crops, seasons, soilTypes } = require('./data');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 1. Security & Protection Middleware ────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images/emojis across origins
  contentSecurityPolicy: false // Allow inline scripts/styles for simple frontend
}));

// CORS Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle CORS preflight explicitly
app.options('*', cors());

// Rate Limiting — Global API (100 requests per 15 minutes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests. Please try again later.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// Rate Limiting — OTP Endpoints (5 requests per 15 minutes)
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many password reset attempts. Please try again in 15 minutes.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 2. Body Parsing & Logging Middleware ───────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Force application/json for all /api/ responses
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Serve static frontend files after API middleware
app.use(express.static(__dirname));

// ── 3. Helper Functions ──────────────────────────────────────
const ok   = (data, meta = {}) => ({ success: true,  ...meta, data });
const fail = (msg, code = 404) => ({ success: false, error: msg, code });

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function filterCrops(q) {
  let r = [...crops];
  if (q.season)   r = r.filter(c => c.season.some(s  => s.toLowerCase()  === q.season.toLowerCase()));
  if (q.soil)     r = r.filter(c => c.soil_types.some(s => s.toLowerCase() === q.soil.toLowerCase()));
  if (q.climate)  r = r.filter(c => c.climate.some(cl => cl.toLowerCase() === q.climate.toLowerCase()));
  if (q.water)    r = r.filter(c => c.water_requirement.toLowerCase() === q.water.toLowerCase());
  if (q.category) r = r.filter(c => c.category.toLowerCase() === q.category.toLowerCase());
  if (q.search) {
    const t = q.search.toLowerCase();
    r = r.filter(c => c.name.toLowerCase().includes(t) || c.description.toLowerCase().includes(t) || c.category.toLowerCase().includes(t));
  }
  return r;
}

// ── 4. Standard Crop API Routes ──────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/api/crops', (req, res) => {
  const result = filterCrops(req.query);
  if (!result.length) return res.status(404).json(fail('No crops found matching filters.'));
  const summary = result.map(({ id, name, image, category, season, soil_types, climate,
    water_requirement, sowing_months, harvest_months, duration_days, description }) =>
    ({ id, name, image, category, season, soil_types, climate, water_requirement, sowing_months, harvest_months, duration_days, description }));
  res.json(ok(summary, { total: summary.length }));
});

app.get('/api/crops/:id', (req, res) => {
  const crop = crops.find(c => c.id === parseInt(req.params.id));
  if (!crop) return res.status(404).json(fail(`Crop id=${req.params.id} not found.`));
  res.json(ok(crop));
});

app.get('/api/seeds', (req, res) => {
  const filtered = filterCrops(req.query);
  const seeds = filtered.map(c => ({ crop_id: c.id, crop_name: c.name, image: c.image, category: c.category, season: c.season, ...c.seeds }));
  if (!seeds.length) return res.status(404).json(fail('No seeds found.'));
  res.json(ok(seeds, { total: seeds.length }));
});

app.get('/api/seeds/:cropId', (req, res) => {
  const crop = crops.find(c => c.id === parseInt(req.params.cropId));
  if (!crop) return res.status(404).json(fail(`Crop id=${req.params.cropId} not found.`));
  res.json(ok({ crop_id: crop.id, crop_name: crop.name, image: crop.image, care_tips: crop.care_tips,
    sowing_months: crop.sowing_months, harvest_months: crop.harvest_months, ...crop.seeds }));
});

app.get('/api/seasons', (req, res) => {
  const result = seasons.map(s => ({
    ...s,
    crops_count: crops.filter(c => c.season.includes(s.id)).length,
    crops: crops.filter(c => c.season.includes(s.id)).map(c => ({ id: c.id, name: c.name, image: c.image }))
  }));
  res.json(ok(result, { total: result.length }));
});

app.get('/api/soils', (req, res) => {
  const result = soilTypes.map(s => ({
    ...s,
    crops: crops.filter(c => c.soil_types.includes(s.id)).map(c => ({ id: c.id, name: c.name, image: c.image, category: c.category }))
  }));
  res.json(ok(result, { total: result.length }));
});

app.get('/api/categories', (req, res) => {
  const cats = [...new Set(crops.map(c => c.category))];
  const result = cats.map(cat => ({
    id: cat, label: cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    crops_count: crops.filter(c => c.category === cat).length,
    crops: crops.filter(c => c.category === cat).map(c => ({ id: c.id, name: c.name, image: c.image }))
  }));
  res.json(ok(result));
});

app.get('/api/search', (req, res) => {
  const q = req.query.q;
  if (!q?.trim()) return res.status(400).json(fail('Provide ?q=term', 400));
  const result = filterCrops({ search: q });
  if (!result.length) return res.status(404).json(fail(`No results for "${q}"`));
  res.json(ok(result, { total: result.length, query: q }));
});

// ── 5. SECURE FORGOT PASSWORD / OTP ENDPOINTS ──────────────────
// Store: key = email -> value = { hash, expiresAt, attempts, lastSent }
const otpStore = new Map();

const OTP_TTL_MS     = 5 * 60 * 1000; // 5 minutes expiry (Task 4 requirement)
const COOLDOWN_MS    = 60 * 1000;     // 60-second resend cooldown
const MAX_ATTEMPTS   = 5;             // Max invalid attempts before lockout

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
}

// Controller to send 6-digit OTP
const handleSendResetOTP = async (req, res) => {
  try {
    console.log(`[OTP Request] Payload received:`, req.body);
    const { email } = req.body || {};

    if (!email || !isValidEmail(email)) {
      console.warn(`[OTP Request Error] Invalid or missing email address.`);
      return res.status(400).json(fail('Please enter a valid email address.', 400));
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── Check 60-second resend cooldown ─────────────────────
    const existing = otpStore.get(cleanEmail);
    if (existing && existing.lastSent && (Date.now() - existing.lastSent) < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - (Date.now() - existing.lastSent)) / 1000);
      console.warn(`[OTP Request] Cooldown active for ${cleanEmail}. Must wait ${waitSeconds}s`);
      return res.status(429).json(fail(`Please wait ${waitSeconds} seconds before requesting a new OTP.`, 429));
    }

    // ── Guard: Reject immediately if SMTP is not configured ────
    if (emailConfig.EMAIL_USER === 'NOT_CONFIGURED' || emailConfig.EMAIL_PASS === 'NOT_CONFIGURED') {
      console.error('[OTP Request Error] Email service not configured. Set EMAIL_USER and EMAIL_PASS environment variables.');
      return res.status(503).json(fail(
        'Email service is not configured on this server. Please contact the administrator.',
        503
      ));
    }

    // ── Build real SMTP transporter ────────────────────────────
    const transporter = nodemailer.createTransport({
      host:   emailConfig.SMTP_HOST,
      port:   emailConfig.SMTP_PORT,
      secure: emailConfig.SMTP_SECURE,
      auth: {
        user: emailConfig.EMAIL_USER,
        pass: emailConfig.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout:   10000,
      socketTimeout:     10000,
    });

    // ── Verify SMTP connection BEFORE generating & storing OTP ─
    console.log(`[OTP Request] Verifying SMTP connection to ${emailConfig.SMTP_HOST}:${emailConfig.SMTP_PORT}...`);
    await transporter.verify();
    console.log(`[OTP Request] SMTP connection verified OK.`);

    // ── Generate secure 6-digit OTP ───────────────────────────
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = hashOTP(otp);
    const expiresAt = Date.now() + OTP_TTL_MS; // 5 minutes expiry

    const mailOptions = {
      from:    emailConfig.EMAIL_FROM,
      to:      cleanEmail,
      subject: `${otp} is your AgriSystem Verification Code`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">🌾 AgriSystem — Verification Code</h2>
          <p style="color: #475569; line-height: 1.6;">You requested a password reset. Enter the following 6-digit code in the app:</p>
          <div style="text-align: center; margin: 28px 0; padding: 20px 16px; background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #16a34a; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 13px; margin: 0;">This code expires in <strong>5 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
        </div>
      `
    };

    // ── Send email — ONLY store OTP hash after confirmed send ──
    console.log(`[OTP Request] Sending OTP email to ${cleanEmail}...`);
    await transporter.sendMail(mailOptions);
    console.log(`[OTP Request] ✅ OTP email delivered successfully to ${cleanEmail}.`);

    // Store hash, expiration, attempt counter, and timestamp
    otpStore.set(cleanEmail, { hash: hashedOtp, expiresAt, attempts: 0, lastSent: Date.now() });

    return res.status(200).json(ok({ message: '6-digit OTP code sent to your email address.' }));

  } catch (error) {
    console.error('[OTP Request Exception]:', error.message || error);

    let userMsg = 'Failed to send OTP email. Please try again later.';
    const errMsg = (error.message || '').toLowerCase();
    if (errMsg.includes('invalid login') || errMsg.includes('username and password') || errMsg.includes('535')) {
      userMsg = 'Email authentication failed. Please check your SMTP credentials (EMAIL_USER / EMAIL_PASS).';
    } else if (errMsg.includes('etimedout') || errMsg.includes('econnrefused') || errMsg.includes('enotfound')) {
      userMsg = 'Cannot connect to email server. Check SMTP_HOST and SMTP_PORT settings.';
    } else if (errMsg.includes('not_configured')) {
      userMsg = 'Email service is not configured on this server.';
    }

    return res.status(500).json(fail(userMsg, 500));
  }
};

// Controller to verify 6-digit OTP
const handleVerifyOTP = (req, res) => {
  try {
    console.log(`[OTP Verification] Payload received:`, req.body);
    const { email, otp } = req.body || {};

    if (!email || !isValidEmail(email) || !otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      console.warn(`[OTP Verification Error] Invalid format for email or 6-digit OTP.`);
      return res.status(400).json(fail('Please enter a valid email and 6-digit OTP code.', 400));
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp   = otp.trim();

    const record = otpStore.get(cleanEmail);
    if (!record) {
      console.warn(`[OTP Verification Failed] No active OTP found for ${cleanEmail}`);
      return res.status(400).json(fail('No active OTP found or code expired. Please request a new code.', 400));
    }

    // ── Check Expiry (5 minutes) ─────────────────────────────
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      console.warn(`[OTP Verification Failed] Expired code for ${cleanEmail}`);
      return res.status(400).json(fail('OTP code has expired. Please request a new code.', 400));
    }

    // ── Check Max Invalid Attempt Limit ───────────────────────
    if (record.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(cleanEmail);
      console.warn(`[OTP Verification Lockout] Exceeded max attempts (${MAX_ATTEMPTS}) for ${cleanEmail}`);
      return res.status(429).json(fail('Too many invalid attempts. This OTP has been invalidated for security. Please request a new code.', 429));
    }

    // ── Compare Hashes ───────────────────────────────────────
    const enteredHash = hashOTP(cleanOtp);
    if (record.hash !== enteredHash) {
      record.attempts += 1;
      const remaining = MAX_ATTEMPTS - record.attempts;
      console.warn(`[OTP Verification Failed] Incorrect OTP entered for ${cleanEmail}. Attempt ${record.attempts}/${MAX_ATTEMPTS}`);
      
      if (remaining <= 0) {
        otpStore.delete(cleanEmail);
        return res.status(429).json(fail('Too many invalid attempts. This OTP has been invalidated. Please request a new code.', 429));
      }

      return res.status(400).json(fail(`Invalid 6-digit OTP code. ${remaining} attempt(s) remaining.`, 400));
    }

    // ── Success! Delete OTP immediately to prevent reuse ──────
    otpStore.delete(cleanEmail);
    console.log(`[OTP Verified] Verification successful for ${cleanEmail}. OTP deleted to prevent reuse.`);

    return res.status(200).json(ok({ verified: true, message: 'OTP verified successfully.' }));
  } catch (error) {
    console.error('[OTP Verify Exception]:', error);
    return res.status(500).json(fail('An internal error occurred while verifying OTP.', 500));
  }
};

// Handle non-POST methods on forgot password endpoints gracefully with 405 JSON
const methodNotAllowedHandler = (req, res) => {
  console.warn(`[405 Method Not Allowed] ${req.method} call on ${req.originalUrl}`);
  res.status(405).json(fail(`Method ${req.method} Not Allowed on ${req.originalUrl}. Please send a POST request.`, 405));
};

// Bind POST handlers with OTP rate limiter and 405 fallback handlers
app.route('/api/send-reset-otp')
   .post(otpRateLimiter, handleSendResetOTP)
   .all(methodNotAllowedHandler);

app.route('/api/send-reset-email')
   .post(otpRateLimiter, handleSendResetOTP)
   .all(methodNotAllowedHandler);

app.route('/api/verify-otp')
   .post(otpRateLimiter, handleVerifyOTP)
   .all(methodNotAllowedHandler);

// ── 6. 404 Route Handler for /api and static routes ─────────────
app.use((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(404).json(fail(`Route "${req.originalUrl}" not found.`, 404));
});

// ── 7. Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Global Express Error Handler]:', err);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const status = err.status || err.statusCode || 500;
  res.status(status).json(fail(err.message || 'Internal Server Error', status));
});

// ── 8. Startup Config Validation ───────────────────────────────
function checkEmailConfig() {
  const cfg = emailConfig;
  if (cfg.EMAIL_USER === 'NOT_CONFIGURED' || cfg.EMAIL_PASS === 'NOT_CONFIGURED') {
    console.warn('━'.repeat(60));
    console.warn('⚠️  EMAIL NOT CONFIGURED — Forgot Password will not work!');
    console.warn('   Create a .env file or set environment variables:');
    console.warn('   EMAIL_USER=your-email@gmail.com');
    console.warn('   EMAIL_PASS=your-16-char-app-password');
    console.warn('   Then restart: node server.js');
    console.warn('━'.repeat(60));
    return false;
  }
  console.log(`✅ Email configured: ${cfg.EMAIL_USER} via ${cfg.SMTP_HOST}:${cfg.SMTP_PORT}`);
  return true;
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌾 AgriSystem API → http://localhost:${PORT}`);
    checkEmailConfig();
  });
}

module.exports = app;
