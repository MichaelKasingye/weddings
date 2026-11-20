/** Tailwind config: the invitation poster (src/styles/poster.css) and the admin dashboard. */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#050E22', 900: '#07152F', 800: '#0B1B45', 700: '#10234B', 600: '#142C66' },
        cream: '#FFF1D6', ivory: '#F8F8F4', gold: { DEFAULT: '#D4AF37', light: '#F3D98B', deep: '#9C7A1E' },
        rose: '#F5D6C6', burgundy: '#650D24', wine: '#8B152B',
      },
      fontFamily: {
        script: ['"Great Vibes"', '"Brush Script MT"', 'cursive'],
        serif: ['"Cormorant Garamond"', 'Garamond', '"Times New Roman"', 'serif'],
        sans: ['Poppins', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        couple: ['Playball', '"Great Vibes"', 'cursive'],
      },
    },
  },
  plugins: [],
};
