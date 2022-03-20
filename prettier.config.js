/** @type {import('prettier').Config} */
const overrides = [
    {
        files: ['*.yml', '*.yaml'],
        options: {
            tabWidth: 2,
        },
    },
    {
        files: '.madgerc',
        options: {
            parser: 'json',
        },
    },
];

/** @type {import('prettier').RequiredOptions} */
module.exports = {
    arrowParens: 'avoid',
    bracketSameLine: true,
    bracketSpacing: true,
    htmlWhitespaceSensitivity: 'css',
    insertPragma: false,
    jsxSingleQuote: false,
    overrides,
    printWidth: 155,
    proseWrap: 'preserve',
    quoteProps: 'as-needed',
    requirePragma: false,
    semi: true,
    singleQuote: true,
    tabWidth: 4,
    trailingComma: 'all',
    useTabs: false,
};
