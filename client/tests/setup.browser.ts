import { beforeEach } from 'vitest';

beforeEach(async () => {
  try {
    const root = await navigator.storage.getDirectory();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name] of (root as any).entries()) {
      await root.removeEntry(name, { recursive: true });
    }
  } catch {
    // OPFS not available
  }
});
