const util = require('util');
const assert = require('assert');

async function app_or_error(appkit, name) {
  return new Promise((resolve, reject) => {
    appkit.api.get(`/apps/${name}`, (err, app) => {
      if (err) {
        reject(err);
      } else {
        resolve(app);
      }
    });
  });
}

function clean_site(site) {
  site = site.trim();
  if (site.startsWith('https://')) {
    site = site.substring(8);
  }
  return site.replace(/\//g, '').toLowerCase();
}

function clean_forward_slash(url) {
  if (url[url.length - 1] === '/') {
    return url.substring(0, url.length - 1);
  }
  return url;
}

async function list_routes(appkit, args) {
  const get = util.promisify(appkit.api.get);
  let data = null;
  let subpath = '';

  if (
    (args.app && args.site) || (!args.site && !args.app)
    || (args.app && args.app === '')
    || (args.site && args.site === '')
  ) {
    appkit.terminal.error('Please specify either an app OR site (-a or -s).');
    return;
  }

  try {
    if (args.site) {
      if (!(/http(s)?:\/\//.test(args.site))) {
        args.site = `https://${args.site}`;
      }
      ({ hostname: args.site, pathname: subpath } = new URL(args.site));
      args.site = clean_site(args.site);
      data = await get(`/sites/${args.site}/routes`);
    } else {
      data = await get(`/apps/${args.app}/routes`);
    }

    if (!data || data.length === 0) {
      console.log(appkit.terminal.markdown('**===** There were no routes found.'));
      return;
    }

    const routes = data
      .sort((x, y) => (x.source_path < y.source_path ? -1 : 1))
      .filter((x) => x.source_path.startsWith(subpath));

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      // eslint-disable-next-line
      const app = await app_or_error(appkit, route.app.name);
      console.log(appkit.terminal.markdown(`**→ Route (${route.id})** ${appkit.terminal.friendly_date(new Date(route.created_at))}`));
      console.log(appkit.terminal.markdown(`  ##https://${clean_forward_slash(route.site.domain)}${route.source_path} ➝ ${clean_forward_slash(app.web_url)}${route.target_path}##`));
      if (i !== routes.length - 1) {
        console.log(); // don't add newline on last route
      }
    }
  } catch (e) {
    appkit.terminal.error(e);
  }
}

async function create_route(appkit, args) {
  if (!args.TARGET_PATH) {
    appkit.terminal.error('A target path is required.');
    return;
  }
  try {
    assert.ok(args.app && args.app !== '', 'Please specify an app.');
    assert.ok(args.site && /^[a-z0-9.-]+$/.test(args.site), 'Expected: A site ID or domain name.');
    assert.ok(args.SOURCE_PATH && /\/[a-zA-Z0-9_-]*/.test(args.SOURCE_PATH), 'SOURCE_PATH must start with a slash and afterward match /[a-zA-Z0-9_-]+/.');
    assert.ok(/\/[a-zA-Z0-9_-]*/.test(args.TARGET_PATH), 'TARGET_PATH must start with a slash and afterward match /[a-zA-Z0-9_-]+/.');
    args.site = clean_site(args.site);
    const payload = {
      app: args.app, site: args.site, source_path: args.SOURCE_PATH, target_path: args.TARGET_PATH,
    };
    const app_info = await app_or_error(appkit, args.app);
    const task = appkit.terminal.task(`Creating route https://${clean_forward_slash(args.site)}${args.SOURCE_PATH} ➝ ${clean_forward_slash(app_info.web_url)}${args.TARGET_PATH}`);
    task.start();
    appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/routes`, (err) => {
      if (err) {
        task.end('error');
        appkit.terminal.error(err);
      } else {
        task.end('ok');
      }
    });
  } catch (e) {
    appkit.terminal.error(e);
  }
}

function delete_route(appkit, args) {
  assert.ok(args.ID && args.ID !== '', 'Please specify a route ID.');

  const task = appkit.terminal.task(`Removing route ${args.ID}`);
  task.start();
  appkit.api.delete(`/routes/${args.ID}`, (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}

module.exports = {
  init(appkit) {
    const create_opts = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'ID or full app name',
      },
      site: {
        alias: 's',
        demand: true,
        string: true,
        description: 'ID or site name',
      },
      region: {
        alias: 'r',
        demand: false,
        string: true,
        default: 'us',
        description: 'The region (defaults to "us")',
      },
    };

    const query_opts = {
      app: {
        alias: 'a',
        demand: false,
        string: true,
        description: 'The app to query on',
      },
      site: {
        alias: 's',
        demand: false,
        string: true,
        description: 'The site to query on (ID or name)',
      },
    };

    appkit.args.command('routes', 'Show route information for an app.', query_opts, list_routes.bind(null, appkit));
    appkit.args.command('routes:create SOURCE_PATH TARGET_PATH', 'Route HTTPS traffic from a site to an app', create_opts, create_route.bind(null, appkit));
    appkit.args.command('routes:remove ID', 'Delete a route', {}, delete_route.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'routes',
  help: 'view and create routes for routing to an app',
  primary: true,
};
