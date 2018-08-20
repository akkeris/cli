"use strict"

const https = require('https');
const url = require('url');

function highlight(data) {
  process.stdout.write(data.replace(/^([A-z0-9\:\-\+\.]+Z) ([A-z\-0-9]+) ([A-z\.0-9\/\[\]\-]+)\: /gm, '\u001b[36m$1\u001b[0m $2 \u001b[38;5;104m$3:\u001b[0m ')); 
}

function logs(appkit, args) {
  if(!args.app && !args.site) {
    return appkit.terminal.error(new Error("No application or site was provided, use either --site (-s) or --app (-a) to view logs."))
  }
  if(args.app && args.site) {
    return appkit.terminal.error(new Error("Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both."))
  }
  let payload = {lines:args.num, tail:args.tail}
  let uri = `/apps/${args.app}/log-sessions`
  if (args.site && args.site !== '') {
    uri = `/sites/${args.site}/log-sessions`
  }
  appkit.api.post(JSON.stringify(payload), uri, (err, log_session) => {
    if(err) {
      return appkit.terminal.error(err)
    }
    // the logplex_url should not be protected by any means, we use a pipe and https raw client
    // to be able to force the request to stream the response back rather than buffering it.
    let req = https.request(url.parse(log_session.logplex_url), (res) => { 
      if(!args.colors) {
        res.pipe(process.stdout) 
      } else {
        res.setEncoding('utf8')
        res.on('data', highlight)
        res.on('error', (e) => { /* go ahead and ignore these */ })
      }
    });
    req.on('error', function(e) { /* go ahead and ignore these */ })
    //req.setNoDelay(true)
    req.end()
  });
}

module.exports = {
  init:function(appkit) {
    let logs_option = {
      'app':{
        'alias':'a',
        'demand':false,
        'string':true,
        'description':'The app to view the logs for, this cannot be used with -s option.'
      },
      'site':{
        'alias':'s',
        'demand':false,
        'string':true,
        'description':'The site to view the logs for, this cannot be used with -a option.'
      },
      'num':{
        'alias':'n',
        'demand':false,
        'number':true,
        'default':100,
        'description':'number of lines to display'
      },
      'tail':{
        'alias':'t',
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'continually stream logs'
      },
      'colors':{
        'alias':'c',
        'demand':false,
        'boolean':true,
        'default':true,
        'description':'whether to allow tty colors in logs'
      }
    };
    appkit.args
      .command('logs',  'print logs for the specified app', logs_option, logs.bind(null, appkit))
      .command('log',   false, logs_option, logs.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'logs',
  help:'view and tail logs',
  primary:true
}
