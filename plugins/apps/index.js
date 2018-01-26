"use strict"

const proc = require('child_process');
const fs = require('fs');
const rand = require('./random.js');

function format_app(app) {
  let upname = app.simple_name.toUpperCase();
  return `**⬢ ${app.name}**
  ***Owner:*** ${app.organization ? app.organization.name : app.owner.email}
  ***Id:*** ${app.id}
  ***Url:*** ${app.web_url}
  ***Available at:*** ${upname}_SERVICE_HOST, ${upname}_SERVICE_PORT 
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

let create_apps_options = {
  "space":{
    "alias":"s",
    "string":true,
    "demand":true,
    "description":"The space to create the app in"
  },
  "org":{
    "alias":"o",
    "string":true,
    "demand":true,
    "description":"The organization to create the app under"
  }
}

function create(appkit, args) {
  if(!args.NAME) {
    args.NAME = rand.name() + Math.floor(Math.random() * 10000);
  }

  let task = appkit.terminal.task(`Creating app **⬢ ${args.NAME}-${args.space}**`);
  task.start();

  let payload = {
    "space":args.space,
    "name":args.NAME,
    "org":args.org
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
    console.assert(args.app && args.app !== '', 'An application name was not provided.');
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

function blueprint(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/app-setups', (err, definition) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    console.log(JSON.stringify(definition, null, 2));
  });
}

function oneclick(appkit, args) {
  console.assert(args.app || args.file, 'Either an app or a file is required.')
  if(args.app) {
    appkit.api.get('/apps/' + args.app + '/app-setups', (err, definition) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      console.log('https://<akkeris ui host>/app-setups?blueprint=' + encodeURIComponent(JSON.stringify(definition)));
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
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app, function(err, app) {
    if (err){
      return appkit.terminal.print(err);
    }
    appkit.api.get('/apps/' + args.app + '/addons', function(err, addons) {
      appkit.api.get('/apps/' + args.app + '/addon-attachments', function(err, attachments) {
        appkit.api.get('/apps/' + args.app + '/pipeline-couplings', function(err, pipeline) {
          appkit.api.get('/apps/' + args.app + '/formation', function(err, dynos) {
            console.log(appkit.terminal.markdown(`###===### **⬢ ${app.name}**
  App ID:\t\t${app.id}
  Addons:\t${addons ? addons.map((x) => { return '\t' + x.name; }).join('\n\t') : ''}
  Attached Addons:\t${attachments ? attachments.map((x) => { return '\t' + x.name; }).join('\n\t') : ''}
  Dynos:\t${dynos ? dynos.map((x) => { return '\t' + x.type + ': ' + x.quantity}).join('\n\t') : ''}
  Pipeline:\t\t${pipeline ? pipeline.pipeline.name + ' - ' + pipeline.stage : ''}
  Git URL:\t\t${app.git_url}
  Last Released:\t${app.released_at ? new Date(app.released_at).toLocaleString() : 'Never'}
  Current Image:\t${app.image}
  Owner:\t\t${app.organization.name}
  Region:\t\t${app.region.name}
  Stack:\t\t${app.stack.name}
  Service ENV:\t\t${app.simple_name.toUpperCase() + '_SERVICE_HOST'}, ${app.simple_name.toUpperCase() + '_SERVICE_PORT'}
  Web URL:\t\t${app.web_url}`));
          });
        });
      });
    });
  });
}

function destroy(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
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
  next_cmd(err, data);
}

function list(appkit, args) { 
  appkit.api.get('/apps', 
    filter_by.bind(null, args, appkit.terminal.format_objects.bind(null, format_app,
      appkit.terminal.markdown('###===### No apps were found.')))); 
}

function lock(appkit, args) { console.log('lock operation is not currently supported.'); }

function open(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app, (err, data) => { 
    if(err) {
      return appkit.terminal.error(err)
    }
    proc.spawn('open', [data.web_url], {});
  });
}

function rename(appkit, args) { console.log('rename operation is not currently supported.'); }

function stacks(appkit, args) { 
  console.log(appkit.terminal.markdown(`###===### **⬢ ${args.app}** Available Stacks\n* alamo-1`));
}

