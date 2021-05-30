import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';

async function run(): Promise<void> {

    try {

        const ref: string = core.getInput('ref');
        const terraform_backend_credentials_path: string = core.getInput('terraform_backend_credentials_path');
        const terraform_backend_bucket: string = core.getInput('terraform_backend_bucket');
        const terraform_backend_prefix: string = core.getInput('terraform_backend_prefix');
        const kubernetes_endpoint: string = core.getInput('kubernetes_endpoint');
        const kubernetes_token: string = core.getInput('kubernetes_token');
        const kubernetes_environment_variables: string = core.getInput('kubernetes_environment_variables');

        const p = await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.14.8/terraform_0.14.8_linux_amd64.zip');

        console.log(await toolCache.extractZip(p, '/tmp'));

        console.log(await exec.exec('/tmp/terraform', [

            'init',
            `-backend-config="credentials='${ terraform_backend_credentials_path }'"`,
            `-backend-config="bucket='${ terraform_backend_bucket }'"`,
            `-backend-config="prefix='${ terraform_backend_prefix }"'`

        ]));
        console.log(await exec.exec('/tmp/terraform', [ 'apply' ]));

        const args = [];


        core.info(`ref: ${ ref }`);

        core.setOutput('time', new Date().toTimeString());
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
