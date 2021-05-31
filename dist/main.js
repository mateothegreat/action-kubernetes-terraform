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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const version = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/)[2];
            const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[1];
            const dockerTag = `${core.getInput('docker_image_base', { required: true })}/${repositoryName}:${version}`;
            if (core.getInput('npm_token')) {
                fs.writeFileSync('.npmrc', `//registry.npmjs.org/:_authToken=${core.getInput('npm_token')}`, { flag: 'w+' });
            }
            if (core.getInput('service_account_key')) {
                fs.writeFileSync('/tmp/tfkey.json', core.getInput('service_account_key'), { flag: 'w+' });
                yield exec.exec('gcloud', ['auth', 'activate-service-account', core.getInput('service_account_name'), '--key-file', '/tmp/tfkey.json']);
            }
            console.log(`Deploying version "${version}" (${dockerTag})..`);
            yield exec.exec('docker', ['login', '-u', '_json_key', '--password-stdin', 'https://gcr.io'], {
                input: Buffer.from(core.getInput('storage_account_key'))
            });
            // await exec.exec('docker', [ 'build', '-t', dockerTag, '.' ]);
            // await exec.exec('docker', [ 'push', dockerTag ]);
            yield toolCache.extractZip(yield toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip'), '/tmp');
            yield exec.exec('/tmp/terraform', ['init'], {
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
                    yield exec.exec('/tmp/terraform', [
                        'apply',
                        '-auto-approve',
                        `-var=host=${core.getInput('kubernetes_endpoint')}`,
                        `-var=token=${core.getInput('kubernetes_token')}`,
                        `-var=image=${core.getInput('kubernetes_image')}`
                    ], {
                        env: {
                            TF_WORKSPACE: core.getInput('terraform_workspace', { required: true }),
                            GOOGLE_APPLICATION_CREDENTIALS: '/tmp/tfkey.json'
                        }
                    });
                    failed = false;
                }
                catch (err) {
                    failed = true;
                    console.log(`** terraform apply failed! retrying (attempt #${retries}/${maxRetries})..`);
                    yield utilities_1.wait(5000);
                }
            }
            if (!failed) {
                console.log(`Deploy completed in ${retries} retries.`);
            }
            else {
                core.setFailed(`terraform apply failed after ${retries} retries!`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