function transfer(appkit, args) { console.log('transfer operation is not currently supported.'); }

function unlock(appkit, args) { console.log('unlock operation is not currently supported.'); }

module.exports = {
  init:function(appkit) {
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    };
    let filter_app_option = {
      'space':{
        'alias':'s',
        'string':true,
        'description':'Filter the apps by a space'
      },
      'repo':{
        'alias':'r',
        'string':true,
        'description':'Filter the apps by a repo'
      },
      'name':{
        'alias':'n',
        'string':true,
        'description':'Filter the apps by a name'
      }
    };
    let fork_app_option = {
      'to':{
        'alias':'t',
        'string':true,
        'demand':true,
        'description':'The new application name as appname-space.'
      },
      'organization':{
        'alias':'o',
        'string':true,
        'description':'Override the organization when forking the app.'
      }
    }
    let blueprint_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    }
    let oneclick_app_option = {
      'app':{
        'alias':'a',
        'demand':false,
        'string':true,
        'description':'The app to act on.'
      },
      'file':{
        'alias':'f',
        'demand':false,
        'string':true,
        'description':'The file containing the blueprint (app.json) of the app.'
      }
    }
    appkit.args
      .command('apps', 'list available apps', filter_app_option, list.bind(null, appkit))
      .command('apps:create [NAME]', 'create a new app; NAME must be lowercase alphanumeric only', create_apps_options, create.bind(null, appkit))
      .command('create [NAME]', false, create_apps_options, create.bind(null, appkit))
      .command('apps:destroy', 'permanently destroy an app', require_app_option, destroy.bind(null, appkit))
      .command('apps:delete', false, require_app_option, destroy.bind(null, appkit))
      .command('apps:remove', false, require_app_option, destroy.bind(null, appkit))
      .command('apps:favorites', 'view app favorites', filter_app_option, favorites.bind(null, appkit))
      .command('apps:favorites:add', 'favorites an app', require_app_option, favorite.bind(null, appkit))
      .command('apps:favorites:remove', 'unfavorites an app', require_app_option, unfavorite.bind(null, appkit))
      .command('favorites', false, filter_app_option, favorites.bind(null, appkit))
      .command('favorites:add', false, require_app_option, favorite.bind(null, appkit))
      .command('favorites:remove', false, require_app_option, unfavorite.bind(null, appkit))
      .command('apps:fork NAME', 'fork an existing app into a new one', fork_app_option, fork.bind(null, appkit))
      .command('apps:blueprint', 'generates a blueprint (app.json definition) to recreate this app.', blueprint_app_option, blueprint.bind(null, appkit))
      .command('apps:one-click', 'generates a one-click url from an app or blueprint that when clicked will recreate the app.', oneclick_app_option, oneclick.bind(null, appkit))
      .command('apps:info', 'show detailed app information', require_app_option, info.bind(null, appkit))
      .command('info', false, require_app_option, info.bind(null, appkit))
      //.command('apps:join', 'add yourself to an organization app', require_app_option, join.bind(null, appkit))
      //.command('apps:leave', 'remove yourself from an organization app', require_app_option, leave.bind(null, appkit))
      //.command('apps:lock', 'lock an organization app to restrict access', require_app_option, lock.bind(null, appkit))
      .command('apps:open', 'open the app in a web browser', require_app_option, open.bind(null, appkit))
      .command('open', false, require_app_option, open.bind(null, appkit))
      //.command('apps:rename <NEWNAME>', 'rename the app', require_app_option, rename.bind(null, appkit))
      .command('apps:stacks', 'show the list of available stacks', require_app_option, stacks.bind(null, appkit))
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
