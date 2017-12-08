"use strict"

function app_or_error(appkit, name, cb) {
  appkit.api.get('/apps/' + name, (err, app) => {
    if (err) {
      appkit.terminal.error(err);
    }
    else {
      cb(app);
    }
  });
}

function list_sites(appkit, args) {
  appkit.api.get('/sites', (err, data) => {
    if(err) {
      return appkit.terminal.error(err);
    } else {
      data.sort((x, y) => { 
        if(x.domain < y.domain) {
          return -1;
        } else {
          return 1;
        }
      }).forEach((site) => {
        console.log(appkit.terminal.markdown(`**⑆ ${site.domain} **
  ***Id:*** (${site.id})
  ***Created:*** ${(new Date(site.created_at)).toLocaleString()}
  ***Compliance:*** ${site.compliance.join(', ')}
  `));
      });
    }
  })
}

function create_site(appkit, args) {
  console.assert(args.DOMAIN && /^[a-z0-9-.]+$/i.test(args.DOMAIN), 'A domain name must only contain alphanumerics, periods and hyphens.');

  if (!args.region) {
    args.region = 'us-seattle'
  }

  let payload = {region: args.region.toLowerCase(), domain:args.DOMAIN.toLowerCase(), internal:args.internal}

  let task = appkit.terminal.task(`Creating site https://${args.DOMAIN}`);
  task.start();
  appkit.api.post(JSON.stringify(payload), '/sites',  (err, data) => {
    if(err) {
      task.end('error');
      return appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}

module.exports = {
  init(appkit) {
    const app = {
      'alias':'a',
      'demand':true,
      'string':true,
      'description':'The app to act on.'
    }, domain = {
      'alias':'d',
      'demand':true,
      'string':true,
      'description':'The domain for the site.'
    }, region = {
      'alias':'r',
      'demand':false,
      'string':true,
      'default':'us-seattle',
      'description':'The region (defaults to "us").'
    }, internal = {
      'boolean':true,
      'default':false,
      'demand':false,
      'alias':'i',
      'description':'Whether the site will host internal-only applications (defaults to false).'
    }
    appkit.args.command('sites', 'show site information.', {}, list_sites.bind(null, appkit))
    appkit.args.command('sites:create DOMAIN', 'create a site (domain) in the router.', {region, internal}, create_site.bind(null, appkit))
  },
  update() {
    // do nothing.
  },
  group:'sites',
  help:'view and create sites for routing to an app',
  primary:true
}