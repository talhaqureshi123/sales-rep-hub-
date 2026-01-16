// App Color Theme
export const appTheme = {
  // Primary Colors (Orange)
  primary: {
    main: '#e9931c',
    light: '#f5a742',
    dark: '#d8820a',
    darker: '#c77108',
  },

  // Background Colors
  background: {
    white: '#ffffff',
    gray: '#f9fafb', // gray-50
    lightGray: '#f3f4f6', // gray-100
  },

  // Text Colors
  text: {
    primary: '#1f2937', // gray-800
    secondary: '#4b5563', // gray-600
    tertiary: '#6b7280', // gray-500
    light: '#9ca3af', // gray-400
    white: '#ffffff',
  },

  // Status Colors
  status: {
    success: {
      main: '#10b981', // green-500
      light: '#d1fae5', // green-100
      dark: '#059669', // green-600
      text: '#065f46', // green-800
    },
    error: {
      main: '#ef4444', // red-500
      light: '#fee2e2', // red-100
      dark: '#dc2626', // red-600
      text: '#991b1b', // red-800
    },
    warning: {
      main: '#f59e0b', // amber-500
      light: '#fef3c7', // amber-100
      dark: '#d97706', // amber-600
      text: '#92400e', // amber-800
    },
    info: {
      main: '#3b82f6', // blue-500
      light: '#dbeafe', // blue-100
      dark: '#2563eb', // blue-600
      text: '#1e40af', // blue-800
    },
  },

  // Border Colors
  border: {
    light: '#e5e7eb', // gray-200
    medium: '#d1d5db', // gray-300
    dark: '#9ca3af', // gray-400
  },

  // Hover Colors
  hover: {
    primary: '#d8820a',
    primaryLight: '#fef3e7', // orange-50
    gray: '#f3f4f6', // gray-100
    red: '#fee2e2', // red-50
  },

  // Shadow Colors
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
}

// Export individual colors for easy access
export const colors = {
  primary: appTheme.primary.main,
  primaryLight: appTheme.primary.light,
  primaryDark: appTheme.primary.dark,
  background: appTheme.background.white,
  textPrimary: appTheme.text.primary,
  textSecondary: appTheme.text.secondary,
  success: appTheme.status.success.main,
  error: appTheme.status.error.main,
  warning: appTheme.status.warning.main,
  info: appTheme.status.info.main,
}

export default appTheme


