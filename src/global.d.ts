// Allow importing SCSS/CSS files as modules in TypeScript
// This provides a minimal declaration so `import './index.scss'` (side-effect) works
// and imports like `import styles from './index.module.scss'` are typed as any.

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
