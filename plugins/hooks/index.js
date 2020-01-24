"use strict"

const http = require('http');
const assert = require('assert');

function format_hooks(hook) {
  return `**ɧ ${hook.url}**
  ***Events:*** ${hook.events.join(", ")}
  ***Id:*** ${hook.id}
  ***Active:*** ${hook.active}\n`;
}

function info_hooks(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/hooks/' + args.ID, appkit.terminal.print);
}

function list_hooks(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/hooks', 
    appkit.terminal.format_objects.bind(null, format_hooks, 
      appkit.terminal.markdown('###===### No hooks were found.')));
}

function create_hooks(appkit, args) {
  assert.ok(args.URL.startsWith('http:') || args.URL.startsWith('https:'), 
    'The specified URL was invalid, only http and https are supported.');
  let payload = {url:args.URL, events:args.events, active:args.active, secret:args.secret};

  let task = appkit.terminal.task(`Creating webhook **ɧ ${args.URL}**`);
  task.start();
  appkit.api.post(JSON.stringify(payload), 
    '/apps/' + args.app + '/hooks', (err, data) => {
      if(err) {
        task.end('error');
      } else {
        task.end('ok');
      }
      appkit.terminal.print(err, data);
    });
}

function delete_hooks(appkit, args) {
  assert.ok(args.ID, 'A hook id was not provided!');
  let task = appkit.terminal.task(`Removing hook **ɧ ${args.ID}**`);
  task.start();
  appkit.api.delete('/apps/' + args.app + '/hooks/' + args.ID, (err) => {
    if(err) {
      task.end('error');
      return appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}
function to_console(headers, prefix) {
  if(!headers) {
    return ''
  }
  return Object.keys(headers).map((x) => {
return `${prefix}${x}: ${headers[x]}`
  }).join('\n')
}


function format_results(appkit, result) {
  return `**ɧ Hook Result:** ${result.id}, ${appkit.terminal.friendly_date(new Date(result.created_at))} - ${result.hook.events.join(', ')}
  ###>### POST ${result.last_attempt.request.url}
${to_console(result.last_attempt.request.headers, '  ###>### ')}
  ###>###
  ###>### ${JSON.stringify(result.last_attempt.request.body, null, 2).replace(/\n/g, '\n  ###>### ')}
  ###>###
  ###<### ${(result.last_attempt.response.code > 299 || result.last_attempt.response.code < 200) ? `!!${result.last_attempt.response.code}!!` : `^^${result.last_attempt.response.code}^^`} ${http.STATUS_CODES[result.last_attempt.response.code]}
${to_console(result.last_attempt.response.headers, '  ###<### ')}
  `
}

function result(appkit, args) {
    appkit.api.get(`/apps/${args.app}/hooks/${args.ID}/results`, (err, results) => {
      if(err) {
        return appkit.terminal.error(err)
      } else {
        if(!args.all) {
          results = results.slice(-10)
        }
        console.log(results.map(format_results.bind(null, appkit)).map(appkit.terminal.markdown).join('\n\n'))
      }
    })
}

async function fetch_hooks(appkit, args) {
  try {
    const availableHooks = (await appkit.api.get('/docs/hooks')).map(x => ({event: x.type, description: x.description}));
    appkit.terminal.table(availableHooks, { colWidths: [20, 100], wordWrap: true})
  } catch (err) {
    appkit.terminal.print(err);
  }
}

module.exports = {
  
  init:function(appkit) {
    let hooks_options = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      }
    };
    let hook_results_options = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      },
      'all':{
        'demand':true,
        'boolean':true,
        'default':false,
        'description':'Show all hook results'
      }
    };
    let hooks_create_options = JSON.parse(JSON.stringify(hooks_options));
    hooks_create_options.events = {
      array:true,
      demand:true,
      alias:'e',
      description:'A space separated list of one or more events (for a list of available events, use aka hooks:fetch)'
    };
    hooks_create_options.secret = {
      string:true,
      demand:true,
      alias:'s',
      description:'The secret to use for calculating the SHA1 hash'
    };
    hooks_create_options.active = {
      boolean:true,
      demand:true,
      default:true,
      description:'Make this hook active or inactive'
    };

    appkit.args
      .command('hooks', 'List configured webhooks for an app', hooks_options, list_hooks.bind(null, appkit))
      .command('hooks:info ID', 'Get information on the specified webhook', hooks_options, info_hooks.bind(null, appkit))
      .command('hooks:destroy ID', 'Remove the specified webhook', hooks_options, delete_hooks.bind(null, appkit))
      .command('hooks:create URL', 'Configure a new webhook', hooks_create_options, create_hooks.bind(null, appkit))
      .command('hooks:deliveries ID', 'Get information on the delivery of a webhook', hook_results_options, result.bind(null, appkit))
      .command('hooks:fetch', 'Get a list of available Akkeris hooks', {}, fetch_hooks.bind(null, appkit))
      // Aliases
      .command('hooks:remove ID', false, hooks_options, delete_hooks.bind(null, appkit))
      .command('hooks:delete ID', false, hooks_options, delete_hooks.bind(null, appkit))
      .command('hooks:add URL', false, hooks_create_options, create_hooks.bind(null, appkit))
      .command('hooks:result ID', false, hook_results_options, result.bind(null, appkit))
      .command('hooks:results ID', false, hook_results_options, result.bind(null, appkit))
      .command('hooks:sent ID', false, hook_results_options, result.bind(null, appkit))

  },
  update:function() {
    // do nothing.
  },
  group:'hooks',
  help:'view and create webhooks to integrate your app with external systems.',
  primary:true
}
