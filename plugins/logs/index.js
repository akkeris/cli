"use strict"

const https = require('https');
const url = require('url');
const chalk = require('chalk')

function highlight(data) {
  process.stdout.write(data
    .replace(/^([A-z0-9\:\-\+\.]+Z) ([A-z\-0-9]+) ([A-z\.0-9\/\[\]\-]+)\: /gm, '\u001b[36m$1\u001b[0m $2 \u001b[38;5;104m$3:\u001b[0m ')
    //.replace(/status=(2[0-9][0-9])/gm, 'status=' + chalk.rgb(111,245,27)('$1'))
    .replace(/status=(5[0-9][0-9])/gm, 'status=' + chalk.rgb(250,0,30)('$1'))
  ); 
}

function logs(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.')
  let payload = {lines:args.num, tail:args.tail}
  appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/log-sessions`, (err, log_session) => {
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
        'demand':true,
        'string':true,
        'description':'The app to act on.'
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