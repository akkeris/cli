const assert = require('assert');
const proc = require('child_process');
const fs = require('fs');
const rand = require('./random.js');

const isWindows = process.platform === 'win32';

function format_app(app) {
  return `**⬢ ${app.name}** ${app.preview ? '- ^^preview^^' : ''}
  ***Url:*** ${app.web_url}
  ${app.git_url ? (`***😸  GitHub:*** ${app.git_url} \n`) : ''}`;
}

function app_or_error(appkit, name, cb) {
  appkit.api.get(`/apps/${name}`, (err, app) => {
    if (err) {
      appkit.terminal.error(err);
    } else {
      cb(app);
    }
  });
}

async function create(appkit, args) {
  if (!args.NAME) {
    args.NAME = rand.name() + Math.floor(Math.random() * 10000);
  }

  const task = appkit.terminal.task(`Creating app **⬢ ${args.NAME}-${args.space}**`);
  task.start();

  const payload = {
    space: args.space,
    name: args.NAME,
    org: args.org,
    description: args.description || undefined,
  };

  try {
    const app = await appkit.api.post(JSON.stringify(payload), '/apps');
    await appkit.api.post(JSON.stringify({ app: `${args.NAME}-${args.space}` }), '/favorites');
    task.end('ok');
    console.log(appkit.terminal.markdown(`##${app.web_url}##`));
  } catch (err) {
    task.end('error');
    appkit.terminal.error(err);
  }
}

function filter_by(args, next_cmd, err, data) {
  if (data && args.space) {
    data = data.filter((datum) => args.space === datum.space.name || args.space === datum.space.id);
  }
  if (data && args.repo) {
    data = data.filter((datum) => (datum.git_url && datum.git_url.includes(args.repo)));
  }
  if (data && args.name) {
    data = data.filter((datum) => (datum.name && datum.name.includes(args.name)));
  }
  if (data && args.org) {
    data = data.filter((datum) => (
      datum.organization && datum.organization.name && datum.organization.name.includes(args.org)
    ));
  }
  next_cmd(err, data);
}

function favorites(appkit, args) {
  appkit.api.get('/favorites',
    filter_by.bind(null, args, appkit.terminal.format_objects.bind(null, format_app,
      appkit.terminal.markdown('###===### No apps were found.'))));
}

function favorite(appkit, args) {
  const task = appkit.terminal.task(`Adding app **⬢ ${args.app}** to favorites`);
  task.start();
  const payload = { app: args.app };
  appkit.api.post(JSON.stringify(payload), '/favorites', (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
      return;
    }
    task.end('ok');
  });
}

function unfavorite(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  const task = appkit.terminal.task(`Removing **⬢ ${args.app}** from favorites`);
  task.start();
  appkit.api.delete(`/favorites/${args.app}`, (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
      return;
    }
    task.end('ok');
  });
}

function fork(appkit, args) {
  const task = appkit.terminal.task(`Copying **⬢ ${args.NAME}** to ${args.to}`);
  task.start();
  appkit.api.get(`/apps/${args.NAME}/app-setups`, (err, definition) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
      return;
    }
    const app = args.to.split('-');
    const app_name = app[0];
    const space_name = app.slice(1).join('-');
    definition.app.name = app_name;
    definition.app.space = space_name;
    if (args.organization) {
      definition.app.org = args.organization;
    }
    appkit.api.post(JSON.stringify(definition), '/app-setups', (error) => {
      if (error) {
        task.end('error');
        appkit.terminal.error(error);
        return;
      }
      task.end('ok');
    });
  });
}


function update_blueprint(args, b) {
  const bp = JSON.parse(JSON.stringify(b));
  if (args.logo) {
    bp.logo = args.logo;
  }
  if (args.name) {
    bp.name = args.name;
  }
  if (args['success-url']) {
    bp.success_url = args['success-url'];
  }
  if (args.env && Array.isArray(args.env)) {
    args.env.forEach((env) => {
      if (bp.env[env]) {
        delete bp.env[env].value;
        bp.env[env].required = true;
      } else {
        bp.env[env] = { required: true, description: '' };
      }
    });
  }
  return bp;
}

