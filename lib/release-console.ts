// Release builds print nothing through console.log/info/debug (BEN-29): the app's diagnostic logs
// include ride ids, statuses and route details, and device logs are readable by anyone with the phone
// and a cable (or by crash/log collection tools). Development builds are unchanged.
// console.warn/console.error stay, for real failures; don't put rider details in them.
//
// Imported first in app/_layout.tsx so it runs before any other app module logs.

declare const __DEV__: boolean;

if (typeof __DEV__ !== "undefined" && !__DEV__) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

export {};
