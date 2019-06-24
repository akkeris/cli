"use strict"

const assert = require('assert')

function format_formation(ps) {
  if (ps.type === 'web' && ps.healthcheck) {
    return `##===## ^^^${ps.type}^^^ (**${ps.size}**): ${ps.command ? ps.command : '(from docker)'} (~~~${ps.quantity}~~~) (##${ps.healthcheck}##)`;
  } else {
    return `##===## ^^^${ps.type}^^^ (**${ps.size}**): ${ps.command ? ps.command : '(from docker)'} (~~~${ps.quantity}~~~)`;
  }
}

function format_warning(ps, form_dynos) {
  return `\n~~~⚠~~~  ${ps.type} dyno type has ${form_dynos.length} dynos, but ${ps.quantity} ${ps.quantity === 1 ? 'has' : 'have'} been requested. 
~~~⚠~~~  It may be scaling, crashing, restarting or deploying.`;
}

// start-failure, stopping, stopped, waiting, pending, starting, probe-failure, running, app-crashed
function state_map(ps) {
  switch(ps.state.toLowerCase()) {
    case 'start-failure':
      return {
        "state":"crashed", 
        "warning":"Application failed to start. Check your startup or entrypoint command.", 
        "additional_info":ps.additional_info
      }
    case 'app-crashed':
      return {
        "state":"crashed", 
        "warning":"This application unexpectedly crashed. Check its logs for more information.", 
        "additional_info":(ps.additional_info + " (restarts " + ps.restarts + ")")
      }
    case 'waiting':
      return {
        "state":"starting",
        "additional_info":ps.additional_info
      }
    case 'probe-failure':
      let started = new Date(Date.parse(ps.created_at))
      let now = new Date()
      if((now.getTime() - started.getTime()) > 1000 * 90) {
        return {
          "state":"unhealthy", 
          "warning":"This application is taking unusually long to start, ensure it's listening to $PORT.", 
          "additional_info":ps.additional_info
        }
      } else {
        return {
          "state":"starting", 
          "additional_info":ps.additional_info
        }

      }
    default:
      return {
        "state":ps.state.toLowerCase(),
        "additional_info":ps.additional_info
      }
      break;
  }
}

function format_dyno(ps) {
  let info = state_map(ps)
  let dyno_name = `${ps.type}.${ps.name}`
  let spacing = (dyno_name.length > 30) ? "  " : (" ".repeat(32 - (dyno_name.length + 2)));
  if(info.warning) {
    if(info.state === 'crashed') {
      return ` ${dyno_name}:${spacing}!!${info.state}!! ###${ps.updated_at}###\t##${info.warning}##`
    } else {
      return ` ${dyno_name}:${spacing}~~~${info.state}~~~ ###${ps.updated_at}###\t##${info.warning}##`
    }
  }
  if(info.state === 'stopping' || info.state === 'stopped' || info.state === 'pending' || info.state === 'starting') {
    return  ` ${dyno_name}:${spacing}~~${info.state}~~ ###${ps.updated_at}###`
  }
  return ` ${dyno_name}:${spacing}^^^${info.state}^^^ ###${ps.updated_at}###`
}

function format_sizes(ps) {
  return `**👾 ${ps.name}**
  ***Memory: *** ${ps.resources.limits.memory}
  ***CPU:    *** Shared
  ***Price:  *** $${ps.price}/Mo\n`
}

