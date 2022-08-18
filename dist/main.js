"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const toolCache = __importStar(require("@actions/tool-cache"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const utilities_1 = require("./utilities");
const YAML = __importStar(require("yamljs"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
                fs.writeFileSync('.npmrc', `//${core.getInput('npm_registry')}/:_authToken=${core.getInput('npm_token')}` + '\n', { flag: 'a' });
            }
            if (core.getInput('npmrc')) {
                core.debug('Writing .npmrc..');
                fs.writeFileSync('.npmrc', core.getInput('npmrc'), { flag: 'a' });
            }
            if (core.getInput('service_account_key')) {
                fs.writeFileSync('/tmp/terraform-key.json', core.getInput('service_account_key'), { flag: 'w+' });
                yield exec.exec('gcloud', [
                    'auth',
                    'activate-service-account',
                    core.getInput('service_account_name'),
                    '--key-file',
                    '/tmp/terraform-key.json'
                ]);
            }
            core.info(`Deploying version "${version}" (${dockerTag})..`);
            yield exec.exec('docker', ['login', '-u', '_json_key', '--password-stdin', core.getInput('docker_login_uri')], {
                input: Buffer.from(core.getInput('storage_account_key'))
            });
            yield exec.exec('gcloud', ['auth', 'configure-docker']);
            core.debug(`Building docker image for "${dockerTag}"..`);
            const dockerBuildArgs = ['build'];
            if (core.getInput('docker_build_no_cache')) {
                dockerBuildArgs.push('--no-cache');
            }
            if (core.getInput('docker_build_args')) {
                const args = YAML.parse(core.getInput('docker_build_args'));
                for (let key in args) {
                    dockerBuildArgs.push(`--build-arg=${key}=${args[key]}`);
                }
            }
            dockerBuildArgs.push('-t');
            dockerBuildArgs.push(dockerTag);
            dockerBuildArgs.push('.');
            core.info(dockerBuildArgs.join(' '));
            yield exec.exec('docker', dockerBuildArgs);
            yield exec.exec('docker', ['push', dockerTag]);
            if (core.getInput('terraform_deploy_file')) {
                yield toolCache.extractZip(yield toolCache.downloadTool(`https://releases.hashicorp.com/terraform/${core.getInput('terraform_version')}/terraform_${core.getInput('terraform_version')}_linux_amd64.zip`), '/tmp');
                yield exec.exec('/tmp/terraform', ['init'], {
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
                        yield exec.exec('/tmp/terraform', [
                            'apply',
                            '-auto-approve',
                            `-var=host=${core.getInput('kubernetes_endpoint')}`,
                            `-var=token=${core.getInput('kubernetes_token')}`,
                            `-var=image=${dockerTag}`,
                            `-var=env=${env}`
                        ], {
                            env: {
                                TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                                GOOGLE_APPLICATION_CREDENTIALS: '/tmp/terraform-key.json'
                            }
                        });
                        failed = false;
                        break;
                    }
                    catch (err) {
                        failed = true;
                        core.debug(`** terraform apply failed! retrying (attempt #${retries}/${maxRetries})..`);
                        yield utilities_1.wait(5000);
                    }
                }
                if (!failed) {
                    core.debug(`Deploy completed in ${retries} retries.`);
                }
                else {
                    core.setFailed(`terraform apply failed after ${retries} retries!`);
                }
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
