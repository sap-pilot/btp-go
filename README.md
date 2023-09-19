# btp-go
BTP home page of links to services group by directory (project) and subaccount

## Quick Start

To test this app locally in VSCode or BAS, execute below command to run approuter on port 3010 (or any other unoccupied port):

```
npm install
cd app
npm install
PORT=3010 npm start
```

To build & deploy this app to your Cloud Foundry enviornment, execute commands, this will deploy the app and create a route like https://<THIS_APP_HOSTNAME>.<YOUR_DOMAIN>

```
cf login
npm run bd
cf create-route <YOUR_DOMAIN> --hostname <THIS_APP_HOSTNAME>
cf map-route btp-go <YOUR_DOMAIN> --hostname <THIS_APP_HOSTNAME>
```

## Customize


### Custom Links

To customize the links, edit /app/webapp/data/links-cvx.json, the file has below structure, update and repeat as you see fit: 

```
{
    "btp": {
        "globalAccounts": [
            {
                "id": "<YOUR_GLOBAL_ACCOUNT_ID>",
                "name": "<YOUR_CUSTOMER_NAME>",
                "cockpitRegion": "amer",
                "directories": [
                    {
                        "name": "<YOUR_SUBACCOUNT_DIRECTORY_NAME}",
                        "short": "USE",
                        "region": "us10",
                        "subaccounts": [
                            {
                                "id": "<SUBACCOUNT_ID>",
                                "name": "Sandbox",
                                "subdomain": "<SUBDOMAIN>",
                                "services": {
                                    "<SERVICE_NAME>": {
                                        "<SERVICE_PARAM>": "<SERVICE_PARAM_VALUE>"
                                    },
                                    "hana": {
                                        "id": "<HANA_INSTANCE_ID>"
                                    },
                                    "spa": {},
                                    "wfm": {}
                                }
                            }
                        ]
                    }
                ]
            }
        ]
    },
    "s4": {
        "params": {
            "domain": "<YOUR_S4_HOST_DOMAIN>",
            "port": "<YOUR_S4_DEFAULT_PORT>"
        },
        "projects": [
            {
                "name": "<YOUR_S4_PROJECT_NAME>",
                "tiers": [
                    "Sandbox",
                    "Dev",
                    "Staging",
                    "PreProd",
                    "Prod"
                ],
                "products": [
                    {
                        "name": "S/4HANA",
                        "systems": [
                            {
                                "sid": "SB1",
                                "client": "100",
                                "tier": "Sandbox"
                            },
                            {
                                "sid": "DE1",
                                "client": "100",
                                "tier": "Dev"
                            }
                        ]
                    }
                ]
            }
        ]
    }, 
    "footerLinks": [
        {
            "groupName": "BTP Info",
            "links": [
                {
                    "name": "BTP Overview",
                    "url": "<YOUR_LINK>"
                },
                {
                    "name": "BTP Subaccount Landscape",
                    "url": "<YOUR_LINK>"
                }
            ]
        }
    ],
    "template": {
        "abap": {
            "name": "ABAP Cloud",
            "url": "https://{abap-id}.abap-web.{region}.hana.ondemand.com/ui#Shell-home"
        }
    }
}
```

### Customize Web Page

Check /app/webapp/index.html written in [Vue](https://vuejs.org/). 

### Customize Login

Check /app/xs-app.json for login setting, you can change the app to no authentication (update "authenticationMethod" to "none") and change session timeout ("sessionTimeout" in minutes, currently set to 1 day).

```
{
    "welcomeFile": "index.html",
    "authenticationMethod": "route",
    "sessionTimeout": 1440,
    "routes": [
        {
            "source": "^/user-api(.*)$",
            "target": "$1",
            "service": "sap-approuter-userapi",
            "authenticationType": "xsuaa"
        },
        {
            "source": "^/(.*)$",
            "target": "$1",
            "localDir": "webapp",
            "authenticationType": "xsuaa"
        }
    ]
}
```

## Contact & Support

Create issue below for support. Thanks for considering this repo. 
https://github.com/sap-pilot/btp-go/issues