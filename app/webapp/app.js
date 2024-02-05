const $ = sel => document.querySelector(sel);
const GET = (url) => axios.get(url);
const POST = (cmd, data) => axios.post(cmd, data);
const UPLOAD_PATH = "/srv/home/updateContent";
const READ_PATH = "/srv/home/getContent()";
const APP_VERSION = "v0.2.231128";

const homeApp = {
    run: async function () {
        // get data
        this.editorArea = document.getElementById("editorArea");
        this.saveBtn = document.getElementById("saveBtn");
        this.editorMode = this.editorArea? true: false;
        const { data } = await GET(READ_PATH);
        if (this.editorArea) {
            // fill in editor content
            this.editorArea.innerHTML = data.content;
            validateJSON();
        }
        this.handleData(JSON.parse(data.content));
    },
    handleData: function( data ) {
        this.data = data;
        this._processData();
        // render the app
        const app = document.getElementById('app');
        ReactDOM.render(<HomePage btp={this.data.btp} s4={this.data.s4} footerLinks={this.data.footerLinks} 
            version={APP_VERSION} editorMode={this.editorMode}/>, app);
        this.setupListeners();
    },
    _handleUpload: async function() {
        if (!homeApp.editorArea) {
            return false; // nothing to save
        }
        const newContent = homeApp.editorArea.value;
        const { data } = await POST(UPLOAD_PATH, { homeContent: { id: "newHomeContent", content: newContent}});
        console.log("upload completed, returned data: "+data.value);
        if (confirm("Update completed: "+data.value + " - Return to home page?")) {
            window.location.href = "index.html";
        }
    },
    _processData: function () {
        // apply template to services
        for (const ga of this.data.btp.globalAccounts) {
            for (const oDir of ga.directories) {
                for (const oSubaccount of oDir.subaccounts) {
                    // add default params
                    const mValueMap = {
                        globalAccountId: ga.id,
                        cockpitRegion: ga.cockpitRegion,
                        subaccountId: oSubaccount.id,
                        orgId: oSubaccount.orgId,
                        subdomain: oSubaccount.subdomain,
                        region: oSubaccount.region ? oSubaccount.region : oDir.region,
                        spaces: oSubaccount.spaces,
                        "int-regionPostfix": ga["int-regionPostfix"],
                        "int-cpiTenant": ga["int-cpiTenant"]
                    };
                    for (const sServiceKey in oSubaccount.services) {
                        const oSrv = oSubaccount.services[sServiceKey];
                        const oTemplate = this.data.templates[sServiceKey];
                        // loop through service parameters and add them to value map
                        for (const sParamKey in oSrv) {
                            if (sParamKey != "instances")
                                mValueMap[sServiceKey + "-" + sParamKey] = oSrv[sParamKey]; // add service params into value map
                        }
                        // render service
                        this._renderService(sServiceKey, oSrv, oTemplate, mValueMap);
                    }
                    // render cockpit
                    if (this.data.templates["cockpit"]) {
                        oSubaccount.cockpit = {};
                        this._renderService("cockpit", oSubaccount.cockpit, this.data.templates["cockpit"], mValueMap);
                    }
                } // end of subaccounts (oSubaccount)
                // populate services table within oDir
                this._populateServiceTable(oDir);
            } // end of oDirectories (oDir)
        } // end of global account (ga)
        this._populateS4Table(this.data.s4, this.data.templates["s4"]);
    },
    // replace variables in string
    _interpolateStr: function (sStr, mValueMap) {
        return sStr.replace(/{(.*?)}/g, (match, offset) => mValueMap[offset]);
    },
    /**  render service/s4  url and name by template and mValueMap */
    _renderService: function (sSrvKey, oSrv, oTemplate, mValueMap) {
        if (!oSrv.url && oTemplate.url) // service url overwrites template url (likewise for below name and fullname)
            oSrv.url = this._interpolateStr(oTemplate.url, mValueMap)
        if (!oSrv.name && oTemplate.name)
            oSrv.name = this._interpolateStr(oTemplate.name, mValueMap);
        if (!oSrv.fullName && oTemplate.fullName)
            oSrv.fullName = oTemplate.fullName;
        else
            oSrv.fullName = oSrv.name;
        if (oTemplate.children) {
            // also render children
            oSrv.children = oSrv.children ? oSrv.children : [];
            for (const oTemplateChild of oTemplate.children) {
                if (oTemplateChild.repeatOn == "instances") {
                    // apply this oTemplateChild to all oSrv instances  
                    if (!oSrv.instances)
                        continue;
                    for (const oSrvInst of oSrv.instances) {
                        const instChild = Object.assign({}, oSrvInst);
                        // build instValueMap
                        const instValueMap = Object.assign({}, mValueMap);
                        for (const pk in oSrvInst) {
                            if (pk != "instances")
                                instValueMap[sSrvKey + "-" + pk] = oSrvInst[pk]; // add service instance params, note service param with same name will be overwriten
                        }
                        // render service instance
                        this._renderService(sSrvKey, instChild, oTemplateChild, instValueMap);
                        oSrv.children.push(instChild);
                    }
                } else if (oTemplateChild.repeatOn == "spaces") {
                    // apply this oTemplateChild to all spaces
                    const aSpaces = mValueMap['spaces'];
                    if (!aSpaces || aSpaces.length == 0)
                        continue;
                    for (const oSpace of aSpaces) {
                        // copy space info first 
                        const oSpaceChild = Object.assign({}, oSpace);
                        // build instValueMap
                        const oSpaceValueMap = Object.assign({}, mValueMap);
                        for (const pk in oSpaceChild) {
                            oSpaceValueMap[pk] = oSpace[pk]; // add space params
                        }
                        // render service instance
                        this._renderService(sSrvKey, oSpaceChild, oTemplateChild, oSpaceValueMap);
                        oSrv.children.push(oSpaceChild);
                    }
                } else {
                    // render single item (not related to instances)
                    const oSrvChild = {};
                    this._renderService(sSrvKey, oSrvChild, oTemplateChild, mValueMap); // render as menu item 
                    oSrv.children.push(oSrvChild);
                }
            }
            // remove first or last dividers if they present
            if (oSrv.children.length > 0 && oSrv.children[oSrv.children.length - 1].name == '-')
                oSrv.children.pop();
            if (oSrv.children.length > 0 && oSrv.children[0].name == '-')
                oSrv.children.shift();
        }
    },
    /** populate service table in specified directory (oDir) like this: 
     *     aAllServices[] -> {serviceName,serviceInSubaccounts[]}  */
    _populateServiceTable: function (oDir) {
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
                    const oSrvRow = { serviceName: oSrv.fullName, serviceInSubaccounts: [] };
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
        aAllServices.sort((a, b) => (a.serviceName > b.serviceName) ? 1 : ((b.serviceName > a.serviceName) ? -1 : 0))
    },
    /**
     * populate links json s4 systems into s4 table 
     */
    _populateS4Table: function (oS4, oTemplate) {
        const mS4ValueMap = Object.assign({}, oS4.params); // temporary map of serviceType-> above service row
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
                        console.log("# tier ['" + oSystem.tier + "'] not found");
                    }
                    if (!oProduct.tieredSystems[iTierIndex]) {
                        oProduct.tieredSystems[iTierIndex] = [];
                    }
                    const mSysValueMap = Object.assign({}, mS4ValueMap);
                    for (const sKey in oSystem) {
                        if (sKey != "instances")
                            mSysValueMap[sKey] = oSystem[sKey]; // add sys params, note s4 param with same name will be overwriten
                    }
                    if (!mSysValueMap.host)
                        mSysValueMap.host = mSysValueMap.sid; // by default assign sid as host name
                    this._renderService("s4", oSystem, oTemplate, mSysValueMap);
                    oProduct.tieredSystems[iTierIndex].push(oSystem);
                }
            }
        }
    },
    _handleHashChange(event) {
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
                document.removeEventListener('scroll', this._handleScrollUpdateHeader);
                oSection.scrollIntoView();
                document.addEventListener("scrollend", this._handleScrollEnd); // add fnScrollUpdateHeader after scrollend
    
            }
        }
    },
    _handleScrollUpdateHeader: function(event) {
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
    _handleScrollEnd(event) {
        document.removeEventListener('scrollend', this._handleScrollEnd);
        document.addEventListener('scroll', this._handleScrollUpdateHeader);
    },
    _handleEditorInput(event) {
        if (!validateJSON()) {
            return; // invalid JSON
        }
        const newText = homeApp.editorArea.value;
        let newData = null;
        try {
            newData = JSON.parse(newText);
        } catch (e) {
            return;
        }
        if (newData) {
            homeApp.handleData(newData);
        }
    },
    setupListeners: function() {
        if (this.listenerAttached)
            return; 
        this.listenerAttached = true;
        const aTabBtns = document.querySelectorAll("ul.nav-pills > li > a");
        aTabBtns.forEach(oBtn => {
            oBtn.addEventListener('shown.bs.tab', function(e) {
                var sId = e.target.getAttribute("data-bs-target").substr(6);
                if (sId && (!window.location.hash || window.location.hash.indexOf(sId) < 0))
                    window.location.hash = sId;
            });
        });
        document.addEventListener('scroll', this._handleScrollUpdateHeader);
        window.addEventListener("hashchange", this._handleHashChange);
        this._handleHashChange();
        window.dispatchEvent(new Event("ZPageRendered"));
        if (this.editorArea) {
            this.editorArea.addEventListener("input", this._handleEditorInput);
        }
        if (this.saveBtn) {
            this.saveBtn.addEventListener("click", this._handleUpload);
        }
    }
};

