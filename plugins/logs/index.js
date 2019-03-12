"use strict"

const https = require('https');
const url = require('url');
const assert = require('assert');

function highlight(data) {
  process.stdout.write(data.replace(/^([A-z0-9\:\-\+\.]+Z) ([A-z\-0-9\.]+) ([A-z\.0-9\/\[\]\-]+)\: /gm, '\u001b[36m$1\u001b[0m $2 \u001b[38;5;104m$3:\u001b[0m ')); 
}

let stream_restarts = 0
async function stream_logs(appkit, colors, uri, payload) {
  /* as a safety mechanism eventually timeout after 1000 restarts */
  if(stream_restarts > 1000) {
    return process.exit(1)
  }
  let log_session = await appkit.api.post(JSON.stringify(payload), uri)
  let logging_stream_url = url.parse(log_session.logplex_url);

  let req = https.request(logging_stream_url, (res) => { 
    if(!colors) {
      res.pipe(process.stdout) 
    } else {
      res.setEncoding('utf8')
      res.on('data', highlight)
      res.on('error', (e) => {
        return appkit.terminal.error(e)
      })
      res.on('end', () => {
        stream_restarts++;
        setTimeout(stream_logs.bind(null, appkit, colors, uri, payload), 1000); 
      })
    }
  });
  req.on('error', (e) => {
    if (e.code === "ECONNRESET") {
      stream_restarts++;
      return setTimeout(stream_logs.bind(null, appkit, colors, uri, payload), 1000);
    }
    return appkit.terminal.error(e)
  })
  req.setNoDelay(true)
  req.end()
}

async function logs(appkit, args) {
  try {
    assert.ok(args.app || args.site, 'No application or site was provided.  Use either --site or --app to view logs.')
    assert.ok(!(args.app && args.site), 'Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both.')
    let payload = {lines:args.num, tail:args.tail}
    let uri = `/apps/${args.app}/log-sessions`
    if (args.site && args.site !== '') {
      uri = `/sites/${args.site}/log-sessions`
    }
    await stream_logs(appkit, args.colors, uri, payload)
  } catch(e) {
    appkit.terminal.error(e)
  }
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
