/**
 * Resolution Agent Logging
 */

const PREFIX = "[Resolution]";

export const log = {
  info: (msg: string) => console.log(`${PREFIX} ${msg}`),
  warn: (msg: string) => console.warn(`${PREFIX} ⚠️  ${msg}`),
  error: (msg: string) => console.error(`${PREFIX} ❌ ${msg}`),
  success: (msg: string) => console.log(`${PREFIX} ✅ ${msg}`),
  debug: (msg: string) => {
    if (process.env.DEBUG) console.log(`${PREFIX} 🔍 ${msg}`);
  },
};
