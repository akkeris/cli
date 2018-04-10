"use strict"

function format_formation(ps) {
  return `##===## ^^^${ps.type}^^^ (**${ps.size}**): ${ps.command ? ps.command : '(from docker)'} (~~~${ps.quantity}~~~)`;
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
  if(info.warning) {
    if(info.state === 'crashed') {
      let data = ` ${ps.type}.${ps.name}:\t!!${info.state}!! ###${ps.updated_at}###\t##${info.warning}##`
      return data
    } else {
      let data = ` ${ps.type}.${ps.name}:\t~~~${info.state}~~~ ###${ps.updated_at}###\t##${info.warning}##`
      return data
    }
  }
  if(info.state === 'stopping' || info.state === 'stopped' || info.state === 'pending' || info.state === 'starting') {
    let data = ` ${ps.type}.${ps.name}:\t~~${info.state}~~ ###${ps.updated_at}###`
    return data

  }
  let data = ` ${ps.type}.${ps.name}:\t^^^${info.state}^^^ ###${ps.updated_at}###`
  return data
}

function format_sizes(ps) {
  return `**👾 ${ps.name}**
  ***Memory: *** ${ps.resources.limits.memory}
  ***CPU:    *** Shared
  ***Price:  *** $${ps.price}/Mo\n`
}

function destroy(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.TYPE && args.TYPE !== '', 'A dyno type (e.g., web, worker) was not provided.');

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
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
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
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.TYPE, 'No type was specified, this should be "web" if you need a web service, or "worker".');
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
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.TYPE, 'No type was specified, this should be "web" if you need a web service, or "worker".');
  if(!args.size && !args.quantity && args.quantity !== 0 && !args.healthcheck && !args.removeHealthcheck && typeof(args.command) === 'undefined' && !args.port ) {
    throw new Error('No new changes found for updating dyno formation.');
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
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
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

function scale(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app + '/formation', (err, formations) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    if(formations.length === 0) {
      return console.log(appkit.terminal.markdown('###===### Unable to increase dynos, no formation (or dyno types, processes, web, worker, etc) were found.'));
    }


    let scale = {};
    args['TYPE=AMOUNT'].forEach((x) => {
      if(x.indexOf('=') !== -1) {
        let n = x.split('=');
        scale[n[0]] = {"amount":parseInt(n[1], 10), "type":"equal"};
      } else if (x.indexOf('+') !== -1) {
        let n = x.split('+');
        scale[n[0]] = {"amount":parseInt(n[1], 10), "type":"add"};
      } else if (x.indexOf('-') !== -1) {
        let n = x.split('-');
        scale[n[0]] = {"amount":parseInt(n[1], 10), "type":"minus"};
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
      if (args.size) {
        payload.push({type:dyno_types[i], quantity:scale[dyno_types[i]].amount, size:args.size});
      } else {
        payload.push({type:dyno_types[i], quantity:scale[dyno_types[i]].amount});
      }
      if(!(!Number.isNaN(scale[dyno_types[i]].amount) && Number.isInteger(scale[dyno_types[i]].amount) && scale[dyno_types[i]].amount > -1 && scale[dyno_types[i]].amount < 30)) {
        return appkit.terminal.error({body:'{"message":"Invalid quantity (' + scale[dyno_types[i]].amount + ') for dyno type ' + dyno_types[i] + '.","code":422}',code:422});
      }
    }
    let string_types = Object.keys(scale).map((x) => `${x}=${scale[x].amount}` ).join(', ')
    let task = appkit.terminal.task(`Scaling **⬢ ${args.app}** ${string_types} processes`);
    task.start();

    appkit.api.patch(JSON.stringify(payload), '/apps/' + args.app + '/formation', (err, data) => {
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
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.DYNO && args.DYNO !== '', 'No dyno was specified, use ak ps -a [app] to get a list of running dynos.');

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
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    };
    let require_formation_create_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      },
      'size':{
        'alias':'s',
        'demand':false,
        'string':true,
        'choices':[undefined, 'scout', 'constellation', 'akira', 'galaxy', 'sovereign'],
        'description':'The size of the dyno to provision (see ak ps:sizes)'
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
        'description':'The command to run on the build image when deploying, leaving this blank will use the default run command in the image.'
      },
      'port':{
        'alias':'p',
        'demand':false,
        'integer':true,
        'description':'The port to use for web running processes, this must be a value between 1024 and 65535, it can only be set when type is web.'
      },
      'healthcheck':{
        'alias':'h',
        'demand':false,
        'string':true,
        'description':'The healtheck endpoint for checking app ready, this must be a valid uri (/path), it can only be set when type is web.'
      },
      'removeHealthcheck':{
        'alias':'r',
        'demand':false,
        'description':'will remove active healthcheck'
      }
    };
    appkit.args
      .command('ps', 'list dynos for an app', require_app_option, list.bind(null, appkit))
      .command('ps:create TYPE', 'create a type of dyno', require_formation_create_option, create.bind(null, appkit))
      .command('ps:update TYPE', 'update a type of dyno', require_formation_create_option, update.bind(null, appkit))
      .command('ps:destroy TYPE', 'deletes a type of dyno', require_app_option, destroy.bind(null, appkit))
      .command('ps:kill DYNO', 'stop a dyno', require_app_option, stop.bind(null, appkit))
      .command('ps:restart [TYPE]', 'restart app dynos', require_app_option, restart.bind(null, appkit))
      .command('ps:scale [TYPE=AMOUNT ...]', 'scale dyno quantity up or down', require_app_option, scale.bind(null, appkit))
      .command('ps:stop DYNO', 'stop a dyno', require_app_option, stop.bind(null, appkit))
      .command('ps:sizes', 'list dyno sizes',{}, list_plans.bind(null,appkit))

      // aliases
      .command('restart [TYPE]', false, require_app_option, restart.bind(null, appkit))
      .command('scale [TYPE=AMOUNT ...]', false, require_app_option, scale.bind(null, appkit))
      .command('sizes', false, {}, list_plans.bind(null,appkit))
      //.command('ps:resize', '', require_app_option, resize.bind(null, appkit))
      //.command('ps:type [TYPE | DYNO=TYPE [DYNO=TYPE ...]]', 'manage dyno types', require_app_option, type.bind(null, appkit))
      //ps:copy FILE
      //ps:exec
      //ps:forward PORT
      //ps:socks
      //ps [TYPE [TYPE ...]]
  },
  update:function() {
    // do nothing.
  },
  group:'ps',
  help:'manage dynos (servers) including workers',
  primary:true
}
