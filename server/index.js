const { server, ensureReady } = require("./app");

module.exports = server;

if (require.main === module) {
  ensureReady()
    .then(() => {
      const port = process.env.PORT || 5000;
      server.listen(port, () => console.log(`Server is running on port ${port}`));
    })
    .catch((error) => {
      console.error("Cannot start game server:", error);
      process.exitCode = 1;
    });
}
