/**
 * Utility Functions
 */

// =============================================================================
// LOGGING
// =============================================================================

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info: (msg: string) => {
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.blue}ℹ${colors.reset} ${msg}`);
  },
  success: (msg: string) => {
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.green}✓${colors.reset} ${msg}`);
  },
  warn: (msg: string) => {
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.yellow}⚠${colors.reset} ${msg}`);
  },
  error: (msg: string) => {
    console.error(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.red}✗${colors.reset} ${msg}`);
  },
  debug: (msg: string) => {
    if (process.env.DEBUG) {
      console.log(`${colors.dim}[${timestamp()}] [DEBUG]${colors.reset} ${msg}`);
    }
  },
};
