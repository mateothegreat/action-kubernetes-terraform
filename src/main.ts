import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { wait } from './utilities';

async function run(): Promise<void> {

    try {

        const version = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/)[ 2 ];
        const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[ 1 ];
        const dockerTag = `${ core.getInput('docker_image_base', { required: true }) }/${ repositoryName }/${ repositoryName }:${ version }`;

        console.log(`token=${ core.getInput('npm_token') }`);
        
        if (core.getInput('npm_token')) {

            console.log('Writing .npmrc..');

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

        console.log(`Building docker image for "${ dockerTag }"..`);

        await exec.exec('docker', [ 'build', '-t', dockerTag, '.' ]);
        await exec.exec('docker', [ 'push', dockerTag ]);

        await toolCache.extractZip(await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip'), '/tmp');

        await exec.exec('/tmp/terraform', [ 'init' ], {

            env: {

                TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'

            }

        });

        const maxRetries = parseInt(core.getInput('terraform_retries')) || 1;

        let retries = 0;
        let failed = false;

        const env = {

            DB_HOSTNAME: core.getInput('DB_HOSTNAME'),
            DB_PORT: core.getInput('DB_PORT'),
            DB_USERNAME: core.getInput('DB_USERNAME'),
            DB_PASSWORD: core.getInput('DB_PASSWORD'),
            DB_NAME: core.getInput('DB_NAME'),
            ELASTICSEARCH_HOST: core.getInput('ELASTICSEARCH_HOST'),
            ELASTICSEARCH_PORT: core.getInput('ELASTICSEARCH_PORT'),
            ELASTICSEARCH_SCHEME: core.getInput('ELASTICSEARCH_SCHEME')

        };

        while (retries <= maxRetries) {

            retries++;

            try {

                await exec.exec('/tmp/terraform', [

                    'apply',
                    '-auto-approve',
                    `-var=host=${ core.getInput('kubernetes_endpoint') }`,
                    `-var=token=${ core.getInput('kubernetes_token') }`,
                    `-var=image=${ dockerTag }`,
                    `-var=env=${ JSON.stringify(env) }`

                ], {

                    env: {

                        TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                        GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'

                    }

                });

                failed = false;

            } catch (err) {

                failed = true;

                console.log(`** terraform apply failed! retrying (attempt #${ retries }/${ maxRetries })..`);

                await wait(5000);

            }

        }

        if (!failed) {

            console.log(`Deploy completed in ${ retries } retries.`);

        } else {

            core.setFailed(`terraform apply failed after ${ retries } retries!`);

        }

    } catch (error) {

        core.setFailed(error.message);

    }

}

run();
