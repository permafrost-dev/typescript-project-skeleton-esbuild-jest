const { basename } = require('path');
//const { esbuildPluginDecorator } = require('esbuild-plugin-decorator');
const {
    realpathSync, readFileSync, writeFileSync, renameSync, existsSync 
} = require('fs');
const { spawnSync, execSync } = require('child_process');
const esbuild = require('esbuild');

const buildConfig = {
    basePath: `${__dirname}/..`,
    bundle: true,
    constants: {},
    entry: 'src/index.ts',
    format: 'cjs',
    minify: false,
    outdir: 'dist',
    platform: {
        name: 'node',
        version: 14,
    },
};

const pkg = require(realpathSync(`${buildConfig.basePath}/package.json`, { encoding: 'utf-8' }));

class Builder {
    config = {
        binaries: false,
        production: false,
        verbose: false,
    };

    write(msg) {
        process.stdout.write(`${msg}`.toString());
    }

    writeln(msg) {
        this.write(`${msg}\n`);
    }

    async compile() {
        const result = await esbuild.build({
            absWorkingDir: buildConfig.basePath,
            allowOverwrite: true,
            bundle: buildConfig.bundle,
            define: {
                __APP_VERSION__: `'${pkg.version}'`,
                __COMPILED_AT__: `'${new Date().toUTCString()}'`,
                ...buildConfig.constants,
            },
            entryPoints: [ buildConfig.entry ],
            format: buildConfig.format,
            logLevel: 'silent',
            metafile: true,
            minify: buildConfig.minify,
            outdir: buildConfig.outdir,
            platform: buildConfig.platform.name,
            plugins: [
                // esbuildPluginDecorator({
                //     compiler: 'tsc',
                //     tsconfigPath: `${buildConfig.basePath}/tsconfig.json`,
                // }),
            ],
            target: `${buildConfig.platform.name}${buildConfig.platform.version}`,
        });

        return new Promise(resolve => resolve(result));
    }

    sizeForDisplay(bytes) {
        return `${`${bytes / 1024}`.slice(0, 4)} kb`;
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
            '--binaries': { name: 'binaries', value: true },
            '--prod': { name: 'production', value: true },
            '--production': { name: 'production', value: true },
            '--verbose': { name: 'verbose', value: true },
            '-p': { name: 'production', value: true },
            '-v': { name: 'verbose', value: true },
        };

        process.argv
            .slice(2)
            .map(arg => {
                const hasMappedArg = typeof argMap[arg] === 'undefined';
                return hasMappedArg ? { name: arg.replace(/^-+/, ''), value: true } : argMap[arg];
            })
            .forEach(data => (this.config[data.name] = data.value));

        console.log(this.config);
    }

    convertToProductionFile() {
        const filename = basename(buildConfig.entry).replace(/\.ts$/, '.js');
        const newFilename = pkg.name;
        const binaryFilename = `${buildConfig.outdir}/${filename.replace(/.js$/, '')}`;
        const contents = readFileSync(`${buildConfig.outdir}/${filename}`, { encoding: 'utf-8' });

        spawnSync('chmod', [ '+x', `${buildConfig.outdir}/${filename}` ], { stdio: 'ignore' });
        writeFileSync(`${buildConfig.outdir}/${filename}`, `#!/usr/bin/node\n\n${contents}`, { encoding: 'utf-8' });
        renameSync(`${buildConfig.outdir}/${filename}`, `${buildConfig.outdir}/${newFilename}`);

        if (existsSync(binaryFilename)) {
            renameSync(binaryFilename, `${buildConfig.outdir}/${newFilename}-${pkg.version}`);
        }
    }

    compileBinaries() {
        const platforms = [
            'linux',
            'macos',
            'win' 
        ];
        const filename = basename(buildConfig.entry).replace(/\.ts$/, '.js');
        const targets = platforms.map(t => `node16-${t.toLowerCase()}-x64`);
        const cmd = `npx pkg --compress Brotli --targets ${targets.join(',')} --out-path ${buildConfig.outdir} ${buildConfig.outdir}/${filename}`;

        execSync(cmd, { stdio: 'inherit' });

        const origBinaries = platforms
            .map(os => `${buildConfig.outdir}/${filename.replace(/.js$/, '')}-${os}`)
            .map(fn => (fn.includes('-win') ? `${fn}.exe` : fn));

        const newBinaries = platforms
            .map(os => `${buildConfig.outdir}/${pkg.name}-v${pkg.version}-${os}-x64`)
            .map(fn => (fn.includes('-win') ? `${fn}.exe` : fn));

        for (const originalFn of origBinaries) {
            const newFn = newBinaries[origBinaries.indexOf(originalFn)];
            renameSync(originalFn, newFn);
            spawnSync('chmod', [ '+x', newFn ], { stdio: 'ignore' });
        }
    }

    async run() {
        this.processArgv();

        if (this.config.verbose) {
            this.writeln(`* Using esbuild v${esbuild.version}.`);
        }

        this.write(`* Compiling application...${this.config.verbose ? '\n' : ''}`);

        const startedTs = new Date().getTime();
        const results = await this.compile();

        if (this.config.binaries) {
            this.compileBinaries();
        }

        const finishedTs = new Date().getTime();

        if (this.config.verbose) {
            this.reportCompileResults(results);
        }

        this.writeln(`${this.config.verbose ? '* D' : 'd'}one. (${finishedTs - startedTs} ms)`);

        if (this.config.production) {
            this.convertToProductionFile();
        }
    }
}

new Builder().run();
