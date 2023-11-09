const $ = sel => document.querySelector(sel);
const GET = (url) => axios.get(url);
const POST = (cmd,data) => axios.post(cmd,data);
// escaped CUSTOM_LINKS_PATH defined in env; to-be-replaced by approuter (see xs-app.json)
const CUSTOM_LINKS_PATH = `{{{CUSTOM_LINKS_PATH}}}`; 
// fall back to template links if CUSTOM_LINKS_PATH is not specified in env or default-env.json
const LINKS_PATH = CUSTOM_LINKS_PATH? CUSTOM_LINKS_PATH : "../assets/links-template.json";
const APP_VERSION = "v0.1";

const HOME_DATA = {
    appVer: APP_VERSION,
    linksVer: "N/A",
    btp: [],
    s4: [],
    footerLinks: [],
    templates: [],
    currentUser: {},
    listenerAttached: false
};

function HomeFooter() {
    return (
        <footer className="pt-4 my-md-5 pt-md-5 border-top">
            <div className="row">
                <div className="col-12 col-md">
                    <img className="mb-2" src="./assets/brand/sap-logo-svg.svg" alt="" width="65" height="34" />
                    <small className="d-block mb-3 text-body-secondary"><a className="link-secondary"
                        href="https://github.com/sap-pilot/btp-home#readme" target="_blank">BTP-Home
                        (ver)</a><br />&copy; SAP America Inc.</small>
                </div>
                <HomeFooterGroup />
            </div>
        </footer>
    );
}

function HomeFooterGroup() {
    return (
        <div className="col col-md" v-for="group in footerLinks">
            <h5>(group.groupName)</h5>
            <ul className="list-unstyled text-small">
                <HomeFooterLink />
            </ul>
        </div>
    );
}

function HomeFooterLink() {
    return (
        <li className="mb-1" v-for="link in group.links"><a className="link-secondary" href="link.url"
            target="_blank">(link.name)</a></li>
    );
}

const app = document.getElementById('app');
ReactDOM.render(<HomeFooter />, app);