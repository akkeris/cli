/* eslint-disable no-nested-ternary, no-useless-escape  */
const https = require('https');
const url = require('url');
const assert = require('assert');

function quiet(data) {
  return data.replace(/^([A-z0-9\:\-\+\.]+Z) ([A-z\-0-9\.]+) ([A-z\.0-9\/\[\]\-]+)\: /gm, '');
}

function highlight(data) {
  return data.replace(/^([A-z0-9\:\-\+\.]+Z) ([A-z\-0-9\.]+) ([A-z\.0-9\/\[\]\-]+)\: /gm, '\u001b[36m$1\u001b[0m $2 \u001b[38;5;104m$3:\u001b[0m ');
}

function find_source(source, data) {
  if (!(new RegExp(`^([A-z0-9\\:\\-\\+\\.]+Z) ([A-z\\-0-9\\.]+) ${source}.*`, 'gm')).test(data)) {
    return '';
  }
  return data;
}

function find_dyno(dyno, data) {
  if (!(new RegExp(`^([A-z0-9\\:\\-\\+\\.]+Z) ([A-z\\-0-9\\.]+) app\\[${dyno.toLowerCase()}.*`, 'gm')).test(data)) {
    return '';
  }
  return data;
}

async function stream_logs(appkit, colors, uri, payload, silent, source, dyno) {
  const log_session = await appkit.api.post(JSON.stringify(payload), uri);
  const logging_stream_url = url.parse(log_session.logplex_url);
  const chain = colors
    ? (silent ? (data) => highlight(quiet(data)) : (data) => highlight(data))
    : (silent ? (data) => quiet(data) : (data) => data);
  const filter = source
    ? (dyno ? (data) => find_source(find_dyno(dyno, data)) : (data) => find_source(source, data))
    : (dyno ? (data) => find_dyno(dyno, data) : (data) => data);
  const req = https.request(logging_stream_url, (res) => {
    if (!colors && !silent && !source && !dyno) {
      res.pipe(process.stdout);
    } else if (!source && !dyno) {
      res.setEncoding('utf8');
      res.on('data', (data) => process.stdout.write(chain(data)));
    } else {
      res.setEncoding('utf8');
      res.on('data', (data) => process.stdout.write(chain(filter(data))));
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
    const payload = { lines: args.num, tail: args.tail };
    let uri = `/apps/${args.app}/log-sessions`;
    if (args.site && args.site !== '') {
      uri = `/sites/${args.site}/log-sessions`;
    }
    await stream_logs(appkit, args.colors, uri, payload, args.quiet, args.source, args.dyno);
  } catch (e) {
    appkit.terminal.error(e);
  }
}

module.exports = {
  init(appkit) {
    const logs_option = {
      app: {
        alias: 'a',
        demand: false,
        string: true,
        description: 'The app to view logs for (cannot be used with -s option)',
      },
      num: {
        alias: 'n',
        demand: false,
        number: true,
        default: 100,
        description: 'Number of lines to display',
      },
      tail: {
        alias: 't',
        demand: false,
        boolean: true,
        default: false,
        description: 'Continually stream logs',
      },
      colors: {
        alias: 'c',
        demand: false,
        boolean: true,
        default: true,
        description: 'Allow tty colors in logs',
      },
      source: {
        alias: 's',
        demand: false,
        string: true,
        default: '',
        description: 'Show output only from a specific source (e.g., "akkeris/router", "app", "build")',
      },
      dyno: {
        alias: 'd',
        demand: false,
        string: true,
        default: '',
        description: 'Show output only from a dyno type (e.g., "web", "worker")',
      },
      quiet: {
        alias: 'q',
        demand: false,
        boolean: true,
        default: false,
        description: 'Suppress timestamp and process annotations',
      },
    };
    appkit.args
      .command('logs', 'Display logs for an app or site', logs_option, logs.bind(null, appkit))
      .command('log', false, logs_option, logs.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'logs',
  help: 'view and tail logs',
  primary: true,
};
