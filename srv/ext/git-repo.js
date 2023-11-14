const { execSync } = require('child_process');
const { existsSync, rmdirSync } = require('fs');

const GIT_REPO_URL = process.env.GIT_REPO_URL;
const GIT_REPO_BRANCH = process.env.GIT_REPO_BRANCH;
const LOCAL_REPO_PATH = "./custom";

class GitRepo {
    constructor() {
        console.info("initializing GIT_REPO ...");
        if (!GIT_REPO_URL) {
            console.error("no GIT_REPO_URL specified in env, not able to initialize gitRepo");
            return;
        }
        // if (existsSync(LOCAL_REPO_PATH)) {
        //     console.info("Deleting existing local repo: "+LOCAL_REPO_PATH);
        //     rmdirSync(LOCAL_REPO_PATH);
        // }
        if (!existsSync(LOCAL_REPO_PATH)) {
            // clone repo
            let ret = execSync(`git clone ${GIT_REPO_URL} ${LOCAL_REPO_PATH}`).toString();
            console.info("clone repo ret="+ret);
        }
        if (GIT_REPO_BRANCH) {
            // change branch 
            console.info(`change branch into ${GIT_REPO_BRANCH} ...`);
            let checkoutRet = execSync(`cd ${LOCAL_REPO_PATH} && git fetch && git switch ${GIT_REPO_BRANCH}`).toString();
            console.info(`checkout branch ${GIT_REPO_BRANCH} ret=${checkoutRet}`);
        }        
    }

    commitAndPush( message, userName, userEmail ) {
        let ret = execSync(`cd ${LOCAL_REPO_PATH} && git config user.name "${userName}" && git config user.email "${userEmail}" && git add -A && git commit -m '${message}' && git push --set-upstream origin ${GIT_REPO_BRANCH} --force`).toString();
        console.log(`commit and push completed, ret=\n${ret}`);
        return ret;
    }
}

module.exports = new GitRepo(); 