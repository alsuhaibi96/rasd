export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Scenario runs live in memory; any run that was active before this boot can never resume.
    const { markInterrupted } = await import("./lib/scenario/runner");
    await markInterrupted();
    if (process.env.SIMULATOR !== "off") {
      const { startSimulator } = await import("./lib/simulator");
      startSimulator();
    }
  }
}
