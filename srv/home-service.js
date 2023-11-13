const cds = require('@sap/cds');
const fs = require('fs');

const CUSTOM_LINK_PATH = "./app/webapp/custom/cvx-links.json";

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
    if (!fs.existsSync(CUSTOM_LINK_PATH)) {
        console.log("Warning: backend home content file doesn't exist: '"+CUSTOM_LINK_PATH+"', create initial file now.");
        const dir = "./app/webapp/custom/";
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CUSTOM_LINK_PATH, '{"btp":{"globalAccounts":[]},"s4":{"projects":[]},"templates":[],"footerLinks":[]}');
    } 
    homeContent.content = fs.readFileSync(CUSTOM_LINK_PATH, { encoding: 'utf8' });
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
    if (!fs.existsSync(CUSTOM_LINK_PATH)) {
        ret.push("Error: backend home content file doesn't exist: '"+CUSTOM_LINK_PATH+"'");
    } else if (homeContent && homeContent.content) {
        fs.writeFileSync(CUSTOM_LINK_PATH, homeContent.content);
        ret.push("Success");
    } else {
        ret.push("Error: no homeContent nor homeContent.content provided");
    }
    const endTime = new Date().getTime();
    console.log(ret);
    console.log("update homeContent completed, took time: "+(endTime-startTime)+" msecs");
    return ret;
}