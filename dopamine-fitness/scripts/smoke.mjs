const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("Usage: node ./scripts/smoke.mjs <baseUrl>");
  process.exit(1);
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function expectStatus(path, expectedStatuses, init) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, init);
  if (!expectedStatuses.includes(response.status)) {
    const body = await response.text();
    throw new Error(`Expected ${expectedStatuses.join("/")}, got ${response.status}. Body: ${body}`);
  }
  return response;
}

await check("health endpoint", async () => {
  const response = await expectStatus("/health", [200]);
  const json = await response.json();
  if (json.status !== "ok") {
    throw new Error("Health response status is not 'ok'");
  }
});

await check("spa root endpoint", async () => {
  await expectStatus("/", [200]);
});

await check("auth validation endpoint", async () => {
  await expectStatus("/api/auth/login", [400], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("Smoke checks passed.");
