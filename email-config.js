// ============================================================
//  AgriSystem — Email Configuration
//
//  HOW TO CONFIGURE (choose one method):
//
//  METHOD 1 — Set environment variables before starting:
//    Windows PowerShell:
//      $env:EMAIL_USER="you@gmail.com"
//      $env:EMAIL_PASS="your-16-char-app-password"
//      node server.js
//
//    Windows CMD:
//      set EMAIL_USER=you@gmail.com
//      set EMAIL_PASS=your-16-char-app-password
//      node server.js
//
//  METHOD 2 — Edit this file directly (dev only, do NOT commit):
//    Change the fallback strings below from 'NOT_CONFIGURED' to real values.
//
//  GMAIL SETUP:
//    1. Enable 2-Step Verification on your Google account
//    2. Go to https://myaccount.google.com/apppasswords
//    3. Create an App Password for "Mail"
//    4. Use the 16-character code (no spaces) as EMAIL_PASS
//
//  ⚠️ NEVER commit real credentials to Git!
// ============================================================

require('dotenv').config();

module.exports = {
  // ── SMTP Settings ──────────────────────────────────────────
  SMTP_HOST:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  SMTP_PORT:   parseInt(process.env.SMTP_PORT || '587'),
  SMTP_SECURE: (process.env.SMTP_SECURE === 'true') || false, // true for port 465

  // ── Your Email Credentials ─────────────────────────────────
  //  Set EMAIL_USER and EMAIL_PASS as environment variables.
  //  Leave as 'NOT_CONFIGURED' to get a clear startup error.
  EMAIL_USER: process.env.EMAIL_USER || 'NOT_CONFIGURED',
  EMAIL_PASS: process.env.EMAIL_PASS || 'NOT_CONFIGURED',

  // ── Sender Display Name ────────────────────────────────────
  //  Must match EMAIL_USER or your SMTP provider will reject it.
  get EMAIL_FROM() {
    const user = this.EMAIL_USER;
    return process.env.EMAIL_FROM || `"AgriSystem" <${user}>`;
  },

  // ── App URL (used in reset links) ──────────────────────────
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
};
