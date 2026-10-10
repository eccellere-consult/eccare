/** Runs once when the server starts. The Node-only work lives in instrumentation-node.ts and is
 *  only imported on the Node.js runtime, so it is never bundled for the edge. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
