"use strict"

const assert = require('assert');
const proc = require('child_process');
const fs = require('fs');
const rand = require('./random.js');

const isWindows = process.platform === 'win32';

function format_app(app) {
  let upname = app.simple_name.toUpperCase();
  return `**⬢ ${app.name}** ${app.preview ? '- ^^preview^^' : ''}
  ***Url:*** ${app.web_url}
  ${app.git_url ? ("***😸  GitHub:*** " + app.git_url + ' \n') : ''}`;
}

function app_or_error(appkit, name, cb) {
  appkit.api.get('/apps/' + name, (err, app) => {
    if(err) {
      appkit.terminal.error(err);
    } else {
      cb(app);
    }
  });
}

function create(appkit, args) {
  if(!args.NAME) {
    args.NAME = rand.name() + Math.floor(Math.random() * 10000);
  }

  let task = appkit.terminal.task(`Creating app **⬢ ${args.NAME}-${args.space}**`);
  task.start();

  let payload = {
    "space": args.space,
    "name": args.NAME,
    "org": args.org,
    description: args.description || undefined,
  }

  appkit.api.post(JSON.stringify(payload), '/apps', (err, app) => {
    if(err) {
      task.end('error');
      return appkit.terminal.error(err);
    } else {
      task.end('ok');
      console.log(appkit.terminal.markdown('##' + app.web_url + '##'));
    }
  });
}

function favorites(appkit, args) {
    appkit.api.get('/favorites',
        filter_by.bind(null, args, appkit.terminal.format_objects.bind(null, format_app,
            appkit.terminal.markdown('###===### No apps were found.'))));
}

function favorite(appkit, args) {
    let task = appkit.terminal.task(`Adding app **⬢ ${args.app}** to favorites`);
    task.start();
    let payload = {"app":args.app};
    appkit.api.post(JSON.stringify(payload), '/favorites', (err, app) => {
        if(err) {
            task.end('error');
            return appkit.terminal.error(err);
        } else {
            task.end('ok');
        }
    });
}

function unfavorite(appkit, args) {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    let task = appkit.terminal.task(`Removing **⬢ ${args.app}** from favorites`);
    task.start();
    appkit.api.delete('/favorites/' + args.app, (err, del_info) => {
       if(err) {
           task.end('error');
           return appkit.terminal.error(err);
       }
       task.end('ok');
    });
}

function fork(appkit, args) {
  let task = appkit.terminal.task(`Copying **⬢ ${args.NAME}** to ${args.to}`);
  task.start();
  appkit.api.get('/apps/' + args.NAME + '/app-setups', (err, definition) => {
    if(err) {
      task.end('error');
      return appkit.terminal.error(err);
    }
    let app = args.to.split('-');
    let app_name = app[0];
    let space_name = app.slice(1).join('-');
    definition.app.name = app_name;
    definition.app.space = space_name;
    if(args.organization) {
      definition.app.org = args.organization;
    }
    appkit.api.post(JSON.stringify(definition), '/app-setups', (err, result) => {
      if(err) {
        task.end('error');
        return appkit.terminal.error(err);
      } else {
        task.end('ok');
      }
    });
  });
}


function update_blueprint(args, blueprint) {
  let bp = JSON.parse(JSON.stringify(blueprint))
  if(args.logo) {
    bp.logo = args.logo
  }
  if(args.name) {
    bp.name = args.name
  }
  if(args['success-url']) {
    bp.success_url = args['success-url']
  }
  if(args.env && Array.isArray(args.env)) {
    args.env.forEach((env) => {
      if(bp.env[env]) {
        delete bp.env[env].value
        bp.env[env].required = true
      } else {
        bp.env[env] = {required:true, "description":""}
      }
    })
  }
  return bp
}

function blueprint(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/app-setups', (err, definition) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    console.log(JSON.stringify(update_blueprint(args, definition), null, 2));
  });
}

function oneclick(appkit, args) {
  assert.ok(args.app || args.file, 'Either an app or a file is required.')
  if(args.app) {
    appkit.api.get('/apps/' + args.app + '/app-setups', (err, definition) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      console.log('https://<akkeris ui host>/app-setups?blueprint=' + encodeURIComponent(JSON.stringify(update_blueprint(args, definition))));
    });
  } else {
    try {
      let bp = JSON.parse(fs.readFileSync(args.file).toString('utf8'))
      bp = encodeURIComponent(JSON.stringify(bp))
      console.log('https://<akkeris ui host>/app-setups?blueprint=' + bp);
    } catch (e) {
      return appkit.terminal.error("The specified file didnt exist or wasnt a valid JSON file.")
    }
  }
}

