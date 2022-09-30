/**
 * configures a package created from the template.
 */

const { basename } = require('path');
const cp = require('child_process');
const fs = require('fs');
const https = require('https');
const readline = require('readline');
const util = require('util');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = util.promisify(rl.question).bind(rl);

const basePath = __dirname;

const packageInfo = {
    name: '',
    description: '',
    vendor: {
        github: '',
        name: '',
    },
    author: {
        email: '',
        github: '',
        name: '',
    },
};

const runCommand = str => {
    cp.execSync(str, { cwd: __dirname, encoding: 'utf-8', stdio: 'inherit' });
};

const gitCommand = command => {
    return cp.execSync(`git ${command}`, { env: process.env, cwd: __dirname, encoding: 'utf-8', stdio: 'pipe' }) || '';
};

const installDependencies = () => {
    cp.execSync('npm install', { cwd: __dirname, encoding: 'utf-8', stdio: 'inherit' });
};

const askQuestion = async (prompt, defaultValue = '') => {
    let result = '';

    try {
        result = await question(`${prompt} ${defaultValue.length ? '(' + defaultValue + ') ' : ''}`);
    } catch (err) {
        result = false;
    }

    return new Promise(resolve => {
        if (!result || result.trim().length === 0) {
            result = defaultValue;
        }

        resolve(result);
    });
};

async function getGithubApiEndpoint(endpoint) {
    const url = `https://api.github.com/${endpoint}`.replace('//', '/');

    const requestJson = async url => {
        const options = {
            headers: {
                'User-Agent': 'permafrost-dev-template-configure/1.0',
                Accept: 'application/json, */*',
            },
        };

        return new Promise((resolve, reject) => {
            const req = https.get(url, options);

            req.on('response', async res => {
                let body = '';
                res.setEncoding('utf-8');

                for await (const chunk of res) {
                    body += chunk;
                }

                resolve(JSON.parse(body));
            });

            req.on('error', err => {
                throw new err();
                reject(err);
            });
        });
    };

    const response = {
        exists: true,
        data: {},
    };

    try {
        response.data = await requestJson(url);
        response.exists = true;
    } catch (e) {
        response.exists = false;
        response.data = {};
    }

    if (response.exists && response.data['message'] === 'Not Found') {
        response.exists = false;
        response.data = {};
    }

    return response;
}

function rescue(func, defaultValue = null) {
    try {
        return func();
    } catch (e) {
        return defaultValue;
    }
}

