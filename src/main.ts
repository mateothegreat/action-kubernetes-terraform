import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';

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

        console.log(`Deploying version "${ version }" (${ dockerTag })..`);

        console.log(await exec.exec('docker', [ 'login', '-u', '_json_key', '--password-stdin', 'https://gcr.io' ], {

            input: Buffer.from(core.getInput('service_account_key'))

        }));


        console.log(await exec.exec('ls -la'));
        console.log(await exec.exec('ls -la /home/runner/work/frontend-app/'));
        console.log(await exec.exec('ls -la /home/runner/work/'));
        console.log(await exec.exec('ls -la /home/runner/'));


        console.log(await exec.exec('docker', [ 'build', '-t', dockerTag, '.' ], {

            cwd: '/home/runner/work/frontend-app'

        }));

        console.log(await exec.exec('docker', [ 'push', dockerTag ]));

        await toolCache.extractZip(await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip'), '/tmp');

        console.log(await exec.exec('/tmp/terraform', [ 'init' ]));

        console.log(await exec.exec('/tmp/terraform', [

            'apply',
            '-auto-approve',
            `-var=host=${ kubernetes_endpoint }`,
            `-var=token=${ kubernetes_token }`,
            `-var=image=${ kubernetes_image }`

        ]));

    } catch (error) {

        core.setFailed(error.message);

    }

}

run();
