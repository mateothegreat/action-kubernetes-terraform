import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { wait } from './utilities';
import * as YAML from 'yamljs';

async function run(): Promise<void> {
    try {
        let env;

        const version = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/)[2];
        const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[1];
        const dockerTag = `${core.getInput('docker_image_base', { required: true })}/${repositoryName}:${version}`;

        if (core.getInput('env')) {
            env = JSON.stringify(YAML.parse(core.getInput('env')));
        }

        if (core.getInput('npm_pre')) {
            core.debug('Writing .npmrc first line..');
            fs.writeFileSync('.npmrc', core.getInput('npm_pre') + '\r\n', { flag: 'w' });
        }

        if (core.getInput('npm_token')) {
            core.debug('Writing .npmrc..');

            fs.writeFileSync(
                '.npmrc',
                `//${core.getInput('npm_registry')}/:_authToken=${core.getInput('npm_token')}` + '\n',
                { flag: 'a' }
            );
        }

        if (core.getInput('service_account_key')) {
            fs.writeFileSync('/tmp/terraform-key.json', core.getInput('service_account_key'), { flag: 'w+' });

            await exec.exec('gcloud', [
                'auth',
                'activate-service-account',
                core.getInput('service_account_name'),
                '--key-file',
                '/tmp/terraform-key.json'
            ]);
        }

        core.info(`Deploying version "${version}" (${dockerTag})..`);

        await exec.exec('docker', ['login', '-u', '_json_key', '--password-stdin', 'https://gcr.io'], {
            input: Buffer.from(core.getInput('storage_account_key'))
        });

        core.debug(`Building docker image for "${dockerTag}"..`);

        const dockerBuildArgs = ['build'];

        if (core.getInput('docker_build_args')) {
            const args = YAML.parse(core.getInput('docker_build_args'));

            for (let key in args) {
                dockerBuildArgs.push(`--build-arg "${key}=${args[key]}"`);
            }
        }


        dockerBuildArgs.push('-t');
        dockerBuildArgs.push(dockerTag);
        dockerBuildArgs.push('.');

        core.info(dockerBuildArgs.join(' '))
        await exec.exec('docker', dockerBuildArgs);
        await exec.exec('docker', ['push', dockerTag]);

        if (core.getInput('terraform_deploy_file')) {
            await toolCache.extractZip(
                await toolCache.downloadTool(
                    `https://releases.hashicorp.com/terraform/${core.getInput(
                        'terraform_version'
                    )}/terraform_${core.getInput('terraform_version')}_linux_amd64.zip`
                ),
                '/tmp'
            );

            await exec.exec('/tmp/terraform', ['init'], {
                env: {
                    TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                    GOOGLE_APPLICATION_CREDENTIALS: '/tmp/terraform-key.json'
                }
            });

            const maxRetries = parseInt(core.getInput('terraform_retries')) || 1;

            let retries = 0;
            let failed = false;

            while (retries <= maxRetries) {
                retries++;

                try {
                    await exec.exec(
                        '/tmp/terraform',
                        [
                            'apply',
                            '-auto-approve',
                            `-var=host=${core.getInput('kubernetes_endpoint')}`,
                            `-var=token=${core.getInput('kubernetes_token')}`,
                            `-var=image=${dockerTag}`,
                            `-var=env=${env}`
                        ],
                        {
                            env: {
                                TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                                GOOGLE_APPLICATION_CREDENTIALS: '/tmp/terraform-key.json'
                            }
                        }
                    );

                    failed = false;

                    break;
                } catch (err) {
                    failed = true;

                    core.debug(`** terraform apply failed! retrying (attempt #${retries}/${maxRetries})..`);

                    await wait(5000);
                }
            }

            if (!failed) {
                core.debug(`Deploy completed in ${retries} retries.`);
            } else {
                core.setFailed(`terraform apply failed after ${retries} retries!`);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
