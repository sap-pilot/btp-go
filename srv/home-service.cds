@path: '/home'
service HomeService @(requires: 'authenticated-user') {
    @cds.persistence.skip
    entity HomeContent {
        key id         : String;
            content    : String;
            updator    : String;
            updateTime : String;
    }
    action   updateContent(homeContent : HomeContent) returns array of String;
    function getContent()                             returns HomeContent;
}
