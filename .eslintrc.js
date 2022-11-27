/** @type {import('eslint').Linter.Config } */
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    env: {
        browser: false,
        commonjs: true,
        jest: true,
        node: true,
    },
    settings: {},
    overrides: [
        { files: '*.d.ts', rules: { strict: [ 'error', 'never' ] } },
        {
            files: [ '.eslintrc.js', 'jest.config.js' ],
            rules: {
                'sort-keys': 'off',
                'array-element-newline': [ 'warn', { multiline: true, minItems: 4 }],
            },
        },
    ],
    plugins: [ 'jest' ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended',
        'plugin:node/recommended'
    ],
    rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-empty-interface': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'jest/no-disabled-tests': 'warn',
        'jest/no-identical-title': 'error',
        'newline-per-chained-call': [ 'warn', { ignoreChainWithDepth: 2 }],
        'node/no-missing-import': 'off',
        'node/no-missing-require': 'off',
        'node/no-process-exit': 'off',
        'node/no-unpublished-require': 'off',
        'node/no-unsupported-features/es-syntax': 'off',
        'array-bracket-newline': [ 'warn', { multiline: true, minItems: 4 }],
        'array-bracket-spacing': [ 'warn', 'always', { objectsInArrays: false }],
        'array-element-newline': [ 'warn', { multiline: true, minItems: 3 }],
        'eqeqeq': [ 'error', 'smart' ],
        'indent': [ 'warn', 4, { SwitchCase: 1 }],
        'no-eval': 'error',
        'no-var': 'error',
        'object-curly-newline': [ 'warn', { ObjectExpression: { multiline: true, minProperties: 4 }, ObjectPattern: { multiline: true, minProperties: 4 }, ImportDeclaration: 'never' },],
        'sort-imports': [
            'warn',
            {
                memberSyntaxSortOrder: [
                    'multiple',
                    'single',
                    'none',
                    'all'
                ],
            },
        ],
        'sort-keys': [ 'warn', 'asc', { caseSensitive: false, minKeys: 2, natural: true }],
    },
    ignorePatterns: [ 'dist/*', 'configure-package.js' ],
};