function HomePage({ btp, s4, footerLinks, version, editorMode }) {
    return (
        <>
            <HomeIcons />
            <div className="container py-3">
                <HomeHeader btp={btp} s4={s4} editorMode={editorMode} />
                <main className="tab-content">
                    <HomeBtpTabPane btp={btp} />
                    <HomeS4TabPane s4={s4} />
                </main>
                <HomeFooter footerLinks={footerLinks} version={version} />
            </div>
        </>
    );
}

function HomeIcons() {
    return (
        <>
            <svg xmlns="http://www.w3.org/2000/svg" className="d-none">
                <symbol id="check2" viewBox="0 0 16 16">
                    <path
                        d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </symbol>
                <symbol id="circle-half" viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 0 8 1v14zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16z" />
                </symbol>
                <symbol id="moon-stars-fill" viewBox="0 0 16 16">
                    <path
                        d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
                    <path
                        d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L13.863.1z" />
                </symbol>
                <symbol id="sun-fill" viewBox="0 0 16 16">
                    <path
                        d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z" />
                </symbol>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" className="d-none">
                <symbol id="check" viewBox="0 0 16 16">
                    <title>Check</title>
                    <path
                        d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </symbol>
            </svg>
        </>
    );
}

function HomeHeader({ btp, s4, editorMode }) {
    const navbarRight = editorMode? null : (
        <nav className="d-inline-flex mt-2 mt-md-0 ms-md-auto">
            <a className="me-3 py-2 link-body-emphasis text-decoration-none" href="#">Welcome</a>
            <div className="dropdown bd-mode-toggle">
                <button className="btn py-2 dropdown-toggle d-flex align-items-center" id="bd-theme" type="button"
                    aria-expanded="false" data-bs-toggle="dropdown" aria-label="Toggle theme (auto)">
                    <svg className="bi my-1 theme-icon-active" width="1em" height="1em">
                        <use href="#circle-half"></use>
                    </svg>
                    <span className="visually-hidden" id="bd-theme-text">Toggle theme</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow" aria-labelledby="bd-theme-text">
                    <li>
                        <button type="button" className="dropdown-item d-flex align-items-center" data-bs-theme-value="light"
                            aria-pressed="false">
                            <svg className="bi me-2 opacity-50 theme-icon" width="1em" height="1em">
                                <use href="#sun-fill"></use>
                            </svg>
                            Light
                            <svg className="bi ms-auto d-none" width="1em" height="1em">
                                <use href="#check2"></use>
                            </svg>
                        </button>
                    </li>
                    <li>
                        <button type="button" className="dropdown-item d-flex align-items-center" data-bs-theme-value="dark"
                            aria-pressed="false">
                            <svg className="bi me-2 opacity-50 theme-icon" width="1em" height="1em">
                                <use href="#moon-stars-fill"></use>
                            </svg>
                            Dark
                            <svg className="bi ms-auto d-none" width="1em" height="1em">
                                <use href="#check2"></use>
                            </svg>
                        </button>
                    </li>
                    <li>
                        <button type="button" className="dropdown-item d-flex align-items-center active" data-bs-theme-value="auto"
                            aria-pressed="true">
                            <svg className="bi me-2 opacity-50 theme-icon" width="1em" height="1em">
                                <use href="#circle-half"></use>
                            </svg>
                            Auto
                            <svg className="bi ms-auto d-none" width="1em" height="1em">
                                <use href="#check2"></use>
                            </svg>
                        </button>
                    </li>
                </ul>
            </div>
            <a className="me-3 py-2 link-body-emphasis" title="Editor" href="editor.html">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pencil-square" viewBox="0 0 16 16">
                    <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                    <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z" />
                </svg>
            </a>
        </nav>
    );
    return (
        <header>
            <div className="d-flex flex-column flex-md-row align-items-center pb-3 mb-4 border-bottom">
                <ul key="headerMenuNav" className="nav nav-pills">
                    <li key="btp" className="btn-group">
                        <a className="btn nav-link pe-0" id="btp-tab" data-bs-toggle="tab" data-bs-target="#pane-BTP" role="tab"
                            aria-controls="pane-BTP">BTP</a>
                        <a className="btn nav-link dropdown-toggle dropdown-toggle-split" role="tab" data-bs-toggle="dropdown"
                            aria-expanded="false">
                            <span className="visually-hidden">Toggle Dropdown</span>
                        </a>
                        <ul className="dropdown-menu">
                            {(btp.globalAccounts || []).map((globalAccount, gi) => (
                                <React.Fragment key={globalAccount.name}>
                                    {(globalAccount.directories || []).map((dir, di) => (
                                        <HomeHeaderMenuItem key={dir.short} href={'#BTP/' + dir.short} label={dir.name + ' (' + dir.short + ')'} />
                                    ))}
                                </React.Fragment>
                            ))}
                        </ul>
                    </li>
                    <li key="s4" className="btn-group">
                        <a className="btn nav-link pe-0" id="s4-tab" data-bs-toggle="tab" data-bs-target="#pane-S4" role="tab"
                            aria-controls="pane-S4">S/4HANA</a>
                        <a className="btn nav-link dropdown-toggle dropdown-toggle-split" role="tab" data-bs-toggle="dropdown"
                            aria-expanded="false">
                            <span className="visually-hidden">Toggle Dropdown</span>
                        </a>
                        <ul className="dropdown-menu">
                            {(s4.projects || []).map((prj) => (
                                <HomeHeaderMenuItem key={prj.short} href={'#S4/' + prj.short} label={prj.name + ' (' + prj.short + ')'} />
                            ))}
                        </ul>
                    </li>
                </ul>
                {navbarRight}
            </div>
        </header>
    );
}

