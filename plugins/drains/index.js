"use strict"

function format_drain(drain) {
  return `** ⃫ ${drain.token}**
  ***Id:*** ${drain.id}
  ***Forwarding To:*** ${drain.url}\n`; 
}

function list_drains(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app + '/log-drains', appkit.terminal.format_objects.bind(null, format_drain, appkit.terminal.markdown('###===### No drains were found.')));
}

function info_drains(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.ID && args.ID !== '', 'The log drain id was not provided.');
  appkit.api.get('/apps/' + args.app + '/log-drains/' + args.ID, appkit.terminal.print);
}

function create_drains(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.URL && args.URL !== '', 'The url for the drain was not found.');
  console.assert(args.URL.startsWith("syslog://") || args.URL.startsWith("syslog+tls://") || args.URL.startsWith("syslog+udp://") || args.URL.startsWith("http://") || args.URL.startsWith("https://"), 
    'The specified log drain did not have a http, https, syslog, syslog+tls, or syslog+udp scheme. Invalid URL.');
  let payload = {url:args.URL};
  appkit.api.post(JSON.stringify(payload), '/apps/' + args.app + '/log-drains', appkit.terminal.print);
}

function delete_drains(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.ID && args.ID !== '', 'The log drain id was not provided.');
  appkit.api.delete('/apps/' + args.app + '/log-drains/' + args.ID, (err, drain) => {
      if(err) {
          return appkit.terminal.error(err);
      }
      console.log(appkit.terminal.markdown(`###===### Successfully removed ~~${drain.url}~~ from ~~${args.app}~~`));
  });
}

let require_app_option = {
  'app':{
    'alias':'a',
    'demand':true,
    'string':true,
    'description':'The app to act on.'
  }
};

module.exports = {

  init:function(appkit) {
    appkit.args
      .command('drains', 'list log drains on an app.', require_app_option, list_drains.bind(null, appkit))
      .command('drains:info ID', 'Get information on the specified log drain.', require_app_option, info_drains.bind(null, appkit))
      .command('drains:destroy ID', 'Remove a log drain from an app.', require_app_option, delete_drains.bind(null, appkit))
      .command('drains:remove ID', false, require_app_option, delete_drains.bind(null, appkit))
      .command('drains:delete ID', false, require_app_option, delete_drains.bind(null, appkit))
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