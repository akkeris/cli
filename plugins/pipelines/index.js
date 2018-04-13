"use strict"
const util = require('util')

function format_pipeline(pipeline) {
  return `** ᱿ ${pipeline.name}**
  ***Id:*** ${pipeline.id}
  ***Created:*** ${(new Date(pipeline.created_at)).toLocaleString()}\n`; 
}

function format_pipeline_couplings(pipeline_couplings) {
  return `** ᱿ ${pipeline_couplings.stage}**
  ***Id:*** ${pipeline_couplings.id}
  ***App:*** ${pipeline_couplings.app.name} (${pipeline_couplings.app.id})\n`; 
}

function list(appkit, args) {
  appkit.api.get('/pipelines', appkit.terminal.format_objects.bind(null, format_pipeline, appkit.terminal.markdown('###===### No pipelines were found.')));
}

function info(appkit, args) {
  console.assert(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  appkit.api.get('/pipelines/' + args.PIPELINE, appkit.terminal.print);
}

function list_apps_info(appkit, args) {
  console.assert(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  appkit.api.get('/pipelines/' + args.PIPELINE + '/pipeline-couplings', appkit.terminal.format_objects.bind(null, format_pipeline_couplings, appkit.terminal.markdown('###===### No pipeline couplings were found.')))
}

function add(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  let payload = {app:args.app, pipeline:args.PIPELINE, stage:args.stage};
  appkit.api.post(JSON.stringify(payload),'/pipeline-couplings', appkit.terminal.print);
}

function diff(appkit, args) {
  console.log('this feature is not yet implemented.');
}


async function find_release(appkit, app, release_key) {
  let get = util.promisify(appkit.api.get)
  if(/^[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}$/.exec(release_key) !== null) {
    // uuuid
    return await get(`/apps/${app}/releases/${release_key}`)
  } else if (/^v[0-9]+$/.exec(release_key) !== null || !Number.isNaN(parseInt(release_key, 10))) {
    // vNNN format
    let version = parseInt(release_key, 10)
    if(Number.isNaN(version)) {
      version = parseInt(release_key.substring(1), 10)
    }
    console.assert(!Number.isNaN(version), 'The version, was not... a version.')
    let results = await get(`/apps/${app}/releases`)
    results = results.filter((x) => x.version === version)
    console.assert(results.length === 1, `The version ${version} was not found.`)
    return results[0]
  } else if (release_key === 'previous') {
    // not current, but one before
    let results = await get(`/apps/${app}/releases`)
    console.assert(results.length > 1, 'A previous release was not found.')
    return results[results.length - 2]
  } else {
    // current release
    let results = await get(`/apps/${app}/releases`)
    console.assert(results.length > 0, 'No releases were found.')
    return results[results.length - 1]
  }
}

async function promote(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  let apps = args.to ? args.to : [];
  apps = apps.map((x) => { return x.split(','); });
  apps = [].concat.apply([], apps).filter((x) => { if (x.trim() === '') return false; else return true; });

  let task = appkit.terminal.task(`Promoting app **⬢ ${args.app}**`);
  task.start();

  let begin_pipeline_stages = function() {
    appkit.api.get('/pipeline-stages', (err, stages) => {
      if(err) {
        task.end('error');
        return appkit.terminal.error(err);
      }
      // promote to all apps that are a target
      // 1. get the pipeline for this app.
      appkit.api.get('/apps/' + args.app + '/pipeline-couplings', (err, pipeline_coupling) => {
        if(err) {
          task.end('error');
          return appkit.terminal.error(err);
        }
        if(stages[pipeline_coupling.stage] === null) {
          task.end('error');
          return appkit.terminal.error("The specified application to promote does not have a promotion target and cannot be promoted.");
        }
        let source_app = pipeline_coupling.app;
        let pipeline = pipeline_coupling.pipeline;

        // 2. get the pipeline couplings for this pipeline.
        appkit.api.get('/pipelines/' + pipeline_coupling.pipeline.id + '/pipeline-couplings', (err, pipeline_couplings) => {
          if(err) {
          task.end('error');
            return appkit.terminal.error(err);
          }

          // Ensure we can actually send to all the specified apps, or if none were specified, get a list
          // of apps we can and include them all. 
          let possible_apps_stages = pipeline_couplings.filter((x) => { return stages[pipeline_coupling.stage] === x.stage; });
          let possible_apps = possible_apps_stages.map((pl) => { return pl.app; });
          if(apps.length === 0) {
            if(possible_apps.length === 0) {
              task.end('error');
              return appkit.terminal.error("The specified application has no downstream apps to promote to.");
            }
            apps = possible_apps;
          } else {
            let filtered_apps = possible_apps.filter((papp) => {
              return apps.some((app) => { return app === papp.id || app === papp.name; });
            });
            if(apps.length !== filtered_apps.length) {
              task.end('error');
              return appkit.terminal.error("The specified app(s) to promote to was invalid, possible targets: " +  possible_apps.map((x) => { return x.name; }).join(','));
            }
            apps = filtered_apps;
          }



          // Promote the applications
          let payload = {pipeline:pipeline, source:{app:source_app}};
          if(args.release) {
            payload.source.app.release = {"id":args.release};
          }
          payload.targets = apps.map((x) => { return {app:x}; });
          if (!args.unsafe){
            payload.safe = "true";
          }
          appkit.api.post(JSON.stringify(payload), '/pipeline-promotions', (err, result) => {
            if(err) {
              task.end('error');
              return appkit.terminal.error(err);
            }
            let from = pipeline_couplings.filter((x) => { return x.app.id === result.source.app.id; }).map((x) => { return x.stage; });
            let to = pipeline_couplings.filter((x) => { return payload.targets.map((y) => { return y.app.id; }).indexOf(x.app.id) !== -1; }).map((x) => { return x.stage; }).filter((v,i,s) => { return s.indexOf(v) === i; });
            task.end('ok');
            console.log();
            console.log(appkit.terminal.markdown(`** ᱿ ${pipeline.name} pipeline** (${from.join(',')} -> ${to.join(',')})

Promoted: **⬢ ${result.source.app.name}-${result.source.space.name}** (Release: ${result.source.release.id || args.release})
      To: ${payload.targets.map((x) => { return '**⬢ ' + x.app.name + '** ' }).join('\n\t  ')}
`));
          });
        });
      });
    });
  }

  if(args.release) {
    let release = await find_release(appkit, args.app, args.release)
    console.assert(release, `The release ${args.release} could not be found.`)
    args.release = release.id
  }
  begin_pipeline_stages()
}

function remove(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app + '/pipeline-couplings', (err, pipeline_coupling) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    appkit.api.delete('/pipeline-couplings/' + pipeline_coupling.id, appkit.terminal.print);
  });
}

