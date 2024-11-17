import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import jestPlugin from 'eslint-plugin-jest';
import nodePlugin from 'eslint-plugin-node';
import globals from 'globals';
import { Linter } from 'eslint';
import { FlatESLint } from '@typescript-eslint/utils/ts-eslint';

/** @type {Linter.Config} */
const config = [
    {
        files: [
            'src/*.js',
            'src/**/*.js',
            'src/**/*.ts',
            'src/*.ts',
            'tests/**/*.ts',
            'tests/*.ts'
        ],
        ignores: [ 'node_modules', 'dist' ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
                ...globals.es2020,
            },
        },
    },
    {
        plugins: {
            '@typescript-eslint': tsPlugin,
            jest: jestPlugin,
            node: nodePlugin,
        },
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
            'node/no-unpublished-import': 'off',
            'node/no-unpublished-require': 'off',
            'node/no-unsupported-features/es-syntax': 'off',
            'array-bracket-newline': [ 'warn', { multiline: true, minItems: 6 }],
            'array-bracket-spacing': [ 'warn', 'always', { objectsInArrays: false }],
            'array-element-newline': [ 'warn', { multiline: true, minItems: 6 }],
            eqeqeq: [ 'error', 'smart' ],
            indent: [ 'warn', 4, { SwitchCase: 1 }],
            'no-eval': 'error',
            'no-var': 'error',
            'object-curly-newline': [
                'warn',
                {
                    ObjectExpression: { multiline: true, minProperties: 4 },
                    ObjectPattern: { multiline: true, minProperties: 4 },
                    ImportDeclaration: 'never',
                },
            ],
        },
    },
    new FlatESLint(),
    { rules: jestPlugin.configs.recommended.rules },
    // {rules: nodePlugin.configs.recommended.rules},
];

export default config;
