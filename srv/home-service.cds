@path: '/home'
service HomeService @(requires: 'authenticated-user') {
    @cds.persistence.skip
    entity HomeContent {
        key id         : String;
            content    : String;
            updator    : String;
            updateTime : String;
    }
    action   updateHomeContent(homeContent : HomeContent) returns array of String;
    function getHomeContent()                             returns HomeContent;
}
