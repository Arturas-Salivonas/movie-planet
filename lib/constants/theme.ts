/**
 * Theme Constants
 *
 * Centralized theme configuration for consistent styling across the application.
 * This includes colors, gradients, and other design tokens.
 */

/**
 * Brand Colors
 * Main colors used throughout the application
 */
export const COLORS = {
  primary: '#01affe',    // Main cyan color
  accent: '#fcd34d',     // Secondary gold/yellow color

  // Background gradient colors
  bg: {
    dark1: '#1b2735',    // Gradient start
    dark2: '#090a0f',    // Gradient end
  },
} as const

/**
 * Background Gradients
 * Reusable gradient definitions
 */
export const GRADIENTS = {
  /**
   * Main space-themed radial gradient background
   * Used across all pages for consistent theming
   */
  spaceBackground: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',

  /**
   * Primary color gradient (cyan)
   * Used for buttons and interactive elements
   */
  primary: 'linear-gradient(to right, #4dd9ff 0%, #01affe 100%)',

  /**
   * Accent color gradient (gold)
   * Used for highlights and special elements
   */
  accent: 'linear-gradient(to right, #fcd34d 0%, #f59e0b 100%)',
} as const

/**
 * CSS Custom Properties
 * Can be used in inline styles
 */
export const CSS_VARS = {
  '--color-primary': COLORS.primary,
  '--color-accent': COLORS.accent,
  '--gradient-space-bg': GRADIENTS.spaceBackground,
} as const

/**
 * Reusable style objects for common patterns
 */
export const STYLES = {
  /**
   * Space background style object
   * Use with style prop: style={STYLES.spaceBackground}
   */
  spaceBackground: {
    background: GRADIENTS.spaceBackground,
  },
} as const

/**
 * Animation timing constants
 */
export const ANIMATIONS = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
} as const

/**
 * Z-index layers
 * Consistent z-index values to prevent stacking issues
 */
export const Z_INDEX = {
  background: -1,
  base: 1,
  dropdown: 10,
  modal: 50,
  popover: 100,
  tooltip: 200,
} as const

/**
 * Breakpoints
 * Match Tailwind's default breakpoints
 */
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const
