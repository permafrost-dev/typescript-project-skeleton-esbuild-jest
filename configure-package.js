/**
 * configures a package created from the template.
 */
const cp = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');
const util = require('util');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = util.promisify(rl.question).bind(rl);

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

const ANSI_BRIGHT_BLUE = '\x1b[94m';
const ANSI_BRIGHT_GREEN = '\x1b[92m';
const ANSI_BRIGHT_RED = '\x1b[91m';
const ANSI_BRIGHT_WHITE = '\x1b[97m';
const ANSI_BRIGHT_YELLOW = '\x1b[93m';
const ANSI_RESET = '\x1b[0m';

const colorString = (str, color) => color + str + ANSI_RESET;
const blue = str => colorString(str, ANSI_BRIGHT_BLUE);
const green = str => colorString(str, ANSI_BRIGHT_GREEN);
const red = str => colorString(str, ANSI_BRIGHT_RED);
const white = str => colorString(str, ANSI_BRIGHT_WHITE);
const yellow = str => colorString(str, ANSI_BRIGHT_YELLOW);

class Stdout {
    write(text) {
        process.stdout.write(text);
    }
    writeln(text) {
        this.write(text + '\n');
    }
}

const stdout = new Stdout();

const runCommand = str => cp.execSync(str, { cwd: __dirname, encoding: 'utf-8', stdio: 'inherit' });
const gitCommand = command => cp.execSync(`git ${command}`, { env: process.env, cwd: __dirname, encoding: 'utf-8', stdio: 'pipe' }) || '';
const safeUnlink = path => fs.existsSync(path) && fs.unlinkSync(path);
const getWorkflowFilename = name => `${__dirname}/.github/workflows/${name}.yml`;
const getGithubConfigFilename = name => `${__dirname}/.github/${name}.yml`;
const writeFormattedJson = (filename, data) => fs.writeFileSync(filename, JSON.stringify(data, null, 4), { encoding: 'utf-8' });
const isAnswerYes = answer => answer.toLowerCase().trim().startsWith('y');

/**
 * determine if a path is a directory.
 * @param {string} path
 * @returns {boolean} true if the path is a directory, false otherwise
 */
function is_dir(path) {
    try {
        return fs.lstatSync(path).isDirectory();
    } catch (e) {
        return false;
    }
}

/**
 * determine if a path is a file.
 * @param {string} path
 * @returns {boolean} true if the path is a file, false otherwise
 */
function is_file(path) {
    try {
        return fs.lstatSync(path).isFile();
    } catch (e) {
        return false;
    }
}

/**
 * prompt the user to answer a question, returning defaultValue if no answer is given.
 * @param {string} prompt
 * @param {string} defaultValue
 * @returns string
 */
const askQuestion = async (prompt, defaultValue = '') => {
    let result = '';

    try {
        result = await question(`» ${prompt} ${defaultValue.length ? '(' + defaultValue + ') ' : ''}`);
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

/**
 * ask a yes or no question
 * @param {string} str
 * @param {boolean} defaultAnswer
 * @returns {boolean} true or false
 */
const askBooleanQuestion = async (str, defaultAnswer = true) => {
    const suffix = defaultAnswer ? '[Y/n]' : '[y/N]';
    const resultStr = (await askQuestion(`${str} ${suffix} `)).toString().trim();

    if (!resultStr.length) {
        return defaultAnswer;
    }

    return isAnswerYes(resultStr);
};

/**
 * conditionally ask a question based on the value of a property in an object, and update the object's property value.
 * @param {object} obj
 * @param {string} propName
 * @param {boolean} onlyEmpty
 * @param {string} prompt
 * @param {boolean} allowEmpty
 * @param {boolean} alwaysAsk
 * @returns void
 */
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

/**
 * get a github api endpoint and return the response.
 * @param {string} endpoint
 */
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

function getGithubUsernameFromGitRemote() {
    const remoteUrlParts = gitCommand('config remote.origin.url').trim().replace(':', '/').split('/');
    return remoteUrlParts[1];
}

function searchCommitsForGithubUsername() {
    const authorName = gitCommand(`config user.name`).trim().toLowerCase();

    const committers = gitCommand(`log --author='@users.noreply.github.com'  --pretty='%an:%ae' --reverse`)
        .split('\n')
        .map(line => line.trim())
        .map(line => ({ name: line.split(':')[0], email: line.split(':')[1] }))
        .filter(item => !item.name.includes('[bot]'))
        .filter(item => item.name.toLowerCase().localeCompare(authorName.toLowerCase()) === 0);

    if (!committers.length) {
        return '';
    }

    return committers[0].email.split('@')[0];
}

/**
 * try to guess the current user's github username.
 * @returns {string} the github username
 */
function guessGithubUsername() {
    const username = searchCommitsForGithubUsername();

    if (username.length) {
        return username;
    }

    return getGithubUsernameFromGitRemote();
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
        removeDirectory(`${__dirname}/assets`);
        fs.rmdirSync(`${__dirname}/assets`);
    } catch (e) {
        //
    }
}

function removeFeaturesDirectory() {
    try {
        removeDirectory(`${__dirname}/features`);
        fs.rmdirSync(`${__dirname}/features`);
    } catch (e) {
        //
    }
}

/**
 * recursively copy a source directory to a destination directory
 * @param {string} src
 * @param {string} dest
 * @param {string[]} ignores
 */
function copyDirectory(src, dest, ignores = []) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
    }

    const files = fs.readdirSync(src);

    for (const file of files) {
        const filePath = path.join(src, file);
        const destPath = path.join(dest, file);

        if (ignores.includes(filePath) || ignores.includes(file)) {
            continue;
        }

        if (fs.lstatSync(filePath).isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            // Recursively copy directory
            copyDirectory(filePath, destPath, ignores);
        } else {
            fs.copyFileSync(filePath, destPath);
        }
    }
}