function is_dir(path) {
    try {
        const stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}

function is_file(path) {
    return rescue(() => fs.lstatSync(path).isFile(), false);
}

const replaceVariablesInFile = (filename, packageInfo) => {
    let content = fs.readFileSync(filename, { encoding: 'utf-8' }).toString();
    const originalContent = content.slice();

    content = content
        .replace(/package-skeleton/g, packageInfo.name)
        .replace(/\{\{vendor\.name\}\}/g, packageInfo.vendor.name)
        .replace(/\{\{vendor\.github\}\}/g, packageInfo.vendor.github)
        .replace(/\{\{package\.name\}\}/g, packageInfo.name)
        .replace(/\{\{package\.description\}\}/g, packageInfo.description)
        .replace(/\{\{package\.author\.name\}\}/g, packageInfo.author.name)
        .replace(/\{\{package\.author\.email\}\}/g, packageInfo.author.email)
        .replace(/\{\{package\.author\.github\}\}/g, packageInfo.author.github)
        .replace(/\{\{date\.year\}\}/g, new Date().getFullYear())
        .replace('Template Setup: run `node configure-package.js` to configure.\n', '');

    if (originalContent != content) {
        fs.writeFileSync(filename, content, { encoding: 'utf-8' });
    }
};

const processFiles = (directory, packageInfo) => {
    const files = fs.readdirSync(directory).filter(f => {
        return ![
            '.',
            '..',
            '.editorconfig',
            '.eslintignore',
            '.eslintrc.js',
            '.git',
            '.gitattributes',
            '.gitignore',
            '.prettierignore',
            '.prettierrc',
            'build-library.js',
            'build.js',
            'configure-package.js',
            'node_modules',
            'package-lock.json',
            'prettier.config.js',
            'yarn.lock',
        ].includes(basename(f));
    });

    files.forEach(fn => {
        const fqName = `${directory}/${fn}`;
        const relativeName = fqName.replace(basePath + '/', '');
        const isPath = is_dir(fqName);
        const kind = isPath ? 'directory' : 'file';

        console.log(`processing ${kind} ./${relativeName}`);

        if (isPath) {
            processFiles(fqName, packageInfo);
            return;
        }

        if (is_file(fqName)) {
            try {
                replaceVariablesInFile(fqName, packageInfo);
            } catch (err) {
                console.log(`error processing file ${relativeName}`);
            }
        }
    });
};

const conditionalAsk = async (obj, propName, onlyEmpty, prompt, allowEmpty = false, alwaysAsk = true) => {
    const value = obj[propName];

    if (!onlyEmpty || !value.length || alwaysAsk) {
        while (obj[propName].length === 0 || alwaysAsk) {
            obj[propName] = await askQuestion(prompt, value);

            if (allowEmpty && obj[propName].length === 0) {
                break;
            }

            if (obj[propName].length > 0) {
                break;
            }
        }
    }

    return new Promise(resolve => resolve());
};

const populatePackageInfo = async (onlyEmpty = false) => {
    const remoteUrlParts = gitCommand('config remote.origin.url').trim().replace(':', '/').split('/');

    console.log();

    packageInfo.name = basename(__dirname);
    packageInfo.author.name = gitCommand('config user.name').trim();
    packageInfo.author.email = gitCommand('config user.email').trim();
    packageInfo.vendor.name = packageInfo.author.name;
    packageInfo.author.github = remoteUrlParts[1];
    packageInfo.vendor.github = remoteUrlParts[1];

    const orgResponse = await getGithubApiEndpoint(`orgs/${packageInfo.vendor.github}`);

    if (orgResponse.exists) {
        packageInfo.vendor.name = orgResponse.data.name;
    }

    await conditionalAsk(packageInfo, 'name', onlyEmpty, 'package name?', false);
    await conditionalAsk(packageInfo, 'description', onlyEmpty, 'package description?');
    await conditionalAsk(packageInfo.author, 'name', onlyEmpty, 'author name?');
    await conditionalAsk(packageInfo.author, 'email', onlyEmpty, 'author email?');
    await conditionalAsk(packageInfo.author, 'github', onlyEmpty, 'author github username?');
    await conditionalAsk(packageInfo.vendor, 'name', onlyEmpty, 'vendor name (default is author name)?', true);
    await conditionalAsk(packageInfo.vendor, 'github', onlyEmpty, 'vendor github org/user name (default is author github)?', true);

    if (packageInfo.vendor.name.length === 0) {
        packageInfo.vendor.name = packageInfo.author.name;
    }

    if (packageInfo.vendor.github.length === 0) {
        packageInfo.vendor.github = packageInfo.author.github;
    }
};

const safeUnlink = path => fs.existsSync(path) && fs.unlinkSync(path);
const getWorkflowFilename = name => `${__dirname}/.github/workflows/${name}.yml`;
const getGithubConfigFilename = name => `${__dirname}/.github/${name}.yml`;
const writeFormattedJson = (filename, data) => fs.writeFileSync(filename, JSON.stringify(data, null, 4), { encoding: 'utf-8' });

class PackageFile {
    pkg = {};

    constructor() {
        this.pkg = {};
        this.load();
    }
    load() {
        this.pkg = require(`${__dirname}/package.json`);
        return this;
    }
    save() {
        writeFormattedJson(`${__dirname}/package.json`, this.pkg);
        return this;
    }
    replaceScript(name, script) {
        this.pkg.scripts[name] = script;
        return this;
    }
    deleteScripts(...names) {
        for (const name of names) {
            if (typeof this.pkg.scripts[name] !== 'undefined') {
                delete this.pkg.scripts[name];
            }
        }
        return this;
    }
    delete(...keys) {
        for (const key of keys) {
            if (typeof this.pkg[key] !== 'undefined') {
                delete this.pkg[key];
            }
        }
        return this;
    }
}

class Features {
    codecov = {
        name: 'codecov',
        prompt: 'Use code coverage service codecov?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            const testsWorkflowFn = getWorkflowFilename('run-tests');
            const contents = fs.readFileSync(testsWorkflowFn, { encoding: 'utf-8' });

            fs.writeFileSync(testsWorkflowFn, contents.replace('USE_CODECOV_SERVICE: yes', 'USE_CODECOV_SERVICE: no'), {
                encoding: 'utf-8',
            });
            safeUnlink(getGithubConfigFilename('codecov'));
        },
    };

    dependabot = {
        name: 'dependabot',
        prompt: 'Use Dependabot?',
        enabled: true,
        default: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getGithubConfigFilename('dependabot'));
            this.automerge.disable();
        },
    };

    automerge = {
        name: 'automerge',
        prompt: 'Automerge Dependabot PRs?',
        enabled: true,
        default: true,
        dependsOn: ['dependabot'],
        disable: () => {
            safeUnlink(getWorkflowFilename('dependabot-auto-merge'));
        },
    };

    codeql = {
        name: 'codeql',
        prompt: 'Use CodeQL Quality Analysis?',
        enabled: true,
        default: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getWorkflowFilename('codeql-analysis'));
        },
    };

    updateChangelog = {
        name: 'updateChangelog',
        prompt: 'Use Changelog Updater Workflow?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getWorkflowFilename('update-changelog'));
        },
    };

    useMadgePackage = {
        name: 'useMadgePackage',
        prompt: 'Use madge package for code analysis?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            runCommand('npm rm madge');
            safeUnlink(`${__dirname}/.madgerc`);

            const pkg = new PackageFile();
            pkg.deleteScripts('analyze:deps:circular', 'analyze:deps:list', 'analyze:deps:graph').save();
        },
    };

    useJestPackage = {
        name: 'useJestPackage',
        prompt: 'Use jest for js/ts unit testing?',
        enabled: true,
        default: true,
        dependsOn: [],
        disable: () => {
            runCommand('npm rm jest @types/jest ts-jest');
            safeUnlink(`${__dirname}/jest.config.js`);

            const pkg = new PackageFile();
            pkg.deleteScripts('test:coverage').replaceScript('test', 'echo "no tests defined" && exit 0').save();

            // remove tsconfig jest types reference
            let tsConfigContent = fs.readFileSync('${__dirname}/tsconfig.json').toString();

            tsConfigContent = tsConfigContent.replace(/"jest",?\s*/, '');
            fs.writeFileSync(`${__dirname}/tsconfig.json`, tsConfigContent, { encoding: 'utf-8' });
        },
    };

    useEslintPackage = {
        name: 'useEslintPackage',
        prompt: 'Use ESLint for js/ts code linting?',
        enabled: true,
        default: true,
        dependsOn: [],
        disable: () => {
            runCommand('npm rm eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser');
            safeUnlink(`${__dirname}/.eslintrc.js`);

            const pkg = new PackageFile();

            pkg.deleteScripts('lint', 'lint:fix').replaceScript('fix', pkg.pkg.scripts['fix'].replace('&& npm run lint:fix', ''));

            for (const key of Object.keys(pkg.pkg['lint-staged'])) {
                pkg.pkg['lint-staged'][key] = pkg.pkg['lint-staged'].filter(cmd => !cmd.includes('eslint'));
            }

            pkg.save();
        },
    };

    isPackageCommandLineApp = {
        name: 'isPackageCommandLineApp',
        prompt: 'Is this package a command line application?',
        enabled: true,
        default: false,
        dependsOn: [],
        disable: () => {
            const pkg = new PackageFile();

            pkg.delete('bin').save();

            this.useCommanderPackage.disable();
        },
    };

    useCommanderPackage = {
        name: 'useCommanderPackage',
        prompt: 'Use the commander package for creating CLI apps?',
        enabled: true,
        default: true,
        dependsOn: ['isPackageCommandLineApp'],
        disable: () => {
            //
        },
    };

    features = [
        this.codecov,
        this.dependabot,
        this.automerge,
        this.codeql,
        this.updateChangelog,
        this.useMadgePackage,
        this.useJestPackage,
        this.useEslintPackage,
        this.isPackageCommandLineApp,
        // this.useCommanderPackage,
    ];

    async run() {
        const state = {};

        for (let feature of this.features) {
            if (feature.dependsOn.length > 0) {
                const dependencies = feature.dependsOn.map(dep => state[dep]);

                feature.enabled = dependencies.every(dep => dep);
            }

            if (feature.enabled) {
                feature.enabled = await askBooleanQuestion(feature.prompt, feature.default);
            }

            state[feature.name] = feature.enabled;

            if (!feature.enabled) {
                feature.disable();
            }
        }
    }
}

