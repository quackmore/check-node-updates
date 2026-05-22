import 'dotenv/config';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { exec } from 'child_process';
import log from './utils/logger.js';

// ---------------------------------------------------------------------------
// Config & validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV = ['EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_TO', 'CRON_SCHEDULE'];
const SEMVER_RE = /^v\d+\.\d+\.\d+$/;
const EXEC_TIMEOUT_MS = 30_000;

const isTestMode = process.argv[2] === 'test';

function validateEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) {
    log.error(`Missing required environment variables: ${missing.join(', ')}`);
    log.error('Create a .env file from .env.example and fill in the values.');
    process.exit(1);
  }

  if (!cron.validate(process.env.CRON_SCHEDULE)) {
    log.error(`Invalid CRON_SCHEDULE value: "${process.env.CRON_SCHEDULE}"`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Shell helper
// ---------------------------------------------------------------------------

/**
 * Run a bash snippet that sources nvm and returns stdout.
 * Rejects on non-zero exit or timeout.
 */
function runBash(script) {
  return new Promise((resolve, reject) => {
    const wrapped = `
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" --no-use
      ${script}
    `;

    const child = exec(wrapped, { shell: '/bin/bash', timeout: EXEC_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Shell error: ${error.message}${stderr ? `\nstderr: ${stderr.trim()}` : ''}`));
        return;
      }
      resolve(stdout.trim());
    });

    // Belt-and-suspenders timeout guard
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Shell command timed out after ${EXEC_TIMEOUT_MS / 1000}s`));
    }, EXEC_TIMEOUT_MS + 500);

    child.on('close', () => clearTimeout(timer));
  });
}

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

async function getCurrentVersion() {
  if (isTestMode) return 'v0.0.0';
  const out = await runBash('nvm current');
  // nvm current may return "none" or "system" if no version is active
  if (!SEMVER_RE.test(out)) {
    throw new Error(`nvm current returned unexpected value: "${out}". Is a Node.js version active in nvm?`);
  }
  return out;
}

async function getLatestLtsVersion() {
  // --no-colors avoids ANSI escapes; tail -n 1 gets the newest entry.
  // The last line looks like: "->  v22.13.1   (Latest LTS: Jod)"
  // We extract the first semver token with a regex to be format-agnostic.
  const out = await runBash('nvm ls-remote --lts --no-colors | tail -n 1');
  const match = out.match(/v\d+\.\d+\.\d+/);
  if (!match) {
    throw new Error(`Could not parse LTS version from nvm output: "${out}"`);
  }
  return match[0];
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendAlertEmail(currentVer, ltsVer) {
  const prefix = isTestMode ? '[TEST RUN] ' : '';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `⚠️ ${prefix}Node.js update available: ${currentVer} → ${ltsVer}`,
    text: [
      `Your active Node.js version (${currentVer}) differs from the latest LTS (${ltsVer}).`,
      ``,
      `To upgrade:`,
      `  nvm install --lts`,
      `  nvm alias default lts/*`,
    ].join('\n'),
    html: `
      <p>Your active Node.js version (<strong>${currentVer}</strong>) differs from
      the latest LTS (<strong>${ltsVer}</strong>).</p>
      <p>To upgrade:</p>
      <pre>nvm install --lts\nnvm alias default lts/*</pre>
    `,
  };

  const info = await getTransporter().sendMail(mailOptions);
  log.info(`Alert email sent: ${info.messageId}`);
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

async function checkNodeVersion() {
  log.info(`Running version check${isTestMode ? ' (TEST MODE)' : ''}...`);

  let currentVersion, ltsVersion;

  try {
    [currentVersion, ltsVersion] = await Promise.all([
      getCurrentVersion(),
      getLatestLtsVersion(),
    ]);
  } catch (err) {
    log.error(`Version resolution failed: ${err.message}`);
    return;
  }

  log.info(`Current: ${currentVersion}  |  Latest LTS: ${ltsVersion}`);

  if (currentVersion === ltsVersion) {
    log.info('Node.js is up to date with the latest LTS. Nothing to do.');
    return;
  }

  log.info(`Mismatch detected (${currentVersion} ≠ ${ltsVersion}). Sending alert email...`);

  try {
    await sendAlertEmail(currentVersion, ltsVersion);
  } catch (err) {
    log.error(`Failed to send alert email: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

if (isTestMode) {
  log.info('Single test run with mock version v0.0.0...');
  checkNodeVersion();
} else {
  validateEnv();

  cron.schedule(process.env.CRON_SCHEDULE, () => {
    checkNodeVersion();
  });

  log.info(`Node.js version monitor started. Schedule: "${process.env.CRON_SCHEDULE}"`);
  checkNodeVersion(); // immediate check on startup
}