function info(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app, function(err, app) {
    if (err){
      return appkit.terminal.print(err);
    }
    appkit.api.get('/apps/' + args.app + '/addons', function(err, addons) {
      appkit.api.get('/apps/' + args.app + '/addon-attachments', function(err, attachments) {
        appkit.api.get('/apps/' + args.app + '/pipeline-couplings', function(err, pipeline) {
          appkit.api.get('/apps/' + args.app + '/formation', function(err, dynos) {
            console.log(appkit.terminal.markdown(`###===### **⬢ ${app.name}** ${app.preview ? '- ^^preview^^' : ''}
  **ID:**\t\t${app.id}
  **Description:**\t\t${app.description}
  **Addons:**\t${addons ? addons.map((x) => { return '\t' + x.name; }).join('\n\t\t') : ''}
  **Attached Addons:**\t${attachments ? attachments.map((x) => { return '\t' + x.name; }).join('\n\t\t') : ''}
  **Dynos:**\t${dynos ? dynos.map((x) => { return '\t' + x.type + ': ' + x.quantity}).join('\n\t\t') : ''}
  **Pipeline:**\t\t${pipeline ? pipeline.pipeline.name + ' - ' + pipeline.stage : ''}
  **Git:**\t\t\t${app.git_url}${app.git_branch ? ('#' + app.git_branch) : ''}
  **Last Released:**\t${app.released_at ? new Date(app.released_at).toLocaleString() : 'Never'}
  **Slug:**\t\t\t${app.image}
  **Owner:**\t\t${app.organization.name}
  **Region:**\t\t${app.region.name}
  **Service ENV:**\t\t${app.simple_name.toUpperCase() + '_SERVICE_HOST'}, ${app.simple_name.toUpperCase() + '_SERVICE_PORT'}
  **URL:**\t\t\t${app.web_url}`));
          });
        });
      });
    });
  });
}