/**
 * Removes the template README text from the README.md file
 */
function removeTemplateReadmeText() {
    const END_BLOCK_STR = '<!-- ==END TEMPLATE README== -->';
    const START_BLOCK_STR = '<!-- ==START TEMPLATE README== -->';

    const content = fs.readFileSync(`${__dirname}/README.md`).toString();

    if (content.includes(START_BLOCK_STR) && content.includes(END_BLOCK_STR)) {
        const startBlockPos = content.indexOf(START_BLOCK_STR);
        const endBlockPos = content.lastIndexOf(END_BLOCK_STR);

        const newContent = content.replace(content.substring(startBlockPos, endBlockPos + END_BLOCK_STR.length), '');

        if (newContent.length) {
            fs.writeFileSync('./README.md', newContent);
        }
    }
}

function removeAssetsDirectory() {
    try {
        for (const fn of fs.readdirSync(`${__dirname}/assets`)) {
            fs.unlinkSync(`${__dirname}/assets/${fn}`);
        }

        fs.rmdirSync(`${__dirname}/assets`);
    } catch (e) {
        //
    }
}

class OptionalPackages {
    config = {
        prompt: 'Use a yaml config file?',
        enabled: true,
        default: false,
        dependsOn: [],
        name: 'conf',
        add: () => {
            cp.execSync('npm install conf js-yaml', { cwd: __dirname, stdio: 'inherit' });
            fs.writeFileSync(`${__dirname}/config.yaml`, '', { encoding: 'utf-8' });

            fs.writeFileSync(
                `${__dirname}/src/config.ts`,
                `
                import Conf from 'conf';
                import yaml from 'js-yaml';

                const ConfBaseConfig = {
                    cwd: __dirname,
                    deserialize: (text: string) => yaml.load(text),
                    serialize: value => yaml.dump(value, { indent: 2 }),
                    fileExtension: 'yml',
                };

                export function createConf(name: string, options: Record<string, any> = {}): Conf {
                    return new Conf(<any>{
                        configName: name,
                        ...Object.assign({}, ConfBaseConfig, options),
                    });
                }
            `.trim(),
                { encoding: 'utf-8' },
            );
        },
    };

