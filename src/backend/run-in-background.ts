const LOG_PREFIX = '[Rental Manager]';

const workers = import('cloudflare:workers').catch(() => null);

/** Lets the webhook respond immediately while the worker finishes the task. */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const settled = Promise.resolve()
    .then(task)
    .catch((error) => console.error(`${LOG_PREFIX} ${label} failed`,
      error instanceof Error ? error.message : 'Unknown error'));
  void workers.then((module) => module?.waitUntil(settled));
}
