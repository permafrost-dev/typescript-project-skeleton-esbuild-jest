/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * configures a package created from the template.
 */

const fs = require('fs');
const path = require('path');
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
    author: {
        name: '',
        email: '',
        github: '',
    },
};

const askQuestion = async prompt => {
    let result = '';

    try {
        result = await question(`${prompt} `);
    } catch (err) {
        result = false;
    }

    return new Promise(resolve => {
        resolve(result);
    });
};

function is_dir(path) {
    try {
        const stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}

const replaceVariablesInFile = (filename, packageInfo) => {
    let content = fs.readFileSync(filename, { encoding: 'utf-8' }).toString();
    const originalContent = content.slice();

    content = content
        .replace(/package-skeleton/g, packageInfo.name)
        .replace(/\{\{package\.name\}\}/g, packageInfo.name)
        .replace(/\{\{package\.description\}\}/g, packageInfo.description)
        .replace(/\{\{package\.author\.name\}\}/g, packageInfo.author.name)
        .replace(/\{\{package\.author\.email\}\}/g, packageInfo.author.email)
        .replace(/\{\{package\.author\.github\}\}/g, packageInfo.author.github)
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

        replaceVariablesInFile(fqName, packageInfo);
    });
};

const conditionalAsk = async (obj, propName, onlyEmpty, prompt) => {
    const value = obj[propName];

    if (!onlyEmpty || !value.length) {
        while (obj[propName].length === 0) {
            obj[propName] = await askQuestion(prompt);
        }
    }

    return new Promise(resolve => resolve());
};

const populatePackageInfo = async (onlyEmpty = false) => {
    await conditionalAsk(packageInfo, 'name', onlyEmpty, 'package name?');
    await conditionalAsk(packageInfo, 'description', onlyEmpty, 'package description?');
    await conditionalAsk(packageInfo.author, 'name', onlyEmpty, 'author name?');
    await conditionalAsk(packageInfo.author, 'email', onlyEmpty, 'author email?');
    await conditionalAsk(packageInfo.author, 'github', onlyEmpty, 'author github username?');
};

const run = async function () {
    await populatePackageInfo();

    const confirm = (await askQuestion('Process files (this will change content of some files!)? '))
        .toString()
        .toLowerCase()
        .replace(/ /g, '')
        .replace(/[^yesno]/g, '')
        .slice(0, 1);

    if (confirm !== 'y') {
        console.log('Not processing files: action canceled.  Exiting.');
        rl.close();
        return;
    }

    processFiles(__dirname, packageInfo);
    rl.close();
};

run();
