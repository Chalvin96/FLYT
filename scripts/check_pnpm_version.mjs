const requiredMajor = 12;
const userAgent = process.env.npm_config_user_agent ?? "";
const match = /^pnpm\/(\d+)/.exec(userAgent);
const found = match ? `${match[1]}.x` : "unknown";

if (!match || Number(match[1]) !== requiredMajor) {
  console.error(`Flyt requires pnpm ${requiredMajor}.x; found ${found}.`);
  console.error("Enable Corepack and run the pnpm version declared in package.json.");
  process.exit(1);
}
