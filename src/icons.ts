// Inline Lucide-style SVG icons. Returned as SVG strings so they can be
// inserted with innerHTML or used in template literals.

const baseProps = (size: number, cls: string) =>
  `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"`;

export type IconOpts = { size?: number; class?: string };

const o = (opts: IconOpts = {}) => ({ size: opts.size ?? 16, cls: opts.class ?? "" });

export const chatIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M7.9 20A9 9 0 1 1 4 16.1L2 22Z"/></svg>`;
};

export const translateIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`;
};

export const toolsIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
};

export const restIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>`;
};

export const activityIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
};

export const settingsIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
};

export const sunIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
};

export const moonIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
};

export const copyIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
};

export const folderIcon = (opts: IconOpts = {}) => {
  const { size, cls } = o(opts);
  return `<svg ${baseProps(size, cls)}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
};