/**
 * recursively remove a directory
 * @param {string} src
 * @returns void
 */
function removeDirectory(src) {
    if (!fs.existsSync(src)) {
        return;
    }

    const files = fs.readdirSync(src);

    if (files.length === 0) {
        fs.rmdirSync(src);
        return;
    }

    for (const file of files) {
        const filePath = path.join(src, file);

        if (fs.lstatSync(filePath).isDirectory()) {
            // Recursively remove directories
            removeDirectory(filePath);
        } else {
            fs.unlinkSync(filePath);
        }
    }
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

    if (originalContent !== content) {
        fs.writeFileSync(filename, content, { encoding: 'utf-8' });
    }
};

const processFiles = directory => {
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
            'assets',
            'build-library.js',
            'build.js',
            'configure-package.js',
            'feature.js',
            'node_modules',
            'package-lock.json',
            'prettier.config.js',
            'yarn.lock',
        ].includes(path.basename(f));
    });

    files.forEach(fn => {
        const fqName = `${directory}/${fn}`;
        const relativeName = fqName.replace(__dirname + '/', '');
        const isPath = is_dir(fqName);

        stdout.write(`» processing ${isPath ? 'directory' : 'file'} ./${relativeName}...`);

        if (is_file(fqName)) {
            try {
                replaceVariablesInFile(fqName, packageInfo);
                stdout.write(green(`done`));
            } catch (err) {
                stdout.write(red(`error`));
            } finally {
                stdout.writeln('');
            }
        } else if (isPath) {
            stdout.writeln('');
            processFiles(fqName);
            return;
        } else {
            stdout.writeln('');
        }
    });
};

