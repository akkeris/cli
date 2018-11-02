"use strict"
const assert = require('assert');

function info(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app, function(err, info){
    if (err || !info) {
      return appkit.terminal.print(err);
    }
    if(info.maintenance === true) {
      console.log('on');
    } else {
      console.log('off');
    }
  });
}

function maintenance(state, appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  let task = appkit.terminal.task(`${(state === true ? 'Enabling' : 'Disabling')} maintenance mode for **⬢ ${args.app}**`);
  task.start();
  appkit.api.patch(JSON.stringify({"maintenance":state}), '/apps/' + args.app, function(err, info) {
    if (err || !info) {
      task.end('error');
      return appkit.terminal.print(err);
    }
    task.end('ok');
  });
}

let on = maintenance.bind(null, true);
let off = maintenance.bind(null, false);

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
    appkit.args
      .command('maintenance', 'display the current maintenance status of app', require_app_option, info.bind(null, appkit))
      .command('maintenance:on', 'put the app into maintenance mode', require_app_option, on.bind(null, appkit))
      .command('maintenance:off', 'take the app out of maintenance mode', require_app_option, off.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'apps',
  help:'manage apps (create, destroy)',
  primary:true
}
