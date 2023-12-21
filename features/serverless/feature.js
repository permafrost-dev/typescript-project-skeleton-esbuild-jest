const getServerlessPort = name => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const portAddition = (Math.floor(Math.random() * 9) + 1) * 100;
    return 3000 + (hash % 7000) + portAddition;
};

const info = {
    name: 'serverless',
    description: 'Serverless framework',
    prompt: 'Do you want to use the serverless framework?',
};

const packages = {
    /** @type string[] */
    dependencies: [],
    /** @type string[] */
    devDependencies: [ 'serverless', 'serverless-api-compression', 'serverless-prune-plugin', 'serverless-offline', 'serverless-bundle' ],
};

const scripts = {
    'serve:dev': `serverless offline start --httpPort ${getServerlessPort('{{package.name}}')}`,
    deploy: 'serverless deploy',
};

const feature = {
    info,
    packages,
    scripts,
};

module.exports = { feature };
