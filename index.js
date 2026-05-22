import 'dotenv/config';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { exec } from 'child_process';
import log from './utils/logger.js';

let transporter;

// Determine if we are running a one-off test from the CLI arguments
const isTestMode = process.argv[2] === 'test';

const initializeEmailTransporter = () => {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

const sendAlertEmail = async (currentVer, ltsVer) => {
  if (!transporter) initializeEmailTransporter();

  const prefix = isTestMode ? '[TEST RUN] ' : '';
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `⚠️ ${prefix}Node.js Version Update Available`,
    text: `Your running Node.js version (${currentVer}) is different from the latest available LTS version (${ltsVer}). Consider upgrading.`,
    html: `<p>Your running Node.js version (<strong>${currentVer}</strong>) is different from the latest available LTS version (<strong>${ltsVer}</strong>).</p><p>Consider upgrading your environment.</p>`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    log.info(`Alert email sent successfully: ${info.messageId}`);
  } catch (error) {
    log.error(`Failed to send email:`, error);
  }
};

const checkNodeVersion = () => {
  log.info(`Running version check${isTestMode ? ' (TEST MODE)' : ''}...`);

  // If in test mode, we hardcode CURRENT to v0.0.0
  const nodeVersionCommand = isTestMode ? 'echo "v0.0.0"' : 'node -v';

  // We explicitly add --no-colors to suppress any terminal color escapes natively
  const bashCommand = `
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
    CURRENT=$(${nodeVersionCommand})
    LTS=$(nvm ls-remote --lts --no-colors | tail -n 1 | awk '{print $2}')
    echo "$CURRENT|$LTS"
  `;

  exec(bashCommand, { shell: '/bin/bash' }, (error, stdout, stderr) => {
    if (error) {
      log.error(`Execution error: ${error.message}`);
      return;
    }

    const output = stdout.trim();
    if (!output.includes('|')) {
      log.error(`Unexpected output format: ${output}`);
      return;
    }

    // Split and cleanly map away any remaining surrounding whitespace or line-breaks
    const [currentVersion, ltsVersion] = output.split('|').map(v => v.trim());

    log.info(`Evaluated Version: ${currentVersion} | Latest LTS: ${ltsVersion}`);

    if (!ltsVersion) {
      log.error('Error: Could not retrieve latest LTS version from nvm.');
      return;
    }

    if (currentVersion !== ltsVersion) {
      log.info('Mismatch detected. Triggering email...');
      sendAlertEmail(currentVersion, ltsVersion);
    } else {
      log.info('Node.js is up to date with the latest LTS.');
    }
  });
};

// Execution Flow Logic
if (isTestMode) {
  log.info('Executing a single test run with mock version v0.0.0...');
  checkNodeVersion();
} else {
  // Production Routine: Run on schedule
  cron.schedule(process.env.CRON_SCHEDULE, () => {
    checkNodeVersion();
  });

  log.info('Node.js version monitor service started. Cron scheduled for daily checks.');
  // Initial check on production startup
  checkNodeVersion();
}