function rename(appkit, args) {
  console.log('this feature is not yet implemented.')
}

function update(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  console.assert(args.stage && args.stage !== '', 'A stage was not provided.');
  // remove the app from pipeline coulings, recreate the pipeline coupling with the specified stage.
  appkit.api.get('/apps/' + args.app + '/pipeline-couplings', (err, pipeline_coupling) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    appkit.api.delete('/pipeline-couplings/' + pipeline_coupling.id, (err, result) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      let payload = {app:args.app, pipeline:pipeline_coupling.pipeline.id, stage:args.stage};
      appkit.api.post(JSON.stringify(payload),'/pipeline-couplings', appkit.terminal.print);
    });
  });
}

function create(appkit, args) {
  console.assert(args.NAME && args.NAME !== '', 'A name for the pipeline was not provided.');
  appkit.api.post(JSON.stringify({name:args.NAME}), '/pipelines', appkit.terminal.print);
}

function destroy(appkit, args) {
  console.assert(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  appkit.api.delete('/pipelines/' + args.PIPELINE, appkit.terminal.print);
}

let require_app_option = {
  'app':{
    'alias':'a',
    'demand':true,
    'string':true,
    'description':'The app to act on.'
  }
};

let require_app_stage_option = JSON.parse(JSON.stringify(require_app_option));
require_app_stage_option.stage = {"alias":"s","description":"stage of pipeline [review, development, staging, production]","choices":["review", "development", "staging", "production"],"demand":true};

let require_app_promote_option = JSON.parse(JSON.stringify(require_app_option));
require_app_promote_option.to = {
  "alias":"t", 
  "description":"comma separated list of apps to promote to", 
  array:true
};
require_app_promote_option.release = {
  'alias':'r',
  'demand':false,
  'string':true,
  'description':'The release uuid to promote, otherwise the latest release is used.'
}
require_app_promote_option.unsafe = {
  'alias':'u',
  'demand':false,
  'string':true,
  'description':'Request an unsafe promotion, which will proceed even if missing config vars or addons are found in the destination app.'
}

module.exports = {

  init:function(appkit) {
    appkit.args
      .command('pipelines', 'list all pipelines.', {}, list.bind(null, appkit))
      .command('pipelines:add PIPELINE', 'add this app to a pipeline.', require_app_stage_option, add.bind(null, appkit))
      .command('pipelines:create NAME', 'create a new pipeline', {}, create.bind(null, appkit))
      .command('pipelines:destroy PIPELINE', 'destroys a pipeline', {}, destroy.bind(null, appkit))
      //.command('pipelines:diff', 'compares the latest release of this app to its downstream apps', {}, diff.bind(null, appkit))
      .command('pipelines:info PIPELINE', 'show the list of apps in a pipeline', {}, list_apps_info.bind(null, appkit))
      .command('pipelines:list', 'list pipelines you have access to', list.bind(null, appkit))
      .command('pipelines:promote', 'promote the latest release of this app to its downstream apps(s)', require_app_promote_option, promote.bind(null, appkit))
      .command('promote', false, require_app_promote_option, promote.bind(null, appkit))
      .command('pipelines:remove', 'remove this app from its pipeline', require_app_option, remove.bind(null, appkit))
      //.command('pipelines:rename', 'rename a pipeline', {}, rename.bind(null, appkit))
      .command('pipelines:update', 'update this app\'s stage in a pipeline', require_app_stage_option, update.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'pipelines',
  help:'promote one app to one or more other app(s)',
  primary:true
}
