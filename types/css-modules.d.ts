/**
 * CSS Modules produce a default-exported class-name map.
 * Vite handles the transform; this only teaches TypeScript the shape.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module '*.css' {
  const css: string;
  export default css;
}