function destroy(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  app_or_error(appkit, args.app, (app) => {
    let del = (input) => {
      if(input === app.name) {
        let task = appkit.terminal.task(`Destroying **⬢ ${app.name}** (including all add-ons)`);
        task.start();
        appkit.api.delete('/apps/' + args.app, (err, del_info) => {
          if(err) {
            task.end('error');
            return appkit.terminal.error(err);
          }
          task.end('ok');
        });
      } else {
        appkit.terminal.soft_error(`Confirmation did not match !!${app.name}!!. Aborted.`);
      }
    };
    if(args.confirm) {
      del(args.confirm);
    } else {
      appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete **⬢ ${app.name}** including all add-ons.\n ~~▸~~    To proceed, type !!${app.name}!! or re-run this command with !!--confirm ${app.name}!!\n`, del);
    }
  });
}

function join(appkit, args) { console.log('join operation is not currently supported.'); }

function leave(appkit, args) { console.log('leave operation is not currently supported.'); }

function filter_by(args, next_cmd, err, data) {
  if(data && args.space) {
    data = data.filter((datum) => { return args.space === datum.space.name || args.space == datum.space.id; });
  }
  if(data && args.repo) {
    data = data.filter((datum) => { return (datum.git_url && datum.git_url.includes(args.repo)); });
  }
  if(data && args.name) {
    data = data.filter((datum) => { return (datum.name && datum.name.includes(args.name)); });
  }
  if(data && args.org) {
    data = data.filter((datum) => { return (datum.organization && datum.organization.name && datum.organization.name.includes(args.org)); });
  }
  next_cmd(err, data);
}

function list(appkit, args) { 
  appkit.api.get('/apps', 
    filter_by.bind(null, args, appkit.terminal.format_objects.bind(null, format_app,
      appkit.terminal.markdown('###===### No apps were found.')))); 
}

function lock(appkit, args) { console.log('lock operation is not currently supported.'); }

function open(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app, (err, data) => { 
    if(err) {
      return appkit.terminal.error(err)
    }
    proc.spawnSync(isWindows ? 'start' : 'open', [data.web_url], {shell: isWindows || undefined});
  });
}

function rename(appkit, args) { console.log('rename operation is not currently supported.'); }

function stacks(appkit, args) { 
  console.log(appkit.terminal.markdown(`###===### **⬢ ${args.app}** Available Stacks\n* alamo-1`));
}

function transfer(appkit, args) { console.log('transfer operation is not currently supported.'); }

function unlock(appkit, args) { console.log('unlock operation is not currently supported.'); }

async function update(appkit, args) {
  if (typeof args.d === 'undefined') {
    console.log(appkit.terminal.markdown('!!Must provide a property to update!!'));
  } else {
    try {
      await appkit.api.patch(JSON.stringify({ description: args.d }), '/apps/' + args.app, );
      console.log(appkit.terminal.markdown(`###===### Successfully updated ~~${args.app}~~`));
    } catch (err) {
      return appkit.terminal.error(err)
    }
  }
}

module.exports = {
  init:function(appkit) {

    const create_apps_options = yargs => yargs
      .option('space', {
        "alias":"s",
        "string":true,
        "demand":true,
        "description": "The space to create the app in"
      }).option('org', {
        "alias":"o",
        "string":true,
        "demand":true,
        "description": "The organization to create the app under"
      }).option('description', {
        alias: "d",
        string: true,
        description: "A short description of the app",
      }).positional('NAME', {
        "string": true,
        "description": "Name of the new app - must be lowercase alphanumeric only"
      });

    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description': 'The app to act on'
      }
    };

    let filter_app_option = {
      'space':{
        'alias':'s',
        'string':true,
        'description':'Filter the list of apps by a space'
      },
      'repo':{
        'alias':'r',
        'string':true,
        'description':'Filter the list of apps by a repo'
      },
      'org':{
        'alias':'o',
        'string':true,
        'description':'Filter the list of apps by an organization'
      },
      'name':{
        'alias':'n',
        'string':true,
        'description': 'Filter the list of apps by a name'
      }
    };

    let fork_app_option = {
      'to':{
        'alias':'t',
        'string':true,
        'demand':true,
        'description': 'The new application name as appname-space'
      },
      'organization':{
        'alias':'o',
        'string':true,
        'description': 'Override the organization when forking the app'
      }
    };

    let blueprint_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description': 'An app to use as a base definition'
      },
      'logo':{
        'alias':'l',
        'demand':false,
        'string':true,
        'description': 'The url of this application\'s logo'
      },
      'name':{
        'alias':'n',
        'demand':false,
        'string':true,
        'description': 'The human-readable name of the application (not the app name)'
      },
      'success-url':{
        'alias':'s',
        'demand':false,
        'string':true,
        'description': 'The relative url to send the user once the one-click has been released'
      },
      'env':{
        'alias':'e',
        'demand':false,
        'string':true,
        'type':'array',
        'description': 'A list of environment variables that will be required'
      }
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

    let oneclick_app_option = Object.assign(blueprint_app_option, {
      'file':{
        'alias':'f',
        'demand':false,
        'string':true,
        'description':'The file containing the blueprint (app.json) of the app'
      }
    });

    let destroy_app_option = Object.assign(require_app_option, {
      'confirm':{
        'alias':'c',
        'demand':false,
        'string':true,
        'description':'Confirm (in advance) the name of the app to destroy'
      }
    });

    oneclick_app_option.app.demand = false;

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
      .command('open', false, require_app_option, open.bind(null, appkit))

      //.command('apps:rename <NEWNAME>', 'rename the app', require_app_option, rename.bind(null, appkit))
      //.command('apps:join', 'add yourself to an organization app', require_app_option, join.bind(null, appkit))
      //.command('apps:leave', 'remove yourself from an organization app', require_app_option, leave.bind(null, appkit))
      //.command('apps:lock', 'lock an organization app to restrict access', require_app_option, lock.bind(null, appkit))
      //.command('apps:transfer <RECIPIENT>', 'transfer applications to another user, organization or team', require_app_option, transfer.bind(null, appkit))
      //.command('apps:unlock', 'unlock an organization app so that any org member can join it', require_app_option, unlock.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'apps',
  help:'manage apps (create, destroy)',
  primary:true
}
