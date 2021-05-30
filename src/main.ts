import * as core from '@actions/core';

async function run(): Promise<void> {
    try {
        const name: string = core.getInput('name');
        const kubernetes_endpoint: string = core.getInput('kubernetes_endpoint');
        const kubernetes_token: string = core.getInput('kubernetes_token');
        const kubernetes_environment_variables: string = core.getInput('kubernetes_environment_variables');


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
