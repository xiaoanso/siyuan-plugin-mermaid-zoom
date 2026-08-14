// SCSS/CSS module declarations for TypeScript
// Placed in src/types/ to keep type declarations organized.

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
