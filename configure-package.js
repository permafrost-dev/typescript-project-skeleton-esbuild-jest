// @ts-nocheck
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * configures a package created from the template.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const util = require('util');
const cp = require('child_process');
const { basename } = require('path');

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
        name: '',
        github: '',
    },
    author: {
        name: '',
        email: '',
        github: '',
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

function is_symlink(path) {
    return rescue(() => fs.lstatSync(path).isSymbolicLink(), false);
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
            '.git',
            '.github',
            '.editorconfig',
            '.gitattributes',
            '.gitignore',
            '.prettierignore',
            '.prettierrc',
            'package-lock.json',
            'node_modules',
            'configure-package.js',
        ].includes(path.basename(f));
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
    const remoteUrlParts = gitCommand('config remote.origin.url').trim()
        .replace(':', '/')
        .split('/');

    console.log();

    packageInfo.name = basename(__dirname);
    packageInfo.author.name = gitCommand('config user.name').trim();
    packageInfo.author.email = gitCommand('config user.email').trim();
    packageInfo.vendor.name = packageInfo.author.name;
    packageInfo.author.github = remoteUrlParts[1];
    packageInfo.vendor.github = remoteUrlParts[1];

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

class Features {
    codecov = {
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
        prompt: 'Use Dependabot?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getGithubConfigFilename('dependabot'));
            this.automerge.disable();
        },
    };

    automerge = {
        prompt: 'Automerge Dependabot PRs?',
        enabled: true,
        dependsOn: ['dependabot'],
        disable: () => {
            safeUnlink(getWorkflowFilename('dependabot-auto-merge'));
        },
    };

    codeql = {
        prompt: 'Use CodeQL Quality Analysis?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getWorkflowFilename('codeql-analysis'));
        },
    };

    updateChangelog = {
        prompt: 'Use Changelog Updater Workflow?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            safeUnlink(getWorkflowFilename('update-changelog'));
        },
    };

    useMadgePackage = {
        prompt: 'Use madge package for code analysis?',
        enabled: true,
        dependsOn: [],
        disable: () => {
            runCommand('npm rm madge');
            safeUnlink(`${__dirname}/.madgerc`);

            const pkg = require(`${__dirname}/package.json`);

            delete pkg.scripts['analyze:deps:circular'];
            delete pkg.scripts['analyze:deps:list'];
            delete pkg.scripts['analyze:deps:graph'];

            fs.writeFileSync(`${__dirname}/package.json`, JSON.stringify(pkg, null, 4), { encoding: 'utf-8' });
        },
    };

    features = [this.codecov, this.dependabot, this.automerge, this.codeql, this.updateChangelog, this.useMadgePackage];

    async run() {
        for (let feature of this.features) {
            if (feature.enabled) {
                feature.enabled = await askBooleanQuestion(feature.prompt, feature.default);
            }

            if (!feature.enabled) {
                feature.disable();
            }
        }
    }
}

function dedent(templ, ...values) {
    let strings = Array.from(typeof templ === 'string' ? [templ] : templ);
    strings[strings.length - 1] = strings[strings.length - 1].replace(/\r?\n([\t ]*)$/, '');
    const indentLengths = strings.reduce((arr, str) => {
        const matches = str.match(/\n([\t ]+|(?!\s).)/g);
        if (matches) {
            return arr.concat(
                matches.map(match => {
                    var _a;
                    return ((_a = match.match(/[\t ]/g)) == null ? void 0 : _a.length) ?? 0;
                }),
            );
        }
        return arr;
    }, []);
    if (indentLengths.length) {
        const pattern = new RegExp(`[	 ]{${Math.min(...indentLengths)}}`, 'g');
        strings = strings.map(str => str.replace(pattern, '\n'));
    }
    strings[0] = strings[0].replace(/^\r?\n/, '');
    let string = strings[0];
    values.forEach((value, i) => {
        const endentations = string.match(/(?:^|\n)( *)$/);
        const endentation = endentations ? endentations[1] : '';
        let indentedValue = value;
        if (typeof value === 'string' && value.includes('\n')) {
            indentedValue = String(value)
                .split('\n')
                .map((str, i2) => (i2 === 0 ? str : `${endentation}${str}`))
                .join('\n');
        }
        string += indentedValue + strings[i + 1];
    });
    return string;
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
    const result = resultStr.toString().toLowerCase()
        .replace(/ /g, '')
        .replace(/[^yn]/g, '')
        .slice(0, 1);

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
