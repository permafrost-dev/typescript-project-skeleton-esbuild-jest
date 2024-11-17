import { pathsToModuleNameMapper } from 'ts-jest';

const tsConfigPaths = {
    '@/*': [ 'src/*' ],
    '@tests/*': [ 'tests/*' ],
};

const currentDir = new URL('.', import.meta.url).pathname;

/** @type {import('@jest/types').Config.InitialOptions } */
export default {
    preset: 'ts-jest/presets/js-with-ts',
    testEnvironment: 'node',
    transform: { '^.+\\.tsx?$': 'ts-jest' },
    testRegex: '(/__test__/.*|/tests/.*|(\\.|/)(test|spec))\\.[tj]sx?$',
    testPathIgnorePatterns: [ '/node_modules/', '/dist/' ],
    moduleFileExtensions: [ 'ts', 'tsx', 'js', 'jsx', 'json' ],
    moduleNameMapper: pathsToModuleNameMapper(tsConfigPaths, { prefix: currentDir + '/' }),

    coverageDirectory: './coverage',
    coverageReporters: [ 'html', 'text' ],
    collectCoverageFrom: [ 'src/**/*.{ts,js}', '!**/node_modules/**', '!**/vendor/**', '!**/dist/**', '!**/tests/**' ],
};
