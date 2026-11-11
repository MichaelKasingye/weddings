/** Tailwind config for the wedding invitation. Rebuild: see README. */
module.exports = {
  content: ['./index.html', './js/*.js'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#07152F', 700: '#10234B' },
        cream: '#FFF1D6', ivory: '#F8F8F4', gold: '#D4AF37', rose: '#F5D6C6',
        burgundy: '#650D24', wine: '#8B152B',
      },
      fontFamily: {
        script: ['"Great Vibes"', '"Brush Script MT"', 'cursive'],
        serif: ['"Cormorant Garamond"', 'Garamond', '"Times New Roman"', 'serif'],
        sans: ['Montserrat', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