function HomeHeaderMenuItem({ href, label }) {
    return (
        <li key={label}><a className="dropdown-item" href={href}>{label}</a></li>
    );
}

function HomeBtpTabPane({ btp }) {
    return (
        <div key="pane-BTP" id="pane-BTP" name="BTP" className="tab-pane fade nav-section" role="tabpanel" aria-labelledby="home-tab"
            tabIndex="0">
            {(btp.globalAccounts || []).map((globalAccount) => (
                <React.Fragment key={globalAccount.name}>
                    {(globalAccount.directories || []).map((dir) => (
                        <HomeBtpTabSection key={dir.short} dir={dir} />
                    ))}
                </React.Fragment>
            ))}
        </div>
    );
}

function HomeBtpTabSection({ dir }) {
    return (
        <>
            <h3 name={'BTP/' + dir.short} className="display-6 text-center mb-4 nav-section">{dir.name} ({dir.short})</h3>
            <div className="row text-center">
                {(dir.subaccounts || []).map((subaccount) => (
                    <HomeBtpSubaccountCard key={subaccount.name} dir={dir} subaccount={subaccount} />
                ))}
            </div>
        </>       
    );
}

function HomeBtpSubaccountCard({ dir, subaccount }) {
    const notePill = (subaccount.note?(
        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-info">
            {subaccount.note}
            <span className="visually-hidden">planned</span>
        </span>
    ):null);
    return (
        <div className="col">
            <div className={`card mb-4 rounded-3 shadow-sm ${ subaccount.usage === 'prod'? 'border-primary':''} ${ subaccount.state === 'na'? 'opacity-50':''} `}>
                {notePill}
                <div className={`card-header py-3 ${ subaccount.usage === 'prod'? 'text-bg-primary border-primary':''}`}>
                    <h4 className="my-0 fw-normal">{dir.short} {subaccount.name}</h4>
                </div>
                <div className="card-body">
                    <ul className="list-unstyled mb-2">
                        {(Object.values(subaccount.services || {}) || []).map((service) => (
                            <HomeBtpSubaccountService key={service.name} service={service} />
                        ))}
                    </ul>
                    <HomeBtpSubaccountCockpit cockpit={subaccount.cockpit} />
                </div>
            </div>
        </div>
    );
}

