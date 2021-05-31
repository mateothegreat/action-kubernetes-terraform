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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const docker_image_base = core.getInput('docker_image_base');
            const terraform_backend_credentials = core.getInput('terraform_backend_credentials');
            const terraform_backend_bucket = core.getInput('terraform_backend_bucket');
            const terraform_backend_prefix = core.getInput('terraform_backend_prefix');
            const kubernetes_endpoint = core.getInput('kubernetes_endpoint');
            const kubernetes_token = core.getInput('kubernetes_token');
            const kubernetes_image = core.getInput('kubernetes_image');
            const matches = process.env.GITHUB_REF.match(/^refs\/([\w]+)\/(.*)$/);
            const version = matches[2];
            const repositoryName = process.env.GITHUB_REPOSITORY.match(/\/(.*)$/)[1];
            const dockerTag = `${core.getInput('docker_image_base')}/${repositoryName}:${version}`;
            console.log(`Deploying version "${version}" (${dockerTag})..`);
            console.log(yield exec.exec('docker', ['login', '-u', '_json_key', '--password-stdin', 'https://gcr.io'], {
                input: Buffer.from(core.getInput('service_account_key'))
            }));
            console.log(yield exec.exec('docker', ['build', '-t', dockerTag, '.'], {
                cwd: '/home/runner/work/frontend-app'
            }));
            console.log(yield exec.exec('ls -la'));
            console.log(yield exec.exec('ls -la /home/runner/work/frontend-app/'));
            console.log(yield exec.exec('ls -la /home/runner/work/'));
            console.log(yield exec.exec('ls -la /home/runner/'));
            console.log(yield exec.exec('docker', ['push', dockerTag]));
            yield toolCache.extractZip(yield toolCache.downloadTool('https://releases.hashicorp.com/terraform/0.15.4/terraform_0.15.4_linux_amd64.zip'), '/tmp');
            console.log(yield exec.exec('/tmp/terraform', ['init']));
            console.log(yield exec.exec('/tmp/terraform', [
                'apply',
                '-auto-approve',
                `-var=host=${kubernetes_endpoint}`,
                `-var=token=${kubernetes_token}`,
                `-var=image=${kubernetes_image}`
            ]));
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
