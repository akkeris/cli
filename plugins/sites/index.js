const assert = require('assert');

// function app_or_error(appkit, name, cb) {
//   appkit.api.get(`/apps/${name}`, (err, app) => {
//     if (err) {
//       appkit.terminal.error(err);
//     } else {
//       cb(app);
//     }
//   });
// }

function list_sites(appkit) {
  appkit.api.get('/sites', (err, data) => {
    if (err) {
      appkit.terminal.error(err);
    } else {
      data.sort((x, y) => {
        if (x.domain < y.domain) {
          return -1;
        }
        return 1;
      }).forEach((site) => {
        console.log(appkit.terminal.markdown(`**⑆ ${site.domain} **
  ***Id:*** (${site.id})
  ***Created:*** ${(new Date(site.created_at)).toLocaleString()}
  ***Compliance:*** ${site.compliance.join(', ')}
  `));
      });
    }
  });
}

function create_site(appkit, args) {
  assert.ok(args.DOMAIN && /^[a-z0-9-.]+$/i.test(args.DOMAIN), 'A domain name must only contain alphanumerics, periods and hyphens.');

  if (!args.region) {
    args.region = 'us-seattle';
  }

  const payload = { region: args.region.toLowerCase(), domain: args.DOMAIN.toLowerCase(), internal: args.internal };

  const task = appkit.terminal.task(`Creating site https://${args.DOMAIN}`);
  task.start();
  appkit.api.post(JSON.stringify(payload), '/sites', (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}

function site_or_error(appkit, domain, cb) {
  appkit.api.get(`/sites/${domain}`, (err, site) => {
    if (err) {
      appkit.terminal.error(err);
    } else {
      cb(site);
    }
  });
}


function delete_site(appkit, args) {
  assert.ok(args.site && args.site !== '', 'An site name was not provided.');
  site_or_error(appkit, args.site, (site) => {
    const del = (input) => {
      if (input === site.domain) {
        const task = appkit.terminal.task(`Destroying **⬢ ${site.domain}** (including all routes)`);
        task.start();
        appkit.api.delete(`/sites/${args.site}`, (err) => {
          if (err) {
            task.end('error');
            appkit.terminal.error(err);
            return;
          }
          task.end('ok');
        });
      } else {
        appkit.terminal.soft_error(`Confirmation did not match !!${site.domain}!!. Aborted.`);
      }
    };
    if (args.confirm === true) {
      del(args.site);
    } else {
      appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete **⬢ ${site.domain}** including all routes.\n ~~▸~~    To proceed, type !!${site.domain}!!\n`, del);
    }
  });
}

module.exports = {
  init(appkit) {
    const create_sites_options = {
      region: {
        alias: 'r',
        demand: false,
        string: true,
        default: 'us-seattle',
        description: 'The region to place the site in',
      },
      internal: {
        boolean: true,
        default: false,
        demand: false,
        alias: 'i',
        description: 'Only host internal-only applications',
      },
    };
    const destroy_site_option = {
      site: {
        alias: 's',
        demand: true,
        string: true,
        description: 'The site to destroy.',
      },
      confirm: {
        alias: 'c',
        demand: false,
        boolean: true,
        description: 'Confirm (in advance) the name of the site to destroy.',
      },
    };
    appkit.args.command('sites', 'Show site information', {}, list_sites.bind(null, appkit));
    appkit.args.command('sites:create DOMAIN', 'Create a site (domain) in the Akkeris router', create_sites_options, create_site.bind(null, appkit));
    appkit.args.command('sites:destroy', 'delete a site', destroy_site_option, delete_site.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'sites',
  help: 'view and create sites for routing to an app',
  primary: true,
};