function HomeBtpSubaccountService({ service }) {
    if ( !service.children || service.children === 0 ) {
        // single service link without children
        return (
            <li><a href={service.url} target="_blank" className="link-body-emphasis" >{service.name}</a></li>
        );
    } else {
        // service link with children
        return (
            <li className="btn-group py-0">
                <a href={service.url} title={service.fullName} target="_blank" className="btn link-body-emphasis py-0 pe-1 zc-dropdown" >{service.name}</a>
                <a type="button"
                className="btn py-0 ps-1 zc-dropdown link-secondary dropdown-toggle dropdown-toggle-split"
                data-bs-toggle="dropdown" aria-expanded="false">
                <span className="visually-hidden">Toggle Dropdown</span>
                </a>
                <ul className="dropdown-menu">
                    {(service.children || []).map((serviceChild, idx) => (
                        <HomeBtpSubaccountServiceChild key={serviceChild.name+'-'+idx} serviceChild={serviceChild} />
                    ))}
                </ul>
            </li>
        );
    }
}

function HomeBtpSubaccountServiceChild({ serviceChild }) {
    if ( serviceChild.name === '-' ) {
        // seperator
        return (
            <li><hr className="dropdown-divider" /></li>
        );
    } else {
        return (
            <li><a href={serviceChild.url} title={serviceChild.fullName} target="_blank" className="dropdown-item">{serviceChild.name}</a></li>
        );
    }
}

