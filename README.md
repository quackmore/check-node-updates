# check-node-updates

A lightweight Node.js service that periodically compares your active nvm-managed Node.js version against the latest LTS release and sends you an email alert when they diverge.

## How it works

On startup and then on a configurable cron schedule, the service runs `nvm current` and `nvm ls-remote --lts` inside a sourced nvm environment, extracts the versions, and compares them. If they differ, it fires an alert email via Gmail SMTP.

## Requirements

- Node.js ≥ 18
- [nvm](https://github.com/nvm-sh/nvm) installed and managing at least one Node.js version
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) configured

## Setup

```bash
git clone https://github.com/you/check-node-updates.git
cd check-node-updates
npm install
```

## Configuration

All configuration lives in a `.env` file in the project root diretory, like this one:
```.env
EMAIL_USER="your-gmail-username@gmail.com"
EMAIL_PASSWORD="your-gmail-app-password"
EMAIL_TO="notification-recipient@example.com"
CRON_SCHEDULE="0 8 * * *"
```


| Variable        | Description                                              | Example                  |
|-----------------|----------------------------------------------------------|--------------------------|
| `EMAIL_USER`    | Gmail address used to send alerts                        | `you@gmail.com`          |
| `EMAIL_PASSWORD`| Gmail App Password (not your account password)           | `xxxx xxxx xxxx xxxx`    |
| `EMAIL_TO`      | Recipient address(es), comma-separated                   | `recipient@example.com`  |
| `CRON_SCHEDULE` | [Cron expression](https://crontab.guru) for check timing | `0 8 * * *` (daily 8 AM) |

## Usage

```bash
# Start the service (validates config, runs an immediate check, then follows the schedule)
npm start

# One-off test run — uses mock version v0.0.0 to force an email send
npm test
```

The test mode bypasses `.env` validation and injects `v0.0.0` as the current version, which is guaranteed to trigger an alert so you can verify your email setup end-to-end.
