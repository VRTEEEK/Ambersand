// Shared theme configuration to ensure consistent colors across website and reports
export const theme = {
  primary: {
    500: 'hsl(174, 36%, 45%)', // Main teal color from website
    600: 'hsl(174, 43%, 35%)', // Darker teal shade
  },
  accent: {
    lightBg: 'hsl(180, 52%, 96%)', // Light teal background
    100: 'hsl(180, 44%, 91%)',    // Light teal variant
  },
  neutral: {
    50: 'hsl(220, 13%, 91%)',
    100: 'hsl(220, 14%, 96%)',
    500: 'hsl(220, 8%, 46%)',
    900: 'hsl(225, 9%, 9%)',
  }
};

// Helper function to convert HSL to HSLA with alpha
export const hsla = (hslColor: string, alpha: number): string => {
  return hslColor.replace('hsl(', `hsla(`).replace(')', `, ${alpha})`);
};