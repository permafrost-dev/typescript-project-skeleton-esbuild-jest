module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    env: {
        node: true,
        browser: false,
        commonjs: true,
    },
    settings: {},
    plugins: [
        'jest',
    ],
    extends: [
        'plugin:jest/recommended',
        'plugin:@typescript-eslint/recommended',
        'eslint:recommended',
    ],
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'jest/no-disabled-tests': 'warn',
        'jest/no-identical-title': 'error',
        'newline-per-chained-call': ['error', { ignoreChainWithDepth: 2 }],
        'indent': ['error', 4, { SwitchCase: 1 }],
    },
};
