// Minimal Web Bluetooth typings for TS builds where lib.dom.d.ts doesn't include them.
// We intentionally keep this loose to avoid blocking compilation.

export {};

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice: (options: any) => Promise<any>;
    };
  }
}
