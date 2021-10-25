import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { wait } from './utilities';
import * as YAML from 'yamljs';

async function run(): Promise<void> {

    try {

        console.log(process.env);
        console.log(core.getInput('env'));
        console.log(YAML.parse(core.getInput('env')));

        let env;

        const version = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/)[ 2 ];
        const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[ 1 ];
        const dockerTag = `${ core.getInput('docker_image_base', { required: true }) }/${ repositoryName }/${ repositoryName }:${ version }`;

        if (core.getInput('env')) {

            env = JSON.stringify(YAML.parse(core.getInput('env')));

        }

        // if (core.getInput('npm_token')) {

            core.debug('Writing asdf asdfasdfasd fasdfsdfasd fdas.npmrc..');

            if (core.getInput('npm_pre')) {

                console.log('Writing .npmrc first line..');

                fs.writeFileSync('.npmrc', core.getInput('npm_pre'))

            }

        core.debug((`//${ core.getInput('npm_registry')}/:_authToken=${ core.getInput('npm_token') }`);
            fs.writeFileSync('.npmrc', `//${ core.getInput('npm_registry')}/:_authToken=${ core.getInput('npm_token') }`, { flag: 'w+' });


        core.debug(fs.readFileSync('.npmrc'))

            console.log(1111);
        // }

        console.log(222);

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

        if (core.getInput('terraform_deploy_file')) {

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

            while (retries <= maxRetries) {

                retries++;

                try {

                    await exec.exec('/tmp/terraform', [

                        'apply',
                        '-auto-approve',
                        `-var=host=${ core.getInput('kubernetes_endpoint') }`,
                        `-var=token=${ core.getInput('kubernetes_token') }`,
                        `-var=image=${ dockerTag }`,
                        `-var=env=${ env }`

                    ], {

                        env: {

                            TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                            GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'

                        }

                    });

                    failed = false;

                    break;

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

        }

    } catch (error) {

        core.setFailed(error.message);

    }


}

run();
