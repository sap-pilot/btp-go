/* global Vue axios */ //> from vue.html
const $ = sel => document.querySelector(sel)
const GET = (url) => axios.get('./data'+url)
const POST = (cmd,data) => axios.post('/data'+cmd,data)

// replace variables in url
const interpolateUrl = (string, values) => string.replace(/{(.*?)}/g, (match, offset) => values[offset]);

// render service url and name by template and valueMap
const renderService = function(srvKey, srv, tpl, valueMap) {
    if (!srv.url && tpl.url) // service url overwrites template url (likewise for below name and fullname)
        srv.url = interpolateUrl(tpl.url, valueMap)
    if (!srv.name && tpl.name)
        srv.name = tpl.name;
    if (!srv.fullName && tpl.fullName)
        srv.fullName = tpl.fullName;
    if (tpl.children) {
        // also render children
        srv.children = srv.children?srv.children:[];
        for (const tplChild of tpl.children) {
            if (tplChild.repeatOn == "instances") {
                // apply this tplChild to all srv instances  
                if (!srv.instances) 
                    continue;
                for (const srvInst of srv.instances) {
                    const instChild = Object.assign({},srvInst);
                    // build instValueMap
                    const instValueMap = Object.assign({},valueMap);
                    for (const pk in srvInst) {
                        if (pk != "instances") 
                            instValueMap[srvKey+"-"+pk] = srvInst[pk]; // add service instance params, note service param with same name will be overwriten
                    }
                    // render service instance
                    renderService(srvKey, instChild, tplChild, instValueMap);
                    srv.children.push(instChild);
                }
            } else {
                // render single item (not related to instances)
                const srvChild = {};
                renderService(srvKey, srvChild, tplChild, valueMap); // render as menu item 
                srv.children.push(srvChild); 
            }
        }
        // remove first or last divider if they present
        if (srv.children.length > 0 && srv.children[srv.children.length-1].name == '-') 
            srv.children.pop();
        if (srv.children.length > 0 && srv.children[0].name == '-') 
            srv.children.shift();
    }
};

const app = Vue.createApp ({

    data() {
      return {
        btp: [],
        s4: [],
        templates: []
      }
    },

    methods: {
        async fetch () {
            const {data} = await GET(`/links.json`);
            app.btp = data.btp;
            app.templates = data.templates;
            // apply template to services
            for (const ga of app.btp.globalAccounts) {
                for (const dir of ga.directories) {
                    for (const sa of dir.subaccounts) {
                        const valueMap = {
                            globalAccountId: ga.id,
                            cockpitRegion: ga.cockpitRegion,
                            subaccountId: sa.id,
                            subdomain: sa.subdomain,
                            region: sa.region? sa.region:dir.region,
                        };
                        for (const sk in sa.services) {
                            const srv = sa.services[sk];
                            const tpl = app.templates[sk];
                            // loop through service parameters and add them to value map
                            for (const pk in srv) {
                                if (pk != "instances") 
                                   valueMap[sk+"-"+pk] = srv[pk]; // add service params into value map
                            }
                            // render service
                            renderService(sk, srv, tpl, valueMap);
                        }
                        // render cockpit
                        if (app.templates["cockpit"]) {
                            sa.cockpit = {};
                            renderService("cockpit", sa.cockpit, app.templates["cockpit"], valueMap);
                        }
                    } // end of subaccounts (sa)
                } // end of directories (dir)
            } // end of global account (ga)
        }
    }
}).mount('#app')

app.fetch();