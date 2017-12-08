"use strict"

function format_hooks(hook) {
  return `**ɧ ${hook.url}**
  ***Events:*** ${hook.events.join(", ")}
  ***Id:*** ${hook.id}
  ***Active:*** ${hook.active}\n`;
}

function info_hooks(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/hooks/' + args.ID, appkit.terminal.print);
}

function list_hooks(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/hooks', 
    appkit.terminal.format_objects.bind(null, format_hooks, 
      appkit.terminal.markdown('###===### No hooks were found.')));
}

function create_hooks(appkit, args) {
  console.assert(args.URL.startsWith('http:') || args.URL.startsWith('https:'), 
    'The specified URL was invalid, only http and https are supported.');
  args.URL = args.URL.toLowerCase();
  let payload = {url:args.URL, events:args.events, active:args.active, secret:args.secret};

  let task = appkit.terminal.task(`Creating webhook **ɧ ${args.URL}**`);
  task.start();
  appkit.api.post(JSON.stringify(payload), 
    '/apps/' + args.app + '/hooks', (err, data) => {
      if(err) {
        task.end('error');
      } else {
        task.end('ok');
      }
      appkit.terminal.print(err, data);
    });
}

function delete_hooks(appkit, args) {
  console.assert(args.ID, 'A hook id was not provided!');
  let task = appkit.terminal.task(`Removing hook **ɧ ${args.ID}**`);
  task.start();
  appkit.api.delete('/apps/' + args.app + '/hooks/' + args.ID, (err) => {
    if(err) {
      task.end('error');
      return appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}

module.exports = {
  
  init:function(appkit) {
    let hooks_options = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    };
    let hooks_create_options = JSON.parse(JSON.stringify(hooks_options));
    hooks_create_options.events = {
      array:true,
      demand:true,
      alias:'e',
      description:'A space separated of events (one of): "build release formation_change logdrain_change addon_change config_change destory"'
    };
    hooks_create_options.secret = {
      string:true,
      demand:true,
      alias:'s',
      description:'The secret to use for calculating the sha1 hash.'
    };
    hooks_create_options.active = {
      boolean:true,
      demand:true,
      default:true,
      description:'Make this hook active or inactive.'
    };

    appkit.args
      .command('hooks', 'list webhooks for an app.', hooks_options, list_hooks.bind(null, appkit))
      .command('hooks:info ID', 'Get information on the specified webhook.', hooks_options, info_hooks.bind(null, appkit))
      .command('hooks:destroy ID', 'Remove the specified webhook.', hooks_options, delete_hooks.bind(null, appkit))
      .command('hooks:create URL', 'create a new webhook.', hooks_create_options, create_hooks.bind(null, appkit))

  },
  update:function() {
    // do nothing.
  },
  group:'hooks',
  help:'view and create webhooks to integrate your app with external systems.',
  primary:true
}
