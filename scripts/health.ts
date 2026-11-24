try {
  process.loadEnvFile(".env.local");
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
import("../lib/health")
  .then(({ health }) => health())
  .then((checks) => {
    for (const c of checks)
      console.log(`${c.ok ? "OK" : "MISSING"} ${c.name}: ${c.detail}`);
    process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
  });
