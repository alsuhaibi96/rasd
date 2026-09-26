export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SIMULATOR !== "off") {
    const { startSimulator } = await import("./lib/simulator");
    startSimulator();
  }
}