function blueprint(appkit, args) {
  appkit.api.get(`/apps/${args.app}/app-setups`, (err, definition) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    console.log(JSON.stringify(update_blueprint(args, definition), null, 2));
  });
}

function oneclick(appkit, args) {
  try {
    assert.ok(args.app || args.file, 'Either an app or a file is required.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  if (args.app) {
    appkit.api.get(`/apps/${args.app}/app-setups`, (err, definition) => {
      if (err) {
        appkit.terminal.error(err);
        return;
      }
      console.log(`https://<akkeris ui host>/app-setups?blueprint=${encodeURIComponent(JSON.stringify(update_blueprint(args, definition)))}`);
    });
  } else {
    try {
      let bp = JSON.parse(fs.readFileSync(args.file).toString('utf8'));
      bp = encodeURIComponent(JSON.stringify(bp));
      console.log(`https://<akkeris ui host>/app-setups?blueprint=${bp}`);
    } catch (e) {
      appkit.terminal.error('The specified file didn\'t exist or wasn\'t a valid JSON file.');
    }
  }
}

async function info(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const app = await appkit.api.get(`/apps/${args.app}`);

    let pipeline;
    try {
      pipeline = await appkit.api.get(`/apps/${args.app}/pipeline-couplings`);
    } catch (err) {
      if (err.code !== 404) {
        throw err;
      }
    }

    const ui = require('cliui')();

    const md = (s) => appkit.terminal.markdown(s);
    const bld = (s) => md(appkit.terminal.bold(s));
    const ital = (s) => md(appkit.terminal.italic(s));

    const label = (s) => ({ text: md(`**${s}**`), width: 20 });
    const shortLabel = (s) => ({ text: md(`**${s}**`), width: 10 });

    ui.div();
    ui.div(bld(`###===### **⬢ ${app.name}** ${app.preview ? '- ^^preview^^' : ''} ###===###`));
    ui.div(label('ID:'), app.id);
    ui.div(label('Description:'), app.description);
    ui.div(label('Organization:'), app.organization.name);
    ui.div(label('Region:'), app.region.name);
    ui.div(label('Current Image:'), app.image);
    ui.div(label('Git:'), `${app.git_url}${app.git_branch ? (`#${app.git_branch}`) : ''}`);
    ui.div(label('Service ENV:'), `${app.simple_name.toUpperCase()}_SERVICE_HOST, ${app.simple_name.toUpperCase()}_SERVICE_PORT`);
    ui.div(label('Pipeline:'), pipeline ? `${pipeline.pipeline.name} - ${pipeline.stage}` : '');
    ui.div(label('Last Released:'), app.released_at ? new Date(app.released_at).toLocaleString() : 'Never');
    ui.div(label('URL:'), app.web_url);
    ui.div();
    ui.div(('Additional Commands'));
    ui.div(shortLabel('Addons:'), ital(`aka addons -a ${app.name}`));
    ui.div(shortLabel('Config:'), ital(`aka config -a ${app.name}`));
    ui.div(shortLabel('Dynos:'), ital(`aka ps -a ${app.name}`));
    ui.div(shortLabel('Logs:'), ital(`aka logs -a ${app.name}`));
    ui.div(shortLabel('Metrics:'), ital(`aka metrics -a ${app.name}`));

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
}

function destroy(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  app_or_error(appkit, args.app, (app) => {
    const del = (input) => {
      if (input === app.name) {
        const task = appkit.terminal.task(`Destroying **⬢ ${app.name}** (including all add-ons)`);
        task.start();
        appkit.api.delete(`/apps/${args.app}`, (err) => {
          if (err) {
            task.end('error');
            appkit.terminal.error(err);
            return;
          }
          task.end('ok');
        });
      } else {
        appkit.terminal.soft_error(`Confirmation did not match !!${app.name}!!. Aborted.`);
      }
    };
    if (args.confirm) {
      del(args.confirm);
    } else {
      appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete **⬢ ${app.name}** including all add-ons.\n ~~▸~~    To proceed, type !!${app.name}!! or re-run this command with !!--confirm ${app.name}!!\n`, del);
    }
  });
}

// function join(appkit, args) { console.log('join operation is not currently supported.'); }

// function leave(appkit, args) { console.log('leave operation is not currently supported.'); }

function list(appkit, args) {
  appkit.api.get('/apps',
    filter_by.bind(null, args, appkit.terminal.format_objects.bind(null, format_app,
      appkit.terminal.markdown('###===### No apps were found.'))));
}

// function lock(appkit, args) { console.log('lock operation is not currently supported.'); }

function open(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  appkit.api.get(`/apps/${args.app}`, (err, data) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    proc.spawnSync(isWindows ? 'start' : 'open', [data.web_url], { shell: isWindows || undefined });
  });
}

// function rename(appkit, args) { console.log('rename operation is not currently supported.'); }

function stacks(appkit, args) {
  console.log(appkit.terminal.markdown(`###===### **⬢ ${args.app}** Available Stacks\n* alamo-1`));
}

// function transfer(appkit, args) { console.log('transfer operation is not currently supported.'); }

// function unlock(appkit, args) { console.log('unlock operation is not currently supported.'); }

async function update(appkit, args) {
  if (typeof args.d === 'undefined') {
    console.log(appkit.terminal.markdown('!!Must provide a property to update!!'));
  } else {
    try {
      await appkit.api.patch(JSON.stringify({ description: args.d }), `/apps/${args.app}`);
      console.log(appkit.terminal.markdown(`###===### Successfully updated ~~${args.app}~~`));
    } catch (err) {
      appkit.terminal.error(err);
    }
  }
}

module.exports = {
  init(appkit) {
    const create_apps_options = (yargs) => yargs
      .option('space', {
        alias: 's',
        string: true,
        demand: true,
        description: 'The space to create the app in',
      }).option('org', {
        alias: 'o',
        string: true,
        demand: true,
        description: 'The organization to create the app under',
      }).option('description', {
        alias: 'd',
        string: true,
        description: 'A short description of the app',
      }).positional('NAME', {
        string: true,
        description: 'Name of the new app - must be lowercase alphanumeric only',
      });

    const require_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
    };

    const filter_app_option = {
      space: {
        alias: 's',
        string: true,
        description: 'Filter the list of apps by a space',
      },
      repo: {
        alias: 'r',
        string: true,
        description: 'Filter the list of apps by a repo',
      },
      org: {
        alias: 'o',
        string: true,
        description: 'Filter the list of apps by an organization',
      },
      name: {
        alias: 'n',
        string: true,
        description: 'Filter the list of apps by a name',
      },
    };

    const fork_app_option = {
      to: {
        alias: 't',
        string: true,
        demand: true,
        description: 'The new application name as appname-space',
      },
      organization: {
        alias: 'o',
        string: true,
        description: 'Override the organization when forking the app',
      },
    };

    const blueprint_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'An app to use as a base definition',
      },
      logo: {
        alias: 'l',
        demand: false,
        string: true,
        description: 'The url of this application\'s logo',
      },
      name: {
        alias: 'n',
        demand: false,
        string: true,
        description: 'The human-readable name of the application (not the app name)',
      },
      'success-url': {
        alias: 's',
        demand: false,
        string: true,
        description: 'The relative url to send the user once the one-click has been released',
      },
      env: {
        alias: 'e',
        demand: false,
        string: true,
        type: 'array',
        description: 'A list of environment variables that will be required',
      },
    };

    const update_app_options = {
      ...require_app_option,
      description: {
        alias: 'd',
        demand: false,
        string: true,
        description: 'Update the description for an app (leave blank to unset) (e.g. "My Description")',
        group: 'Properties',
      },
    };

    const oneclick_app_option = {
      ...blueprint_app_option,
      app: {
        alias: 'a',
        demand: false,
        string: true,
        description: 'An app to use as a base definition',
      },
      file: {
        alias: 'f',
        demand: false,
        string: true,
        description: 'The file containing the blueprint (app.json) of the app',
      },
    };

    const destroy_app_option = {
      ...require_app_option,
      confirm: {
        alias: 'c',
        demand: false,
        string: true,
        description: 'Confirm (in advance) the name of the app to destroy',
      },
    };

    appkit.args
      .command('apps', 'List available apps', filter_app_option, list.bind(null, appkit))
      .command('apps:info', 'Show detailed information for an app', require_app_option, info.bind(null, appkit))
      .command('apps:create [NAME]', 'Create a new app', create_apps_options, create.bind(null, appkit))
      .command('apps:destroy', 'Permanently delete an app', destroy_app_option, destroy.bind(null, appkit))
      .command('apps:favorites', 'List favorite apps', filter_app_option, favorites.bind(null, appkit))
      .command('apps:favorites:add', 'Favorites an app', require_app_option, favorite.bind(null, appkit))
      .command('apps:favorites:remove', 'Unfavorites an app', require_app_option, unfavorite.bind(null, appkit))
      .command('apps:update', 'Update an app\'s properties', update_app_options, update.bind(null, appkit))
      .command('apps:fork NAME', 'Fork an existing app into a new one', fork_app_option, fork.bind(null, appkit))
      .command('apps:blueprint', 'Generates a blueprint (app.json definition) describing an app', blueprint_app_option, blueprint.bind(null, appkit))
      .command('apps:one-click', 'Generates a one-click url that will recreate an app', oneclick_app_option, oneclick.bind(null, appkit))
      .command('apps:open', 'Open an app in a web browser', require_app_option, open.bind(null, appkit))
      .command('apps:stacks', 'Show a list of available stacks', require_app_option, stacks.bind(null, appkit))

      // Aliases
      .command('create [NAME]', false, create_apps_options, create.bind(null, appkit))
      .command('apps:delete', false, destroy_app_option, destroy.bind(null, appkit))
      .command('apps:remove', false, destroy_app_option, destroy.bind(null, appkit))
      .command('favorites', false, filter_app_option, favorites.bind(null, appkit))
      .command('favorites:add', false, require_app_option, favorite.bind(null, appkit))
      .command('favorites:remove', false, require_app_option, unfavorite.bind(null, appkit))
      .command('blueprint', false, blueprint_app_option, blueprint.bind(null, appkit))
      .command('apps:blue-print', false, blueprint_app_option, blueprint.bind(null, appkit))
      .command('blue-print', false, blueprint_app_option, blueprint.bind(null, appkit))
      .command('apps:oneclick', false, oneclick_app_option, oneclick.bind(null, appkit))
      .command('oneclick', false, oneclick_app_option, oneclick.bind(null, appkit))
      .command('one-click', false, oneclick_app_option, oneclick.bind(null, appkit))
      .command('info', false, require_app_option, info.bind(null, appkit))
      .command('open', false, require_app_option, open.bind(null, appkit));

    /* eslint-disable */
    // .command('apps:rename <NEWNAME>', 'rename the app', require_app_option, rename.bind(null, appkit))
    // .command('apps:join', 'add yourself to an organization app', require_app_option, join.bind(null, appkit))
    // .command('apps:leave', 'remove yourself from an organization app', require_app_option, leave.bind(null, appkit))
    // .command('apps:lock', 'lock an organization app to restrict access', require_app_option, lock.bind(null, appkit))
    // .command('apps:transfer <RECIPIENT>', 'transfer applications to another user, organization or team', require_app_option, transfer.bind(null, appkit))
    // .command('apps:unlock', 'unlock an organization app so that any org member can join it', require_app_option, unlock.bind(null, appkit))
    /* eslint-enable */
  },
  update() {
    // do nothing.
  },
  group: 'apps',
  help: 'manage apps (create, destroy)',
  primary: true,
};
