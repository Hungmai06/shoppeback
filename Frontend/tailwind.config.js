/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF5A1F",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#FF7A45",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#FFB000",
          foreground: "#1F2937",
        },
        success: {
          DEFAULT: "#22C55E",
          foreground: "#FFFFFF",
        },
        danger: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#1F2937",
        },
        info: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },
        text: {
          DEFAULT: "#1F2937",
          secondary: "#6B7280",
        },
        bg: {
          DEFAULT: "#FFF8F4",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1F2937",
        },
        border: {
          DEFAULT: "#ECECEC",
        }
      },
      borderRadius: {
        'card': '24px',
        'button': '14px',
        'input': '16px',
        'section': '32px',
      },
      boxShadow: {
        'soft': '0 10px 40px rgba(0,0,0,0.06)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
        poppins: ['"Be Vietnam Pro"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
