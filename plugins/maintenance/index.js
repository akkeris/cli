const assert = require('assert');

function get_info(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get(`/apps/${args.app}`, (err, info) => {
    if (err || !info) {
      appkit.terminal.print(err);
      return;
    }
    if (info.maintenance === true) {
      console.log('on');
    } else {
      console.log('off');
    }
  });
}

function maintenance(state, appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  const task = appkit.terminal.task(`${(state === true ? 'Enabling' : 'Disabling')} maintenance mode for **⬢ ${args.app}**`);
  task.start();
  appkit.api.patch(JSON.stringify({ maintenance: state }), `/apps/${args.app}`, (err, info) => {
    if (err || !info) {
      task.end('error');
      appkit.terminal.print(err);
      return;
    }
    task.end('ok');
  });
}

const on = maintenance.bind(null, true);
const off = maintenance.bind(null, false);

module.exports = {
  init(appkit) {
    const require_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
    };

    appkit.args
      .command('maintenance', 'Display the maintenance mode status of an app', require_app_option, get_info.bind(null, appkit))
      .command('maintenance:on', 'Put an app into maintenance mode', require_app_option, on.bind(null, appkit))
      .command('maintenance:off', 'Take an app out of maintenance mode', require_app_option, off.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'apps',
  help: 'put apps in or out of maintenance mode',
  primary: true,
};
