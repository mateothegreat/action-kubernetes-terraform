import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as fs from 'fs';

async function run(): Promise<void> {

    try {

        const version = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/)[ 2 ];
        const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[ 1 ];
        const dockerTag = `${ core.getInput('docker_image_base') }/${ repositoryName }:${ version }`;

        if (core.getInput('npm_token')) {

            fs.writeFileSync('.npmrc', `//registry.npmjs.org/:_authToken=${ core.getInput('npm_token') }`, { flag: 'w+' });

        }

        if (core.getInput('service_account_key')) {

            fs.writeFileSync('/tmp/tfkey.json', core.getInput('service_account_key'), { flag: 'w+' });

            await exec.exec('gcloud', [ 'auth', 'activate-service-account', core.getInput('service_account_name'), '--key-file', '/tmp/tfkey.json' ]);

        }

        console.log(`Deploying version "${ version }" (${ dockerTag })..`);

        await exec.exec('docker', [ 'login', '-u', '_json_key', '--password-stdin', 'https://gcr.io' ], {

            input: Buffer.from(core.getInput('storage_account_key'))

        });

        // await exec.exec('docker', [ 'build', '-t', dockerTag, '.' ]);
        // await exec.exec('docker', [ 'push', dockerTag ]);

        await toolCache.extractZip(await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip'), '/tmp');

        await exec.exec('/tmp/terraform', [ 'init' ], {

            env: {

                GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'

            }

        });

        let retries = 0;

        while (retries < parseInt(core.getInput('terraform_retries'))) {

            retries++;

            try {

                await exec.exec('/tmp/terraform', [

                    'apply',
                    '-auto-approve',
                    `-var=host=${ core.getInput('kubernetes_endpoint') }`,
                    `-var=token=${ core.getInput('kubernetes_token') }`,
                    `-var=image=${ core.getInput('kubernetes_image') }`

                ], {

                    env: {

                        GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'

                    }

                });

            } catch (err) {

                console.log(`** terraform apply failed! retrying (attempt #${ retries })..`);

            }

        }

        console.log(`Deploy completed in ${ retries } retries.`);

    } catch (error) {

        core.setFailed(error.message);

    }

}

run();
