"use strict"

const https = require('https');
const url = require('url');
const assert = require('assert');

function highlight(data) {
  process.stdout.write(data.replace(/^([A-z0-9\:\-\+\.]+Z) ([A-z\-0-9\.]+) ([A-z\.0-9\/\[\]\-]+)\: /gm, '\u001b[36m$1\u001b[0m $2 \u001b[38;5;104m$3:\u001b[0m ')); 
}

async function stream_logs(appkit, colors, uri, payload) {
  let log_session = await appkit.api.post(JSON.stringify(payload), uri);
  let logging_stream_url = url.parse(log_session.logplex_url);
  let req = https.request(logging_stream_url, (res) => { 
    if(!colors) {
      res.pipe(process.stdout);
    } else {
      res.setEncoding('utf8');
      res.on('data', highlight);
    }
    res.on('error', (e) => {
      appkit.terminal.error(e);
      process.exit(1);
    });
    res.on('end', () => process.exit(0));
  });
  req.on('error', (e) => {
    appkit.terminal.error(e);
    process.exit(1);
  });
  req.setNoDelay(true);
  req.end();
}

async function logs(appkit, args) {
  try {
    assert.ok(args.app || args.site, 'No application or site was provided.  Use either --site or --app to view logs.');
    assert.ok(!(args.app && args.site), 'Both --site (-s) and --app (-a) were provided, logs can be viewed for a site or an app, not both.');
    let payload = {lines:args.num, tail:args.tail};
    let uri = `/apps/${args.app}/log-sessions`;
    if (args.site && args.site !== '') {
      uri = `/sites/${args.site}/log-sessions`;
    }
    await stream_logs(appkit, args.colors, uri, payload);
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
        'description': 'The app to view logs for (cannot be used with -s option)'
      },
      'site':{
        'alias':'s',
        'demand':false,
        'string':true,
        'description': 'The site to view logs for (cannot be used with -a option)'
      },
      'num':{
        'alias':'n',
        'demand':false,
        'number':true,
        'default':100,
        'description': 'Number of lines to display'
      },
      'tail':{
        'alias':'t',
        'demand':false,
        'boolean':true,
        'default':false,
        'description': 'Continually stream logs'
      },
      'colors':{
        'alias':'c',
        'demand':false,
        'boolean':true,
        'default':true,
        'description': 'Allow tty colors in logs'
      }
    };
    appkit.args
      .command('logs', 'Display logs for an app or site', logs_option, logs.bind(null, appkit))
      .command('log', false, logs_option, logs.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'logs',
  help:'view and tail logs',
  primary:true
}
