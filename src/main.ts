import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';

async function run(): Promise<void> {

    try {

        const name: string = core.getInput('name');
        const kubernetes_endpoint: string = core.getInput('kubernetes_endpoint');
        const kubernetes_token: string = core.getInput('kubernetes_token');
        const kubernetes_environment_variables: string = core.getInput('kubernetes_environment_variables');

        const p = await toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.14.8/terraform_0.14.8_linux_amd64.zip');

        console.log(await toolCache.extractZip(p, '/usr/local/bin'));

        console.log(await exec.exec('/usr/local/bin/terraform', [ 'version' ]));
        console.log(await exec.exec('/usr/local/bin/terraform', [ 'apply' ]));

        const args = [];


        core.info('asdfasdf');
        core.info('asdfasdf');
        core.info('asdfasdf');
        core.info(name);
        core.info('asdfaszxcvzxcvzxcvzxcdf');
        core.debug(`name = ${ name } ${ kubernetes_token } ${ kubernetes_endpoint }`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

        core.setOutput('time', new Date().toTimeString());
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
