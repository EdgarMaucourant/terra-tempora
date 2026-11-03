// The site's version, x.y.z, read from package.json when the site is built,
// and the commit it was built from. x moves for big milestones (a redesign),
// y for new features and content, z for bug fixes. docs/development.md says
// how to release one; src/changelog.json lists what each version brought.

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const VERSION: string = __APP_VERSION__;
export const COMMIT: string = __APP_COMMIT__;

/** The three numbers of "x.y.z"; anything unreadable counts as 0.0.0. */
export function parts(version: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/** Below 0 when a is older than b, 0 when equal, above 0 when newer. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** A bug-fix release: only z moved (1.2.3), so What's new leaves it out. */
export function isFixOnly(version: string): boolean {
  return parts(version)[2] !== 0;
}