function HomeBtpSubaccountCockpit({ cockpit }) {
    if ( !cockpit ) {
        return null;
    }
    return (
        <div className="btn-group w-100">
            <a href={cockpit.url} target="_blank" type="button" className="btn btn-sm w-100 btn-outline-primary">Cockpit</a>
            <button type="button"
            className="btn btn-sm dropdown-toggle dropdown-toggle-split btn-outline-primary"
            data-bs-toggle="dropdown" aria-expanded="false">
            <span className="visually-hidden">Toggle Dropdown</span>
            </button>
            <ul className="dropdown-menu">
                {(cockpit.children || []).map((cockpitItem, idx) => (
                    <HomeDropdownMenuItem key={cockpitItem.name+'-'+idx} menuItem={cockpitItem} />
                ))}
            </ul>
        </div>
    );
}

function HomeDropdownMenuItem({ menuItem }) {
    if ( !menuItem ) {
        return null;
    } else if ( menuItem.name === '-' ) {
        // seperator
        return (
            <li><hr className="dropdown-divider" /></li>
        );
    } else {
        if ( !menuItem.children || menuItem.children.length === 0 ) {
            // single menu item
            return (
                <li><a href={menuItem.url} title={menuItem.fullName} target="_blank" className="dropdown-item">{menuItem.name}</a></li>
            );
        } else {
            // menu item with children
            return (
                <li className="btn-group w-100 dropdown dropend">
                    <a href={menuItem.url} title={menuItem.fullName} target="_blank" className="btn dropdown-item w-100">{menuItem.name}</a>
                    <a type="button" className="btn dropdown-toggle dropdown-toggle-split"
                        data-bs-toggle="dropdown" aria-expanded="false" href="#">
                        <span className="visually-hidden">Toggle Dropdown</span>
                    </a>
                    <ul className="dropdown-menu">
                        {(menuItem.children || []).map((childItem, idx) => (
                            <HomeDropdownMenuItem key={childItem.name+'-'+idx} menuItem={childItem} />
                        ))}
                    </ul>
                </li>
            );
        }
    }
}

