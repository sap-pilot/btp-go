const cds = require('@sap/cds');
const fs = require('fs');
const gitRepo = require("./ext/git-repo.js");

const GIT_REPO_LANDSCAPE_PATH = process.env.GIT_REPO_LANDSCAPE_PATH;
const INITIAL_LANSCAPE_CONTENT = '{"btp":{"globalAccounts":[]},"s4":{"projects":[]},"templates":[],"footerLinks":[]}';

console.log('node version [%s]', process.version);

module.exports = cds.service.impl(srv => {
    srv.on('getContent', getContent);
    srv.on('updateContent', updateContent);
});

const getContent = async (req) => {
    const startTime = new Date().getTime();
    const userId = req.user.id;
    console.log("read homeContent, requester: [" + userId + "]");
    const homeContent = {id: "homeContent", updator: "N/A", updateTime: "N/A"};
    if (!fs.existsSync(GIT_REPO_LANDSCAPE_PATH)) {
        console.log(`Warning: backend home content file doesn't exist: ${GIT_REPO_LANDSCAPE_PATH}, returning INITIAL_LANSCAPE_CONTENT`);
        homeContent.content = INITIAL_LANSCAPE_CONTENT;
    } else {
        homeContent.content = fs.readFileSync(GIT_REPO_LANDSCAPE_PATH, { encoding: 'utf8' });
    }
    const endTime = new Date().getTime();
    console.log("read homeContent completed, took time: "+(endTime-startTime)+" msecs");
    return homeContent;
}

const updateContent = async (req) => {
    const startTime = new Date().getTime();
    const userId = req.user.id;
    console.log("update homeContent, requester: [" + userId + "]");
    const homeContent = req.data.homeContent;
    var ret = [];
    if (!fs.existsSync(GIT_REPO_LANDSCAPE_PATH)) {
        ret.push("Error: backend home content file doesn't exist: '"+GIT_REPO_LANDSCAPE_PATH+"'");
    } else if (homeContent && homeContent.content) {
        // read existing content
        let currentContent = fs.readFileSync(GIT_REPO_LANDSCAPE_PATH, { encoding: 'utf8' });
        if (currentContent === homeContent.content) {
            ret.push("Nothing changed");
        } else {
            fs.writeFileSync(GIT_REPO_LANDSCAPE_PATH, homeContent.content);
            ret.push("Success: landscape defination updated");
            let msg = gitRepo.commitAndPush("Update landscape content", userId?userId.split('@')[0]:'N/A', userId?userId:'N/A');
            ret.push("Update repo result="+msg);
        }
    } else {
        ret.push("Error: no homeContent nor homeContent.content provided");
    }
    const endTime = new Date().getTime();
    console.log(ret);
    console.log("update homeContent completed, took time: "+(endTime-startTime)+" msecs");
    return ret;
}