    dotenv = {
        prompt: 'Use a .env file?',
        enabled: true,
        default: false,
        dependsOn: [],
        name: 'dotenv',
        add: () => {
            runCommand('npm', ['install', 'dotenv'], { cwd: __dirname, stdio: 'inherit' });

            fs.mkdirSync(`${__dirname}/dist`, { recursive: true });
            fs.writeFileSync(`${__dirname}/dist/.env`, 'TEST_VALUE=1\n', { encoding: 'utf-8' });
            fs.writeFileSync(
                `${__dirname}/src/init.ts`,
                `
                require('dotenv').config({ path: \`\${__dirname}/.env' })
            `.trim(),
                { encoding: 'utf-8' },
            );
        },
    };

    otherPackages = {
        prompt: 'Comma-separated list of packages to install:',
        enabled: true,
        default: '',
        dependsOn: [],
        name: 'otherPackages',
        add: values => {
            cp.execSync('npm install ' + values.join(' '), { cwd: __dirname, stdio: 'inherit' });
        },
    };

    optionalPackages = [this.config, this.dotenv];

    async run() {
        for (let pkg of this.optionalPackages) {
            const result = await askBooleanQuestion(pkg.prompt, pkg.default);
            if (result) {
                pkg.add();
            }
        }

        const packageList = await askQuestion(this.otherPackages, this.otherPackages.default);

        if (packageList.length > 0) {
            this.otherPackages.add(packageList.split(',').map(pkg => pkg.trim()));
        }

        cp.execSync('node ./node_modules/.bin/prettier --write ./src', { cwd: __dirname, stdio: 'inherit' });
        cp.execSync('node ./node_modules/.bin/eslint --fix ./src', { cwd: __dirname, stdio: 'inherit' });
    }
}

async function configureOptionalFeatures() {
    await new Features().run();
}

const askBooleanQuestion = async str => {
    const resultStr = await askQuestion(`${str} `);
    const result = resultStr.toString().toLowerCase().replace(/ /g, '').replace(/[^yn]/g, '').slice(0, 1);

    return result === 'y';
};

const run = async function () {
    await populatePackageInfo();
    await configureOptionalFeatures();

    const confirm = (await askQuestion('Process files (this will modify files)? '))
        .toString()
        .toLowerCase()
        .replace(/ /g, '')
        .replace(/[^yn]/g, '')
        .slice(0, 1);

    if (confirm !== 'y') {
        console.log('Not processing files: action canceled.  Exiting.');
        rl.close();
        return;
    }

    try {
        removeTemplateReadmeText();
        removeAssetsDirectory();
        processFiles(__dirname, packageInfo);
        installDependencies();
        await new OptionalPackages().run();
    } catch (err) {
        //
    }

    rl.close();

    console.log('Done, removing this script.');
    fs.unlinkSync(__filename);

    runCommand('git add .');
    runCommand('git commit -m"commit configured package files"');
};

run();
