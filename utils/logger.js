const fmt = (level, msg) => {
    // ISO format in UTC
    // const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);
    const now = new Date();
    const ts = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 23);
    return `${ts} ${level}: ${msg}`;
};

export default {
    info: (msg) => console.log(fmt('info', msg)),
    warn: (msg) => console.warn(fmt('warn', msg)),
    error: (msg) => console.error(fmt('error', msg)),
    debug: (msg) => console.log(fmt('debug', msg))
};