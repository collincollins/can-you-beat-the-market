// jest.config.cjs
module.exports = {
    transform: {
        '^.+\\.js$': 'babel-jest', // Transforms JavaScript files using babel-jest
    },
    // Modify transformIgnorePatterns to exclude 'svelte' and 'esm-env' from being ignored
    transformIgnorePatterns: [
        '/node_modules/(?!(svelte|esm-env)/)', // Transforms 'svelte' and 'esm-env' modules
    ],
    testEnvironment: 'node', // Sets the test environment to Node.js
    moduleFileExtensions: ['js', 'json'], // Recognizes .js and .json files
};