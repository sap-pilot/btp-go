/* global Vue axios */ //> from vue.html
const $ = sel => document.querySelector(sel)
const GET = (url) => axios.get(url)
const POST = (cmd,data) => axios.post(cmd,data)

// replace variables in string
const interpolateStr = (string, values) => string.replace(/{(.*?)}/g, (match, offset) => values[offset]);

/**  render service/s4  url and name by template and valueMap */
const renderService = function(srvKey, srv, tpl, valueMap) {
    if (!srv.url && tpl.url) // service url overwrites template url (likewise for below name and fullname)
        srv.url = interpolateStr(tpl.url, valueMap)
    if (!srv.name && tpl.name)
        srv.name = interpolateStr(tpl.name, valueMap);
    if (!srv.fullName && tpl.fullName)
        srv.fullName = tpl.fullName;
    else
        srv.fullName = srv.name;
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

/** populate service table in specified directory (dir) like this: 
 *     allServices[] -> {serviceName,serviceInSubaccounts[]}  */
const populateServiceTable = function(dir) {
    const allServices = []; // rows of all serivces in this dir like {serviceName:<serviceName>,serviceInSubaccount:[]}
    const serviceMap = {}; // temporary map of serviceType-> above service row
    for (const [saIdx, sa] of Object.entries(dir.subaccounts)) {
        for (const [srvType, srv] of Object.entries(sa.services)) {
            if (!serviceMap[srvType]) {
                // initialize row as empty array
                const srvRow = {serviceName:srv.fullName, serviceInSubaccounts:[]};
                serviceMap[srvType] = srvRow; 
                allServices.push(srvRow);
                // first time seeing this service, prefill null ref for all subaccounts
                for (var i = 0; i < dir.subaccounts.length; i++) {
                    srvRow.serviceInSubaccounts.push(null); 
                }
            } 
            serviceMap[srvType].serviceInSubaccounts[saIdx] = srv;
        }
    }
    allServices.sort((a,b) => (a.serviceName > b.serviceName) ? 1 : ((b.serviceName > a.serviceName) ? -1 : 0))
    dir.allServices = allServices;
};

const populateS4Table = function(s4, tpl) {
    const s4ValueMap = Object.assign({},s4.params); // temporary map of serviceType-> above service row
    for (const prj of s4.projects) {
        for (const prd of prj.products) {
            prd.tieredSystems = [];
            // first time seeing this product, prefill null ref for all tiers
            for (var i = 0; i < prj.tiers.length; i++) {
                prd.tieredSystems.push(null); 
            }
            for (const sys of prd.systems) {
                const tierIndex = prj.tiers.indexOf(sys.tier); 
                if (tierIndex < 0) {
                    console.log("# tier ['"+sys.tier+"'] not found");          
                }
                if (!prd.tieredSystems[tierIndex]) {
                    prd.tieredSystems[tierIndex] = [];
                }
                const sysValueMap = Object.assign({},s4ValueMap);
                for (const pk in sys) {
                    if (pk != "instances") 
                        sysValueMap[pk] = sys[pk]; // add sys params, note s4 param with same name will be overwriten
                }
                if (!sysValueMap.host)
                    sysValueMap.host = sysValueMap.sid; // by default assign sid as host name
                renderService("s4",sys,tpl,sysValueMap);
                prd.tieredSystems[tierIndex].push(sys);
            }
        }
    }
};


const app = Vue.createApp ({

    data() {
      return {
        btp: [],
        s4: [],
        footerLinks: [],
        templates: [],
        currentUser: {}
      }
    },

    methods: {
        async fetch () {
            const {data} = await GET(`/data/links-cvx.json`);
            app.btp = data.btp;
            app.s4 = data.s4;
            app.footerLinks = data.footerLinks;
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
                    // populate services table within dir
                    populateServiceTable(dir);
                } // end of directories (dir)
            } // end of global account (ga)
            populateS4Table(app.s4,app.templates["s4"]);
        },
        async getUserInfo() {
            const {data} = await GET(`/user-api/currentUser`);
            app.currentUser = data;
        }
    },
    mounted: function () {
        this.$nextTick(function () {
            // table handling functions
            const tabBtns = document.querySelectorAll("ul.nav-pills > li > a");
            tabBtns.forEach(btn => {
                btn.addEventListener('shown.bs.tab', function(e) {
                    var id = e.target.getAttribute("data-bs-target").substr(6);
                    window.location.hash = id;
                });
            });
            const hash = window.location.hash ? window.location.hash.substr(1) : "";
            const tabBtn = document.querySelector('a[data-bs-target="#pane-' + hash + '"]');
            if (tabBtn) {
                tabBtn.click();
            }
        })
    }
}).mount('#app')

app.fetch();
app.getUserInfo();