function destroy(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.TYPE && args.TYPE !== '', 'A dyno type (e.g., web, worker) was not provided.');

  appkit.api.get('/apps/' + args.app + '/formation/' + args.TYPE, (err, formation) => {
    if(err) {
      return appkit.terminal.error(err)
    }
    let del = (input) => {
      if(input === args.app) {
        let task = appkit.terminal.task(`Destroying **⬢ ${args.app}::${args.TYPE}**`);
        task.start();
        appkit.api.delete('/apps/' + args.app + '/formation/' + args.TYPE, (err, del_info) => {
          if(err) {
            task.end('error');
            return appkit.terminal.error(err);
          }
          task.end('ok');
        });
      } else {
        appkit.terminal.soft_error(`Confirmation did not match !!${args.app}!!. Aborted.`);
      }
    };

    if(args.confirm) {
      del(args.confirm);
    } else {
      appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete **⬢ ${args.app}::${args.TYPE}**.\n ~~▸~~    To proceed, type !!${args.app}!! or re-run this command with !!--confirm ${args.app}!!\n`, del);
    }
  })
}

function list(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app + '/formation', (err, formations) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    if(formations.length === 0) {
      return console.log(appkit.terminal.markdown('###===### No processes/dynos were found.'));
    }
    appkit.api.get('/apps/' + args.app + '/dynos', (err, dynos) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      formations.forEach((formation) => {
        console.log(appkit.terminal.markdown(format_formation(formation)));
        let form_dynos = dynos.filter((x) => { return x.type === formation.type; });
        form_dynos.forEach((dyno) => {
          // no idea why kubernetes on the first launch reports... the first year of the first month
          // of the first day. in this year BC, we deployed your app.
          if(dyno.updated_at === '0001-01-01T00:00:00Z') {
            dyno.updated_at = 'unknown';
          } else {
            dyno.updated_at = new Date(dyno.updated_at);
            dyno.updated_at = dyno.updated_at.toLocaleString();
          }
          console.log(appkit.terminal.markdown(format_dyno(dyno)));
        });
        if(form_dynos.length !== formation.quantity) {
          console.log(appkit.terminal.markdown(format_warning(formation, form_dynos)))
        }
      });
      console.log();
    });
  });
}

function list_plans(appkit,args) {
  appkit.api.get('/sizes', (err, sizes) =>{
    if(err) {
      return appkit.terminal.error(err);
    }
    if(sizes.lengh === 0 ) {
      return console.log(appkit.terminal.markdown('###===### No dyno sizes were found.'));
    }
    sizes.forEach((x) => {
      if (!x.name.includes("-prod")) {
        console.log(appkit.terminal.markdown(format_sizes(x)));
      }
    }); 
  });
}

function create(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.TYPE, 'No type was specified, this should be "web" if you need a web service, or "worker".');
  let payload = {
    size:args.size,
    quantity:args.quantity,
    command:args.command ? args.command : null,
    type:args.TYPE,
    healthcheck:args.healthcheck ? args.healthcheck : null,
  }
  payload.quantity = payload.quantity || 1;
  if(args.port) {
    payload.port = args.port;
  }
  let task = appkit.terminal.task(`Creating dyno for app ^^^${args.app}^^^, type **${args.TYPE}**`);
  task.start();
  appkit.api.post(JSON.stringify(payload), '/apps/' + args.app + '/formation', (err, data) => {
    if(err) {
      task.end('error');
      appkit.terminal.error(err);
    } else {
      task.end('ok');
      appkit.terminal.print(err, data);
    }
  });
}

function update(appkit, args) {
  if(args.TYPE && args.TYPE.indexOf('=') !== -1) {
    return appkit.terminal.error(new Error('Dyno name was invalid, perhaps you mean aka ps:scale?'));
  }
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.TYPE, 'No type was specified, this should be "web" if you need a web service, or "worker".');
  if(!args.size && !args.quantity && args.quantity !== 0 && !args.healthcheck && !args.removeHealthcheck && typeof(args.command) === 'undefined' && !args.port ) {
    return appkit.terminal.error(new Error('No new changes found for updating dyno formation.'));
  }
  let payload = {};
  if(args.size) {
    payload.size = args.size;
  }
  if(typeof(args.quantity) !== 'undefined' && args.quantity !== null) {
    payload.quantity = args.quantity;
  }
  if(args.command) {
    payload.command = args.command;
  }
  if(args.port) {
    payload.port = args.port;
  }
  if(args.healthcheck) {
    payload.healthcheck = args.healthcheck
  }
  if(args.removeHealthcheck) {
    payload.removeHealthcheck = true
  }

  let task = appkit.terminal.task(`Updating dyno for app ^^^${args.app}^^^, type **${args.TYPE}**`);
  appkit.api.patch(JSON.stringify(payload), '/apps/' + args.app + '/formation/' + args.TYPE, (err, data) => {
    if(err) {
      task.end('error');
      appkit.terminal.error(err);
    } else {
      task.end('ok');
      appkit.terminal.print(err, data);
    }
  });
}

function restart(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  let task = appkit.terminal.task(`Restarting **⬢ ${args.app}${args.TYPE ? ':' + args.TYPE : ''}**`);
  task.start();
  let urld = '/apps/' + args.app + '/dynos';
  if(args.TYPE) {
    urld += '/' + args.TYPE ;
  }
  appkit.api.delete(urld, (err, result) => {
    if(err) {
      task.end('error')
      appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}

function forward(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.PORT && args.PORT !== '', 'A port was not provided.');

  let task = appkit.terminal.task(`Updating port for web traffic on **⬢ ${args.app}** to ${args.PORT}`);
  task.start();
  appkit.api.patch(JSON.stringify({"port":args.PORT}), `/apps/${args.app}/formation/web`, (err, result) => {
    if(err) {
      task.end('error')
      appkit.terminal.error(err);
    } else {
      task.end('ok');
    }
  });
}

function scale(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app + '/formation', (err, formations) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    if(formations.length === 0) {
      return console.log(appkit.terminal.markdown('###===### Unable to increase dynos, no formation (or dyno types, processes, web, worker, etc) were found.'));
    }

    let scale = {};
    args['KEY_VALUE_PAIR'].forEach((x) => {
      if(x.indexOf('=') !== -1) {
        let n = x.split('=');
        let size = n[1].indexOf(':') === -1 ? [n[1], null] : n[1].split(':')
        scale[n[0]] = {"amount":parseInt(size[0], 10), "type":"equal", "size":size[1]};
      } else if (x.indexOf('+') !== -1) {
        let n = x.split('+');
        let size = n[1].indexOf(':') === -1 ? [n[1], null] : n[1].split(':')
        scale[n[0]] = {"amount":parseInt(size[0], 10), "type":"add", "size":size[1]};
      } else if (x.indexOf('-') !== -1) {
        let n = x.split('-');
        let size = n[1].indexOf(':') === -1 ? [n[1], null] : n[1].split(':')
        scale[n[0]] = {"amount":parseInt(size[0], 10), "type":"minus", "size":size[1]};
      }
    });
    let dyno_types = Object.keys(scale);

    for(let i=0; i < dyno_types.length; i++) {
      let current_dyno = formations.filter((y) => { return y.type === dyno_types[i]; })
      if(current_dyno.length === 0) {
        return appkit.terminal.error({body:'{"message":"The specified dyno type ' + dyno_types[i] + ' does not exist.","code":422}',code:422})
      } else if (scale[current_dyno[0].type].type === 'add') {
        scale[current_dyno[0].type].amount = scale[current_dyno[0].type].amount + current_dyno[0].quantity
        scale[current_dyno[0].type].type = 'equal'
      } else if (scale[current_dyno[0].type].type === 'minus') {
        scale[current_dyno[0].type].amount = current_dyno[0].quantity - scale[current_dyno[0].type].amount
        scale[current_dyno[0].type].type = 'equal'
        if(scale[current_dyno[0].type].amount < 0) {
          scale[current_dyno[0].type].amount = 0
        }
      }
    }

    let payload = [];
    for(let i=0; i < dyno_types.length; i++) {
      if (scale[dyno_types[i]].size) {
        payload.push({type:dyno_types[i], quantity:scale[dyno_types[i]].amount, size:scale[dyno_types[i]].size});
      } else {
        payload.push({type:dyno_types[i], quantity:scale[dyno_types[i]].amount});
      }
      if(!(!Number.isNaN(scale[dyno_types[i]].amount) && Number.isInteger(scale[dyno_types[i]].amount) && scale[dyno_types[i]].amount > -1 && scale[dyno_types[i]].amount < 30)) {
        return appkit.terminal.error({body:'{"message":"Invalid quantity (' + scale[dyno_types[i]].amount + ') for dyno type ' + dyno_types[i] + '.","code":422}',code:422});
      }
    }
    let string_types = Object.keys(scale).map((x) => `${x}=${scale[x].amount}${scale[x].size ? ':' + scale[x].size : ''}` ).join(', ')
    let task = appkit.terminal.task(`Scaling **⬢ ${args.app}** ${string_types} processes`);
    task.start();

    appkit.api.patch(JSON.stringify(payload), `/apps/${args.app}/formation`, (err, data) => {
      if(err) {
        task.end('error');
        appkit.terminal.error(err);
      } else {
        task.end('ok');
      }
    });
  });
}

function stop(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.DYNO && args.DYNO !== '', 'No dyno was specified, use ak ps -a [app] to get a list of running dynos.');

  if(args.DYNO.indexOf('.') === -1) {
    console.log("No running dyno was specified, e.g., web.324ksd232-321e, see list below.");
    console.log()
    list(appkit, args);
    return;
  }
  let task = appkit.terminal.task('Stopping dyno ' + args.DYNO);
  task.start();
  appkit.api.post('', '/apps/' + args.app + '/dynos/' + args.DYNO + '/actions/stop', (err, result) => {
    if(err) {
      task.end('error');
      return appkit.terminal.error(err);
    } else {
      task.end('ok');
      appkit.terminal.print(err, result);
    }
  });
}

module.exports = {
  init:function(appkit) {
    const require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      }
    };

    const require_formation_create_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      },
      'size':{
        'alias':'s',
        'demand':false,
        'string':true,
        'description': 'The size of the dyno to provision (see ak ps:sizes)'
      },
      'quantity':{
        'alias':'q',
        'demand':false,
        'integer':true,
        'default':null,
        'description':'How many instances of the server/process'
      },
      'command':{
        'alias':'c',
        'demand':false,
        'string':true,
        'description':'The command to run on the build image when deploying (defaults to default image run command)'
      },
      'port':{
        'alias':'p',
        'demand':false,
        'integer':true,
        'description':'The port to use for web processes (web dyno only, between 1024-65535)'
      },
      'healthcheck':{
        'alias':'h',
        'demand':false,
        'string':true,
        'description':'Healtheck endpoint for checking app readiness (web dyno only, must be valid URI /path)'
      },
      'removeHealthcheck':{
        'alias':'r',
        'demand':false,
        'description':'Remove active healthcheck'
      }
    };

    const require_confirm_app_option = {
      ...require_app_option,
      'confirm':{
        'alias': 'c',
        'demand': false,
        'string': true,
        'description': 'Confirm (in advance) the name of the app that owns the dyno to destroy'
      }
    }

    appkit.args
      .command('ps', 'List dynos for an app', require_app_option, list.bind(null, appkit))
      .command('ps:create TYPE', 'Create a new dyno', require_formation_create_option, create.bind(null, appkit))
      .command('ps:update TYPE', 'Update dyno settings', require_formation_create_option, update.bind(null, appkit))
      .command('ps:forward PORT', 'Forward web traffic to specific port', require_app_option, forward.bind(null, appkit))
      .command('ps:destroy TYPE', 'Permanently delete a dyno', require_confirm_app_option, destroy.bind(null, appkit))
      .command('ps:kill DYNO', 'Stop a dyno', require_app_option, stop.bind(null, appkit))
      .command('ps:restart [TYPE]', 'Restart a dyno', require_app_option, restart.bind(null, appkit))
      .command('ps:scale [KEY_VALUE_PAIR..]', 'Scale dyno quantity up or down (dyno=quantity, e.g, web=2)', require_app_option, scale.bind(null, appkit))
      .command('ps:sizes', 'List available dyno sizes',{}, list_plans.bind(null,appkit))
      //.command('ps:copy FILE')
      //.command('ps:socks')
      //.command('ps:exec COMMAND')
      //.command('ps:resize', '', require_app_option, resize.bind(null, appkit))
      //.command('ps:type [TYPE | DYNO=TYPE [DYNO=TYPE ...]]', 'manage dyno types', require_app_option, type.bind(null, appkit))
      // Aliases
      .command('ps:stop DYNO', false, require_app_option, stop.bind(null, appkit))
      .command('forward PORT', false, require_app_option, forward.bind(null, appkit))
      .command('restart [TYPE]', false, require_app_option, restart.bind(null, appkit))
      .command('scale [KEY_VALUE_PAIR..]', false, require_app_option, scale.bind(null, appkit))
      .command('sizes', false, {}, list_plans.bind(null,appkit))

  },
  update:function() {
    // do nothing.
  },
  group:'ps',
  help:'manage dynos (servers) including workers',
  primary:true
}
