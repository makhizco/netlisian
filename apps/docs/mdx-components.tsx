import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs' // nextra-theme-docs/style

const themeComponents = getThemeComponents()

export function useMDXComponents(components: any) {
  return {
    ...themeComponents,
    ...components
  }
}
