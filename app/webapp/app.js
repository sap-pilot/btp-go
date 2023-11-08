/* global Vue axios */ //> from vue.html
import HomeIcons from './components/HomeIcons.js'

const $ = sel => document.querySelector(sel);
const GET = (url) => axios.get(url);
const POST = (cmd,data) => axios.post(cmd,data);
// escaped CUSTOM_LINKS_PATH defined in env; to-be-replaced by approuter (see xs-app.json)
const CUSTOM_LINKS_PATH = `{{{CUSTOM_LINKS_PATH}}}`; 
// fall back to template links if CUSTOM_LINKS_PATH is not specified in env or default-env.json
const LINKS_PATH = CUSTOM_LINKS_PATH? CUSTOM_LINKS_PATH : "/assets/links-template.json";
const APP_VERSION = "v0.1";

const app = Vue.createApp ({

    data() {
      return {
        appVer: APP_VERSION,
        linksVer: "N/A",
        btp: [],
        s4: [],
        footerLinks: [],
        templates: [],
        currentUser: {},
        listenerAttached: false
      }
    },

    components: {
        HomeIcons
    },

    methods: {
        async fetch () {
            const {data} = await GET(LINKS_PATH);
            this.linksVer = data.linksVer;
            this.btp = data.btp;
            this.s4 = data.s4;
            this.footerLinks = data.footerLinks;
            this.templates = data.templates;
            // apply template to services
            for (const ga of this.btp.globalAccounts) {
                for (const oDir of ga.directories) {
                    for (const oSubaccount of oDir.subaccounts) {
                        // add default params
                        const mValueMap = {
                            globalAccountId: ga.id,
                            cockpitRegion: ga.cockpitRegion,
                            subaccountId: oSubaccount.id,
                            orgId: oSubaccount.orgId,
                            subdomain: oSubaccount.subdomain,
                            region: oSubaccount.region? oSubaccount.region:oDir.region,
                            spaces: oSubaccount.spaces,
                            "int-regionPostfix": ga["int-regionPostfix"],
                            "int-cpiTenant": ga["int-cpiTenant"]
                        };
                        for (const sServiceKey in oSubaccount.services) {
                            const oSrv = oSubaccount.services[sServiceKey];
                            const oTemplate = this.templates[sServiceKey];
                            // loop through service parameters and add them to value map
                            for (const sParamKey in oSrv) {
                                if (sParamKey != "instances") 
                                   mValueMap[sServiceKey+"-"+sParamKey] = oSrv[sParamKey]; // add service params into value map
                            }
                            // render service
                            this._fnRenderService(sServiceKey, oSrv, oTemplate, mValueMap);
                        }
                        // render cockpit
                        if (this.templates["cockpit"]) {
                            oSubaccount.cockpit = {};
                            this._fnRenderService("cockpit", oSubaccount.cockpit, this.templates["cockpit"], mValueMap);
                        }
                    } // end of subaccounts (oSubaccount)
                    // populate services table within oDir
                    this._fnPopulateServiceTable(oDir);
                } // end of oDirectories (oDir)
            } // end of global account (ga)
            this._fnPopulateS4Table(this.s4,this.templates["s4"]);
            this.getUserInfo(); // get user info after links got rendered
        },
        async getUserInfo() {
            const {data} = await GET(`/user-api/currentUser`);
            this.currentUser = data;
        },
        // replace variables in string
        _fnInterpolateStr(sStr, mValueMap) { 
            return sStr.replace(/{(.*?)}/g, (match, offset) => mValueMap[offset]);
        },
        /**  render service/s4  url and name by template and mValueMap */
        _fnRenderService(sSrvKey, oSrv, oTemplate, mValueMap) {
            if (!oSrv.url && oTemplate.url) // service url overwrites template url (likewise for below name and fullname)
                oSrv.url = this._fnInterpolateStr(oTemplate.url, mValueMap)
            if (!oSrv.name && oTemplate.name)
                oSrv.name = this._fnInterpolateStr(oTemplate.name, mValueMap);
            if (!oSrv.fullName && oTemplate.fullName)
                oSrv.fullName = oTemplate.fullName;
            else
                oSrv.fullName = oSrv.name;
            if (oTemplate.children) {
                // also render children
                oSrv.children = oSrv.children?oSrv.children:[];
                for (const oTemplateChild of oTemplate.children) {
                    if (oTemplateChild.repeatOn == "instances") {
                        // apply this oTemplateChild to all oSrv instances  
                        if (!oSrv.instances) 
                            continue;
                        for (const oSrvInst of oSrv.instances) {
                            const instChild = Object.assign({},oSrvInst);
                            // build instValueMap
                            const instValueMap = Object.assign({},mValueMap);
                            for (const pk in oSrvInst) {
                                if (pk != "instances") 
                                    instValueMap[sSrvKey+"-"+pk] = oSrvInst[pk]; // add service instance params, note service param with same name will be overwriten
                            }
                            // render service instance
                            this._fnRenderService(sSrvKey, instChild, oTemplateChild, instValueMap);
                            oSrv.children.push(instChild);
                        }
                    } else if (oTemplateChild.repeatOn == "spaces") {
                        // apply this oTemplateChild to all spaces
                        const aSpaces = mValueMap['spaces'];
                        if (!aSpaces || aSpaces.length == 0)
                            continue;
                        for (const oSpace of aSpaces) {
                            // copy space info first 
                            const oSpaceChild = Object.assign({},oSpace);
                            // build instValueMap
                            const oSpaceValueMap = Object.assign({},mValueMap);
                            for (const pk in oSpaceChild) {
                                oSpaceValueMap[pk] = oSpace[pk]; // add space params
                            }
                            // render service instance
                            this._fnRenderService(sSrvKey, oSpaceChild, oTemplateChild, oSpaceValueMap);
                            oSrv.children.push(oSpaceChild);
                        }
                    } else {
                        // render single item (not related to instances)
                        const oSrvChild = {};
                        this._fnRenderService(sSrvKey, oSrvChild, oTemplateChild, mValueMap); // render as menu item 
                        oSrv.children.push(oSrvChild); 
                    }
                }
                // remove first or last dividers if they present
                if (oSrv.children.length > 0 && oSrv.children[oSrv.children.length-1].name == '-') 
                    oSrv.children.pop();
                if (oSrv.children.length > 0 && oSrv.children[0].name == '-') 
                    oSrv.children.shift();
            }
        },
        /** populate service table in specified directory (oDir) like this: 
         *     aAllServices[] -> {serviceName,serviceInSubaccounts[]}  */
        _fnPopulateServiceTable(oDir) {
            const aAllServices = []; // rows of all serivces in this oDir like {serviceName:<serviceName>,serviceInSubaccount:[]}
            oDir.allServices = aAllServices;
            if (!oDir.subaccounts)
                return;
            const mServiceMap = {}; // temporary map of serviceType-> above service row
            for (const [iSaIndex, oSubaccount] of Object.entries(oDir.subaccounts)) {
                if (!oSubaccount.services)
                    continue;
                for (const [sSrvType, oSrv] of Object.entries(oSubaccount.services)) {
                    if (!mServiceMap[sSrvType]) {
                        // initialize row as empty array
                        const oSrvRow = {serviceName:oSrv.fullName, serviceInSubaccounts:[]};
                        mServiceMap[sSrvType] = oSrvRow; 
                        aAllServices.push(oSrvRow);
                        // first time seeing this service, prefill null ref for all subaccounts
                        for (var i = 0; i < oDir.subaccounts.length; i++) {
                            oSrvRow.serviceInSubaccounts.push(null); 
                        }
                    } 
                    mServiceMap[sSrvType].serviceInSubaccounts[iSaIndex] = oSrv;
                }
            }
            aAllServices.sort((a,b) => (a.serviceName > b.serviceName) ? 1 : ((b.serviceName > a.serviceName) ? -1 : 0))
        },
        /**
         * populate links json s4 systems into s4 table 
         */
        _fnPopulateS4Table(oS4, oTemplate) {
            const mS4ValueMap = Object.assign({},oS4.params); // temporary map of serviceType-> above service row
            for (const oPrject of oS4.projects) {
                for (const oProduct of oPrject.products) {
                    oProduct.tieredSystems = [];
                    // first time seeing this product, prefill null ref for all tiers
                    for (var i = 0; i < oPrject.tiers.length; i++) {
                        oProduct.tieredSystems.push(null); 
                    }
                    for (const oSystem of oProduct.systems) {
                        const iTierIndex = oPrject.tiers.indexOf(oSystem.tier); 
                        if (iTierIndex < 0) {
                            console.log("# tier ['"+oSystem.tier+"'] not found");          
                        }
                        if (!oProduct.tieredSystems[iTierIndex]) {
                            oProduct.tieredSystems[iTierIndex] = [];
                        }
                        const mSysValueMap = Object.assign({},mS4ValueMap);
                        for (const sKey in oSystem) {
                            if (sKey != "instances") 
                                mSysValueMap[sKey] = oSystem[sKey]; // add sys params, note s4 param with same name will be overwriten
                        }
                        if (!mSysValueMap.host)
                            mSysValueMap.host = mSysValueMap.sid; // by default assign sid as host name
                        this._fnRenderService("s4",oSystem,oTemplate,mSysValueMap);
                        oProduct.tieredSystems[iTierIndex].push(oSystem);
                    }
                }
            }
        },
        _fnHandleHashChange(event) {
            let sHash = window.location.hash ? window.location.hash.slice(1) : "";
            let sTab = sHash? sHash.split('/')[0] : "";
            if (!sTab || !sTab.match("^(BTP|S4)$")) {
                sHash = sTab = "BTP"; // set initial tab if none specified or matched
            }
            const oTabBtn = document.querySelector('a[data-bs-target="#pane-' + sTab + '"]');
            if (oTabBtn && !oTabBtn.classList.contains("active")) {
                oTabBtn.click();
            }
            const aSplitBtns = document.querySelectorAll("ul.nav-pills > li > a.dropdown-toggle-split");
            aSplitBtns.forEach(oBtn => {
                oBtn.classList.remove("active");
            });
            if (oTabBtn && oTabBtn.nextSibling && oTabBtn.nextSibling.classList.contains("dropdown-toggle-split")) {
                oTabBtn.nextSibling.classList.add("active");
            }
            if (sHash !== sTab) {
                // scroll to element
                const oSection = document.querySelector("h3[name='"+sHash+"']");
                if (oSection) {
                    document.removeEventListener('scroll', this._fnHandleScrollUpdateHeader);
                    oSection.scrollIntoView();
                    document.addEventListener("scrollend", this._fnHandleScrollEnd); // add fnScrollUpdateHeader after scrollend
        
                }
            }
        },
        _fnHandleScrollUpdateHeader(event) {
            const aHeaders = document.querySelectorAll('.nav-section');  
            for ( const oHeader of aHeaders) {
                const rect = oHeader.getBoundingClientRect();
                if(rect.top > 0 && rect.top < 100) {
                    const location = window.location.toString().split('#')[0];
                    history.replaceState(null, null, location + '#' + oHeader.getAttribute("name"));
                    break; // only update for 1st visible header
                }
            }
        },
        _fnHandleScrollEnd(event) {
            document.removeEventListener('scrollend', this._fnHandleScrollEnd);
            document.addEventListener('scroll', this._fnHandleScrollUpdateHeader);
        }        
    },
    updated: function() {
        // update tab selection in next tick (afer rendering)
        this.$nextTick(function () {
            if (this.listenerAttached)
                return; 
            this.listenerAttached = true;
            document.addEventListener('scroll', this._fnHandleScrollUpdateHeader);
            window.addEventListener("hashchange", this._fnHandleHashChange);
            this._fnHandleHashChange();
        });
    },
    mounted: function () {
        this.$nextTick(function () {
            // add tab handling functions
            const aTabBtns = document.querySelectorAll("ul.nav-pills > li > a");
            aTabBtns.forEach(oBtn => {
                oBtn.addEventListener('shown.bs.tab', function(e) {
                    var sId = e.target.getAttribute("data-bs-target").substr(6);
                    if (sId && (!window.location.hash || window.location.hash.indexOf(sId) < 0))
                        window.location.hash = sId;
                });
            });
            // initial update of tab selectioin
            this._fnHandleHashChange();
        });
    }
}).mount('#app')

app.fetch();
