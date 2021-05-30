import * as core from '@actions/core';

async function run(): Promise<void> {

    try {

        const name: string = core.getInput('kubernetes_token');
        const kubernetes_endpoint: string = core.getInput('kubernetes_token');
        const kubernetes_token: string = core.getInput('kubernetes_token');

        core.debug(`name = ${ name }`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

        core.setOutput('time', new Date().toTimeString());

    } catch (error) {

        core.setFailed(error.message);

    }

}

run();