function HomeS4TabPane({ s4 }) {
    return (
        <div id="pane-S4" name="S4" className="tab-pane fade hide nav-section" role="tabpanel" aria-labelledby="s4-tab"
        tabIndex="1">
            {(s4.projects || []).map((project, idx) => (
                <HomeS4ProjectSection key={project.name+'-'+idx} project={project} />
            ))}
        </div>
    );
}

function HomeS4ProjectSection({ project }) {
    return (
        <>
            <h3 name={'S4/' + project.short} className="display-6 text-center mb-4 nav-section">{project.name}</h3>
            <div className="table-responsive">
                <table className="table text-center table-striped">
                    <thead>
                        <tr>
                            <th></th>
                            {(project.tiers || []).map((tier, idx) => (
                                <th key={tier}>{tier}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                    {(project.products || []).map((prd, idx) => (
                        <tr key={prd.name+'-'+idx}>
                            <td>{prd.name}</td>
                            {(prd.tieredSystems || []).map((ts, idx) => (
                                <td key={idx}>
                                    {(ts || []).map((sys, idx) => (
                                        <HomeS4ProjecSystemLink key={sys.name+'-'+idx} sys={sys} />
                                    ))}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function HomeS4ProjecSystemLink({ sys }) {
    if (!sys.children || sys.children.length == 0) {
        // single system link
        return (
            <>            
                <a href={sys.url} title={sys.name} target="_blank" className="link-body-emphasis">{sys.name}</a><br />
            </>
        );
    }
    else {
        // system link with dropdown
        return (
            <>
                <div className="btn-group p-0" style="margin-left: 14px">
                    <a href={sys.url} title={sys.fullName} target="_blank" className="btn link-body-emphasis py-0 pe-1 zh-24" > {sys.name}</a>
                    <a type="button"
                        className="btn py-0 ps-1 zh-24 link-secondary dropdown-toggle dropdown-toggle-split"
                        data-bs-toggle="dropdown" aria-expanded="false">
                        <span className="visually-hidden">Toggle Dropdown</span>
                    </a>
                    <ul className="dropdown-menu">
                    {(sys.children || []).map((serviceChild, idx) => (
                        <li key={idx}>
                        (serviceChildname ==='-'? <hr className="dropdown-divider" /> : 
                            <a href={serviceChild.url} title={serviceChild.fullName} target="_blank" className="dropdown-item">{serviceChild.name}</a>
                        )
                        </li>
                    ))}
                    </ul>
                </div>
            </>
        );
    }
}

function HomeFooter({ footerLinks, version }) {
    return (
        <footer className="pt-4 my-md-5 pt-md-5 border-top">
            <div className="row">
                <div className="col-12 col-md">
                    <img className="mb-2" src="./assets/brand/sap-logo-svg.svg" alt="" width="65" height="34" />
                    <small className="d-block mb-3 text-body-secondary"><a className="link-secondary"
                        href="https://github.com/sap-pilot/btp-home#readme" target="_blank">BTP-Home 
                        ({version})</a><br />&copy; SAP America Inc.</small>
                </div>
                {(footerLinks || []).map((group, idx) => (
                    <HomeFooterGroup key={group.groupName+'-'+idx} group={group} />
                ))}
            </div>
        </footer>
    );
}

function HomeFooterGroup({ group }) {
    return (
        <div className="col col-md" v-for="group in footerLinks">
            <h5>{group.groupName}</h5>
            <ul group="list-unstyled text-small">
                {(group.links || []).map((link, idx) => (
                    <HomeFooterLink key={link.name+'-'+idx} link={link} />
                ))}
            </ul>
        </div>
    );
}

function HomeFooterLink({ link }) {
    return (
        <li key={link.name} className="mb-1" v-for="link in group.links"><a className="link-secondary" href={link.url}
            target="_blank">{link.name}</a></li>
    );
}

homeApp.run();