const populatePackageInfo = async (onlyEmpty = false) => {
    const remoteUrlParts = gitCommand('config remote.origin.url').trim().replace(':', '/').split('/');

    console.log();

    packageInfo.name = path.basename(__dirname);
    packageInfo.author.name = gitCommand('config user.name').trim();
    packageInfo.author.email = gitCommand('config user.email').trim();
    packageInfo.vendor.name = packageInfo.author.name;
    packageInfo.author.github = guessGithubUsername();
    packageInfo.vendor.github = remoteUrlParts[1];

    // check if the guessed vendor is a github org, and if so, use the org name
    const orgResponse = await getGithubApiEndpoint(`orgs/${packageInfo.vendor.github}`);
    if (orgResponse.exists) {
        packageInfo.vendor.name = orgResponse.data.name ?? orgResponse.data.login;
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
    addScript(name, script) {
        this.pkg.scripts[name] = script;
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

    autoformat = {
        name: 'autoformat',
        prompt: 'Automatically lint & format code on push?',
        enabled: true,
        default: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getWorkflowFilename('format-code'));
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
            this.automerge.enabled = false;
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
            let tsConfigContent = fs.readFileSync(`${__dirname}/tsconfig.json`).toString();

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

    useTypedocPackage = {
        name: 'useTypedocPackage',
        prompt: 'Use typedoc to generate api docs?',
        enabled: true,
        default: true,
        dependsOn: [],
        disable: () => {
            runCommand('npm rm typedoc typedoc-plugin-markdown');

            const pkg = new PackageFile();

            pkg.deleteScripts('build:api-docs');
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
        },
    };

    features = [
        this.codecov,
        this.autoformat,
        this.dependabot,
        this.automerge,
        this.codeql,
        this.updateChangelog,
        this.useMadgePackage,
        this.useJestPackage,
        this.useEslintPackage,
        this.useTypedocPackage,
        this.isPackageCommandLineApp,
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
 * load and return features from the features directory.
 * feature directories must contain a feature.js file.
 *
 * @returns {import('./configure-package.d.ts').Feature[]}
 */
function loadFeatures() {
    const src = `${__dirname}/features`;

    if (!fs.existsSync(src)) {
        return [];
    }

    const files = fs.readdirSync(src);
    /** @type import('./configure-package.d.ts').Feature[] */
    const features = [];

    for (const file of files) {
        const filePath = path.join(src, file);

        if (fs.lstatSync(filePath).isDirectory()) {
            const featureScript = `${filePath}/feature.js`;

            if (fs.existsSync(featureScript)) {
                /** @type import('./configure-package.d.ts').Feature */
                const feature = require(featureScript);
                features.push({ ...feature.feature, path: filePath, featureScript });
            }
        }
    }

    return features;
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

            if (!fs.existsSync(path.join(__dirname, 'dist'))) {
                fs.mkdirSync(path.join(__dirname, 'dist', { recursive: true }));
            }

            fs.writeFileSync(`${__dirname}/dist/config.yaml`, '', { encoding: 'utf-8' });

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
                require('dotenv').config({ path: '\${__dirname}/.env' })
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

        const packageList = await askQuestion(this.otherPackages.prompt, this.otherPackages.default);

        if (packageList.length > 0) {
            this.otherPackages.add(packageList.split(',').map(pkg => pkg.trim()));
        }
    }
}

class FeaturePacks {
    /** @type import('./configure-package.d.ts').Feature[] */
    features = [];

    constructor() {
        this.features = loadFeatures();
    }

    /** @param {import('./configure-package.d.ts').Feature} feature */
    addFeature(feature) {
        const pkg = new PackageFile();

        for (const script in feature.scripts) {
            pkg.addScript(script, feature.scripts[script]);
        }

        pkg.save();

        if (Object.values(feature.packages.dependencies).length) {
            runCommand(`npm install ${feature.packages.dependencies.join(' ')}`, { cwd: __dirname, stdio: 'inherit' });
        }

        if (Object.values(feature.packages.devDependencies).length) {
            runCommand(`npm install ${feature.packages.devDependencies.join(' ')} -D`, { cwd: __dirname, stdio: 'inherit' });
        }

        copyDirectory(feature.path, __dirname, [feature.featureScript]);

        stdout.writeln(green('✓') + ` Added feature: ${feature.info.name}`);
    }

    async run() {
        for (const feature of Object.values(this.features)) {
            const result = await askBooleanQuestion(feature.info.prompt, false);
            if (result) {
                this.addFeature(feature);
            }
        }
    }
}

async function configureOptionalFeatures() {
    await new Features().run();
}

const lintAndFormatSourceFiles = () => {
    cp.execSync('node ./node_modules/.bin/prettier --write src', { cwd: __dirname, stdio: 'inherit' });
    cp.execSync('node ./node_modules/.bin/eslint --fix src', { cwd: __dirname, stdio: 'inherit' });
};

const run = async function () {
    await populatePackageInfo();
    await configureOptionalFeatures();

    stdout.writeln('');
    const confirm = (await askQuestion(yellow('Process files') + ' (this will modify files) [y/N]? ')).toString();

    if (!isAnswerYes(confirm)) {
        stdout.writeln('» ' + yellow('Not processing files: action canceled.  Exiting.'));
        rl.close();
        return;
    }

    try {
        processFiles(__dirname);
        runCommand('npm install');
    } catch (err) {
        console.log('Error: ', err);
    }

    try {
        await new FeaturePacks().run();
        await new OptionalPackages().run();
    } catch (err) {
        console.log('Error: ', err);
    }

    try {
        lintAndFormatSourceFiles();
    } catch (err) {
        console.log('Error: ', err);
    }

    try {
        removeTemplateReadmeText();
        removeAssetsDirectory();
        removeFeaturesDirectory();
    } catch (e) {
        console.log('Error: ', e);
    }

    try {
        stdout.write('» ' + yellow('Removing this script...'));
        fs.unlinkSync(__filename);
        fs.unlinkSync('./configure-package.d.ts');
        stdout.writeln('done.');
    } catch (err) {
        console.log('Error removing script: ', err);
    }

    try {
        runCommand('git add .');
        runCommand('git commit -m"commit configured package files"');
    } catch (err) {
        console.log('Error committing files: ', err);
    }

    stdout.writeln(green('✓') + ' Done.');

    rl.close();
};

run();
