const assert = require('assert');

function print_vars(appkit, args, config_vars) {
  const keys = Object.keys(config_vars).sort();

  if (args.shell) {
    keys.forEach((config_var) => console.log(`${config_var}="${config_vars[config_var].replace(/"/g, '\\"')}"`));
  } else if (args.json) {
    const kv = keys.map((config_var) => `  "${config_var.replace('"', '\\"')}":"${config_vars[config_var].replace('"', '\\"')}"`);
    console.log('{');
    console.log(kv.join(',\n'));
    console.log('}');
  } else {
    console.log(appkit.terminal.markdown(`###===### ${args.app} Config Vars`));
    appkit.terminal.vtable(config_vars, true);
  }
}

function get_config_vars(appkit, args) {
  appkit.api.get(`/apps/${args.app}/config-vars`, (err, config_vars) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    print_vars(appkit, args, config_vars);
  });
}

function get_config_var(appkit, args) {
  appkit.api.get(`/apps/${args.app}/config-vars`, (err, config_vars) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    const json_out = {};
    json_out[args.KEY] = config_vars[args.KEY];
    if (args.shell) {
      console.log(`${args.KEY}=${config_vars[args.KEY]}`);
    } else if (args.json) {
      console.log(JSON.stringify(json_out, null, 2));
    } else {
      console.log(appkit.terminal.markdown(`###===### ${args.app} Config Var ${args.KEY}`));
      appkit.terminal.vtable(json_out, true);
    }
  });
}

async function set_config_vars(appkit, args) {
  try {
    const values_paired = args.KEY_VALUE_PAIR;
    const values = {};
    if (args.KEY_VALUE_PAIR.length === 0) {
      appkit.terminal.error('No valid key value pairs were provided.');
      return;
    }
    let port = null;
    /* eslint-disable no-restricted-syntax */
    for (const value of values_paired) {
      if (value.indexOf('=') !== -1) {
        const key = value.substring(0, value.indexOf('='));
        const val = value.substring(value.indexOf('=') + 1);
        if (key.toUpperCase() === 'PORT') {
          port = parseInt(val, 10);
        } else if (key && val) {
          values[key] = val;
          if (args.unescape) {
            values[key] = values[key].replace(/\\n/g, '\n');
          }
        }
      }
    }
    /* eslint-enable no-restricted-syntax */
    if (Object.keys(values).length === 0 && port === null) {
      appkit.terminal.error('No config vars were provided.');
      return;
    }
    if (port) {
      await appkit.api.patch(JSON.stringify({ port }), `/apps/${args.app}/formation/web`);
    }
    if (Object.keys(values).length !== 0) {
      print_vars(appkit, args, await appkit.api.patch(JSON.stringify(values), `/apps/${args.app}/config-vars`));
    } else {
      print_vars(appkit, args, await appkit.api.get(`/apps/${args.app}/config-vars`));
    }
  } catch (err) {
    appkit.terminal.error(err);
  }
}

function unset_config_vars(appkit, args) {
  const values = {};
  if (args.KEY.length === 0) {
    appkit.terminal.error('No valid config vars were provided.');
    return;
  }
  args.KEY.forEach((key) => { values[key] = null; });
  appkit.api.patch(JSON.stringify(values), `/apps/${args.app}/config-vars`, (err, config_vars) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    print_vars(appkit, args, config_vars);
  });
}

async function get_config_notes(appkit, args) {
  try {
    const config_vars = await appkit.api.get(`/apps/${args.app}/config-vars/notes`);
    Object.keys(config_vars).forEach((x) => {
      console.log(appkit.terminal.markdown(`###===### Config Var ##${x}##`));
      appkit.terminal.vtable(config_vars[x]);
      console.log();
    });
  } catch (e) {
    appkit.terminal.error(e.message);
  }
}

async function set_config_notes(appkit, args) {
  try {
    assert.ok(args.KEY, 'No config var key was specified.');
    assert.ok(
      args.required === false
       || args.required === true
       || args.description
       || args.description === '',
      'Either the option required or description must be specified.',
    );
    const payload = {};
    payload[args.KEY] = { description: args.description, required: args.required };
    const config_vars = await appkit.api.patch(JSON.stringify(payload), `/apps/${args.app}/config-vars/notes`);
    Object.keys(config_vars).forEach((x) => {
      console.log(appkit.terminal.markdown(`###===### Config Var ##${x}##`));
      appkit.terminal.vtable(config_vars[x]);
      console.log();
    });
  } catch (e) {
    appkit.terminal.error(e.message);
  }
}

module.exports = {
  init(appkit) {
    const app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
    };
    const set_notes_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
      description: {
        alias: 'd',
        demand: false,
        string: true,
        description: 'The description to set for the notes',
      },
      required: {
        alias: 'r',
        demand: false,
        boolean: true,
        description: 'Whether to protect this config var and require it.',
      },
    };
    const config_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
      shell: {
        alias: 's',
        demand: false,
        boolean: true,
        default: false,
        description: 'Display environment variables in shell format',
      },
      json: {
        alias: 'j',
        demand: false,
        boolean: true,
        default: false,
        description: 'Display environment variables in JSON format',
      },
      unescape: {
        alias: 'u',
        demand: false,
        boolean: true,
        default: true,
        description: 'Unescape new lines and other command sequences',
      },
    };

    appkit.args
      .command('config', 'List environment variables for an app', config_option, get_config_vars.bind(null, appkit))
      .command('apps:config', false, config_option, get_config_vars.bind(null, appkit))
      .command('apps:env', false, config_option, get_config_vars.bind(null, appkit))
      .command('env', false, config_option, get_config_vars.bind(null, appkit))

      .command('config:get [KEY]', 'Get the value of an environment variable', config_option, get_config_var.bind(null, appkit))
      .command('apps:config:get [KEY]', false, config_option, get_config_var.bind(null, appkit))
      .command('apps:env:get [KEY]', false, config_option, get_config_var.bind(null, appkit))
      .command('env:get [KEY]', false, config_option, get_config_var.bind(null, appkit))

      .command('config:set [KEY_VALUE_PAIR..]', 'Set one or more environment variables (KEY=VALUE pairs)', config_option, set_config_vars.bind(null, appkit))
      .command('apps:config:set [KEY_VALUE_PAIR..]', false, config_option, set_config_vars.bind(null, appkit))
      .command('apps:env:set [KEY_VALUE_PAIR..]', false, config_option, set_config_vars.bind(null, appkit))
      .command('env:set [KEY_VALUE_PAIR..]', false, config_option, set_config_vars.bind(null, appkit))

      .command('config:notes', 'View notes on config vars', app_option, get_config_notes.bind(null, appkit))
      .command('config:notes:set KEY', 'Add notes to a config var', set_notes_option, set_config_notes.bind(null, appkit))

      .command('config:unset [KEY..]', 'Remove one or more environment variables', config_option, unset_config_vars.bind(null, appkit))
      .command('apps:config:unset [KEY..]', false, config_option, unset_config_vars.bind(null, appkit))
      .command('apps:env:unset [KEY..]', false, config_option, unset_config_vars.bind(null, appkit))
      .command('env:unset [KEY..]', false, config_option, unset_config_vars.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'config',
  help: 'set unset or update config',
  primary: true,
};
