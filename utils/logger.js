// Locale-aware timestamp — picks up the system timezone automatically.
const dtf = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
});

const fmt = (level, msg) => {
  // sv-SE produces "YYYY-MM-DD HH:mm:ss,mmm"; swap comma→dot for ISO feel
  const ts = dtf.format(new Date()).replace(',', '.');
  return `${ts} ${level.padEnd(5)}: ${msg}`;
};

export default {
  info:  (msg) => console.log(fmt('info',  msg)),
  warn:  (msg) => console.warn(fmt('warn',  msg)),
  error: (msg) => console.error(fmt('error', msg)),
  debug: (msg) => console.log(fmt('debug', msg)),
};