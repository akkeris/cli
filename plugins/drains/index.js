"use strict"
const assert = require('assert')

function format_drain(drain) {
  return `** ⃫ ${drain.token}**
  ***Id:*** ${drain.id}
  ***Forwarding To:*** ${drain.url}\n`; 
}

function list_drains(appkit, args) {
  if(!args.app && !args.site) {
    return appkit.terminal.error(new Error("No application or site was provided, use either --site (-s) or --app (-a) to view logs."))
  }
  if(args.app && args.site) {
    return appkit.terminal.error(new Error("Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both."))
  }
  let uri = `/apps/${args.app}/log-drains`
  if (args.site && args.app === "" && args.site !== "") {
    uri = `/sites/${args.site}/log-drains`
  }
  appkit.api.get(uri, appkit.terminal.format_objects.bind(null, format_drain, appkit.terminal.markdown('###===### No drains were found.')));
}

function info_drains(appkit, args) {
  if(!args.app && !args.site) {
    return appkit.terminal.error(new Error("No application or site was provided, use either --site (-s) or --app (-a) to view logs."))
  }
  if(args.app && args.site) {
    return appkit.terminal.error(new Error("Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both."))
  }
  assert.ok(args.ID && args.ID !== '', 'The log drain id was not provided.');

  let uri = `/apps/${args.app}/log-drains/${args.ID}`
  if (args.site && args.app === "" && args.site !== "") {
    uri = `/sites/${args.site}/log-drains/${args.ID}`
  }

  appkit.api.get(uri, appkit.terminal.print);
}

function create_drains(appkit, args) {
  if(!args.app && !args.site) {
    return appkit.terminal.error(new Error("No application or site was provided, use either --site (-s) or --app (-a) to view logs."))
  }
  if(args.app && args.site) {
    return appkit.terminal.error(new Error("Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both."))
  }
  assert.ok(args.URL && args.URL !== '', 'The url for the drain was not found.');
  assert.ok(args.URL.startsWith("syslog://") || args.URL.startsWith("syslog+tls://") || args.URL.startsWith("syslog+udp://") || args.URL.startsWith("http://") || args.URL.startsWith("https://"), 
    'The specified log drain did not have a http, https, syslog, syslog+tls, or syslog+udp scheme. Invalid URL.');
  let payload = {url:args.URL};

  let uri = `/apps/${args.app}/log-drains`
  if (args.site && args.app === "" && args.site !== "") {
    uri = `/sites/${args.site}/log-drains`
  }
  appkit.api.post(JSON.stringify(payload), uri, appkit.terminal.print);
}

function delete_drains(appkit, args) {
  if(!args.app && !args.site) {
    return appkit.terminal.error(new Error("No application or site was provided, use either --site (-s) or --app (-a) to view logs."))
  }
  if(args.app && args.site) {
    return appkit.terminal.error(new Error("Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both."))
  }
  assert.ok(args.ID && args.ID !== '', 'The log drain id was not provided.');
  let uri = `/apps/${args.app}/log-drains/${args.ID}`
  if (args.site && args.app === "" && args.site !== "") {
    uri = `/sites/${args.site}/log-drains/${args.ID}`
  }
  appkit.api.delete(uri, (err, drain) => {
      if(err) {
          return appkit.terminal.error(err);
      }
      console.log(appkit.terminal.markdown(`###===### Successfully removed ~~${drain.url}~~ from ~~${args.app === "" ? args.site : args.app}~~`));
  });
}

let require_app_option = {
  'app':{
    'alias':'a',
    'demand':false,
    'string':true,
    'description':'The app to use, this cannot be used with -s option.'
  },
  'site':{
    'alias':'s',
    'demand':false,
    'string':true,
    'description':'The site to use, this cannot be used with -a option.'
  },
};

module.exports = {

  init:function(appkit) {
    appkit.args
      .command('drains', 'list log drains on an app or site.', require_app_option, list_drains.bind(null, appkit))
      .command('drains:info ID', 'Get information on the specified log drain.', require_app_option, info_drains.bind(null, appkit))
      .command('drains:remove ID', 'Remove a log drain from an app or site.', require_app_option, delete_drains.bind(null, appkit))
      .command('drains:create URL', 'create a new log drain, forward it to the specified syslog URL.', require_app_option, create_drains.bind(null, appkit))
      .command('drains:add URL', false, require_app_option, create_drains.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'drains',
  help:'dump logs to an outside syslogd endpoint',
  primary:true
}