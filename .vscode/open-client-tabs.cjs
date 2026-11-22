const http = require("http");
const { spawn } = require("child_process");

const clientUrl = "http://localhost:3000";
const deadline = Date.now() + 60_000;

function isClientReady() {
  return new Promise((resolve) => {
    const request = http.get(clientUrl, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForClient() {
  while (Date.now() < deadline) {
    if (await isClientReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`React client did not start at ${clientUrl} within 60 seconds.`);
}

function openTab() {
  const process = spawn("cmd.exe", ["/c", "start", "", clientUrl], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  process.unref();
}

waitForClient()
  .then(() => {
    openTab();
    openTab();
    openTab();
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
