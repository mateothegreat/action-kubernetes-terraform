import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as fs from 'fs';

async function run(): Promise<void> {

    try {

        const docker_image_base: string = core.getInput('docker_image_base');

        const terraform_backend_credentials: string = core.getInput('terraform_backend_credentials');
        const terraform_backend_bucket: string = core.getInput('terraform_backend_bucket');
        const terraform_backend_prefix: string = core.getInput('terraform_backend_prefix');
        const kubernetes_endpoint: string = core.getInput('kubernetes_endpoint');
        const kubernetes_token: string = core.getInput('kubernetes_token');
        const kubernetes_image: string = core.getInput('kubernetes_image');

        const matches = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/);
        const version = matches[ 2 ];
        const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[ 1 ];
        const dockerTag = `${ core.getInput('docker_image_base') }/${ repositoryName }:${ version }`;

        console.log(await exec.exec('id'));


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

        await exec.exec('docker', [ 'build', '-t', dockerTag, '.' ]);
        await exec.exec('docker', [ 'push', dockerTag ]);

        await toolCache.extractZip(await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip'), '/tmp');

        await exec.exec('/tmp/terraform', [ 'init' ], {

            env: {

                GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'

            }

        });

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

    } catch (error) {

        core.setFailed(error.message);

    }

}

run();
