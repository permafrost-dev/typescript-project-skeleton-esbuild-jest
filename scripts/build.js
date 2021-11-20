// @ts-nocheck

const { realpathSync, readFileSync, writeFileSync, renameSync } = require('fs');
const esbuild = require('esbuild');
const { basename } = require('path');
const { spawnSync } = require('child_process');

const buildConfig = {
    basePath: `${__dirname}/..`,
    outdir: 'dist',
    format: 'cjs',
    entry: 'src/index.ts',
    bundle: true,
    minify: false,
    constants: {},
    platform: {
        name: 'node',
        version: 16,
    },
};

class Builder {
    config = {
        verbose: false,
        production: false,
    };

    write(msg) {
        process.stdout.write(`${msg}`.toString());
    }

    writeln(msg) {
        process.stdout.write(`${msg}\n`.toString());
    }

    async compile() {
        const result = await esbuild.build({
            logLevel: 'silent',
            absWorkingDir: buildConfig.basePath,
            entryPoints: [buildConfig.entry],
            outdir: buildConfig.outdir,
            bundle: buildConfig.bundle,
            format: buildConfig.format,
            platform: buildConfig.platform.name,
            target: `${buildConfig.platform.name}${buildConfig.platform.version}`,
            allowOverwrite: true,
            minify: buildConfig.minify,
            metafile: true,
            define: {
                __APP_VERSION__: `'${require(realpathSync(`${buildConfig.basePath}/package.json`, { encoding: 'utf-8' })).version}'`,
                __COMPILED_AT__: `'${new Date().toUTCString()}'`,
                ...buildConfig.constants,
            },
        });

        return new Promise(resolve => resolve(result));
    }

    sizeForDisplay(bytes) {
        return `${bytes / 1024}`.slice(0, 4) + ' kb';
    }

    reportCompileResults(results) {
        results.errors.forEach(errorMsg => this.writeln(`* Error: ${errorMsg}`));
        results.warnings.forEach(msg => this.writeln(`* Warning: ${msg}`));

        Object.keys(results.metafile.outputs).forEach(fn => {
            this.writeln(`*   » created '${fn}' (${this.sizeForDisplay(results.metafile.outputs[fn].bytes)})`);
        });
    }

    processArgv() {
        const argMap = {
            '-v': { name: 'verbose', value: true },
            '--verbose': { name: 'verbose', value: true },

            '-p': { name: 'production', value: true },
            '--prod': { name: 'production', value: true },
            '--production': { name: 'production', value: true },
        };

        process.argv
            .slice(2)
            .map(arg => {
                const hasMappedArg = typeof argMap[arg] === 'undefined';
                return hasMappedArg ? { name: arg.replace(/^-+/, ''), value: true } : argMap[arg];
            })
            .forEach(data => (this.config[data.name] = data.value));
    }

    convertToProductionFile() {
        const filename = basename(buildConfig.entry).replace(/\.ts$/, '.js');
        const newFilename = require(realpathSync(`${buildConfig.basePath}/package.json`, { encoding: 'utf-8' })).name;

        spawnSync('chmod', ['+x', `${buildConfig.outdir}/${filename}`], { stdio: 'ignore' });

        const contents = readFileSync(`${buildConfig.outdir}/${filename}`, { encoding: 'utf-8' });

        writeFileSync(`${buildConfig.outdir}/${filename}`, `#!/usr/bin/node\n\n${contents}`, { encoding: 'utf-8' });
        renameSync(`${buildConfig.outdir}/${filename}`, `${buildConfig.outdir}/${newFilename}`);
    }

    async run() {
        this.processArgv();

        if (this.config.verbose) {
            this.writeln(`* Using esbuild v${esbuild.version}.`);
        }

        this.write(`* Compiling application...${this.config.verbose ? '\n' : ''}`);

        const startedTs = new Date().getTime();
        const results = await this.compile();
        const finishedTs = new Date().getTime();

        if (this.config.verbose) {
            this.reportCompileResults(results);
        }

        this.writeln((this.config.verbose ? `* D` : `d`) + `one. (${finishedTs - startedTs} ms)`);

        if (this.config.production) {
            this.convertToProductionFile();
        }
    }
}

new Builder().run();
