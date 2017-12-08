"use strict"

const https = require('https');
const url = require('url');

function get_config_vars(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/config-vars', (err, config_vars) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    print_vars(appkit, args, config_vars);
  });
}

function get_config_var(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/config-vars', (err, config_vars) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    let json_out = {}
    json_out[args.KEY] = config_vars[args.KEY];
    if(args.shell) {
      console.log(args.KEY + "=" + config_vars[args.KEY]);
    } else if (args.json) {
      console.log(JSON.stringify(json_out, null, 2));
    } else {
      console.log(appkit.terminal.markdown(`###===### ${args.app} Config Var ${args.KEY}`));
      appkit.terminal.vtable(json_out, true);
    }
  });
}

function set_config_vars(appkit, args) {
  let values_paired = args['KEY=VALUE'];
  let values = {};
  if(args['KEY=VALUE'].length === 0) {
    return appkit.terminal.error("No valid key value pairs were provided.")
  }
  values_paired.forEach((value) => {
    if(value.indexOf('=') !== -1) {
      let key = value.substring(0, value.indexOf('='));
      let val = value.substring(value.indexOf('=') + 1);
      if(key && val) {
        values[key] = val;
      }
    }
  });
  if(Object.keys(values).length === 0) {
    return appkit.terminal.error('No valid key value pairs were provided.');
  }
  appkit.api.patch(JSON.stringify(values), '/apps/' + args.app + '/config-vars', (err, config_vars) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    print_vars(appkit, args, config_vars);
  });
}

function unset_config_vars(appkit, args) {
  let values = {};
  if(args['KEY'].length === 0) {
    return appkit.terminal.error("No valid config vars were provided.")
  }
  args['KEY'].forEach((key) => { values[key] = null; });
  appkit.api.patch(JSON.stringify(values), '/apps/' + args.app + '/config-vars', (err, config_vars) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    print_vars(appkit, args, config_vars);
  });
}

function print_vars(appkit, args, config_vars) {
    var keys = Object.keys(config_vars).sort();

    if(args.shell) {
        keys.forEach(config_var => console.log(config_var + "=" + config_vars[config_var]))
    } else if (args.json) {
        var kv = keys.map(config_var => `  "${config_var.replace('"', '\\"')}":"${config_vars[config_var].replace('"', '\\"')}"`)
        console.log('{');
        console.log(kv.join(",\n"));
        console.log('}')
    } else {
        console.log(appkit.terminal.markdown(`###===### ${args.app} Config Vars`));
        appkit.terminal.vtable(config_vars, true);
    }
}

module.exports = {
  init:function(appkit) {
    let config_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      },
      'shell':{
        'alias':'s',
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'output config vars in shell format'
      },
      'json':{
        'alias':'j',
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'output config vars in json format'
      }
    };
    appkit.args
      .command('config', 'list config environment variables for an app', config_option, get_config_vars.bind(null, appkit))
      .command('apps:config', false, config_option, get_config_vars.bind(null, appkit))
      .command('apps:env', false, config_option, get_config_vars.bind(null, appkit))
      .command('env', false, config_option, get_config_vars.bind(null, appkit))

      .command('config:get [KEY]', 'get a config var for an app', config_option, get_config_var.bind(null, appkit))
      .command('apps:config:get [KEY]', false, config_option, get_config_var.bind(null, appkit))
      .command('apps:env:get [KEY]', false, config_option, get_config_var.bind(null, appkit))
      .command('env:get [KEY]', false, config_option, get_config_var.bind(null, appkit))

      .command('config:set [KEY=VALUE..]', 'set one or more config vars', config_option, set_config_vars.bind(null, appkit))
      .command('apps:config:set [KEY=VALUE..]', false, config_option, set_config_vars.bind(null, appkit))
      .command('apps:env:set [KEY=VALUE..]', false, config_option, set_config_vars.bind(null, appkit))
      .command('env:set [KEY=VALUE..]', false, config_option, set_config_vars.bind(null, appkit))

      .command('config:unset [KEY..]', 'unset one or more config vars', config_option, unset_config_vars.bind(null, appkit))
      .command('apps:config:unset [KEY..]', false, config_option, unset_config_vars.bind(null, appkit))
      .command('apps:env:unset [KEY..]', false, config_option, unset_config_vars.bind(null, appkit))
      .command('env:unset [KEY..]', false, config_option, unset_config_vars.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'config',
  help:'set unset or update config',
  primary:true
}
