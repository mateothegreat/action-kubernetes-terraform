import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';

async function run(): Promise<void> {

    try {

        const ref: string = core.getInput('ref');
        const terraform_backend_credentials: string = core.getInput('terraform_backend_credentials');
        const terraform_backend_bucket: string = core.getInput('terraform_backend_bucket');
        const terraform_backend_prefix: string = core.getInput('terraform_backend_prefix');
        const kubernetes_endpoint: string = core.getInput('kubernetes_endpoint');
        const kubernetes_token: string = core.getInput('kubernetes_token');
        const kubernetes_image: string = core.getInput('kubernetes_image');

        const p = await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip');

        console.log(await toolCache.extractZip(p, '/tmp'));

        console.log(await exec.exec('/tmp/terraform', [ 'init' ]));

        console.log(await exec.exec('/tmp/terraform', [

            'apply',
            '-auto-approve',
            `-var=host=${ kubernetes_endpoint }`,
            `-var=token=${ kubernetes_token }`,
            `-var=image=${ kubernetes_image }`

        ]));


        core.info(`ref: ${ ref }`);

        core.setOutput('time', new Date().toTimeString());
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
