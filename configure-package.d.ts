export type Feature = {
    info: {
        name: string;
        description: string;
        prompt: string;
    };
    packages: {
        dependencies: {
            [key: string]: string;
        };
        devDependencies: {
            [key: string]: string;
        };
    };
    scripts: {
        [key: string]: string;
    };
};
