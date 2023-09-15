/* global Vue axios */ //> from vue.html
const $ = sel => document.querySelector(sel)
const GET = (url) => axios.get('./data'+url)
const POST = (cmd,data) => axios.post('/data'+cmd,data)

// replace variables in url
const interpolateUrl = (string, values) => string.replace(/{(.*?)}/g, (match, offset) => values[offset]);
const renderService = function(template, valueMap) {
    const renderedService = {name:template.name, url:template.url?interpolateUrl(template.url, valueMap):null, fullName: template.fullName? template.fullName : template.name};
    if (template.children) {
        // also render children
        renderedService.children = [];
        for (const templateChild of template.children) {
            const renderedChild = templateChild.name?renderService(templateChild, valueMap):{divider:true}; // render menu item or divider
            renderedService.children.push(renderedChild); // rendered children
        }
    }
    return renderedService;
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
                        sa.renderedServices = [];
                        const valueMap = {
                            globalAccountId: ga.id,
                            cockpitRegion: ga.cockpitRegion,
                            subaccountId: sa.id,
                            subdomain: sa.subdomain,
                            region: sa.region? sa.region:dir.region,
                        };
                        for (const pk in sa.params) {
                            for (const vk in sa.params[pk]) {
                                valueMap[pk+"-"+vk] = sa.params[pk][vk]; // add service params into value map
                            }
                        }
                        for (const srv of sa.services) {
                            const t = app.templates[srv];
                            const rs = renderService(t, valueMap);
                            sa.renderedServices.push(rs);
                        }
                        // render cockpit
                        sa.cockpit = renderService(app.templates["cockpit"], valueMap);
                    }
                }
            } // end of ga
        }
    }
}).mount('#app')

app.fetch();