const config = {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}",
  ],

  theme: {
    extend: {
      colors: {
        'device-color1': '#9a2257',
      },
    },
  },

  plugins: [
    require('flowbite/plugin')
  ],

  darkMode: 'class',
};

module.exports = config;
