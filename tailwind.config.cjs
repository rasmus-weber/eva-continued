module.exports = {
    presets: [require('@economic/taco/tailwind.config.js')],
    content: {
        files: ['./src/**/*.{ts,tsx}', './node_modules/@economic/taco/dist/taco.js'],
    },
};
