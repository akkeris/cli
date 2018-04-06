"use strict"
const util = require('util')

function getDateDiff(date /*: Date */) {
    var seconds = Math.floor((new Date() - date) / 1000);
    var interval = Math.floor(seconds / 31536000);
    if (interval > 1) {
      return `${interval} years ago`;
    }
    if (interval === 1) {
      return `${interval} year ago`;
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
      return `${interval} months ago`;
    }
    if (interval === 1) {
      return `${interval} month ago`;
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
      return `${interval} days ago`;
    }
    if (interval === 1) {
      return `${interval} day ago`;
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
      return `${interval} hours ago`;
    }
    if (interval === 1) {
      return `${interval} hour ago`;
    }
    interval = Math.floor(seconds / 60);
    return `${interval} minutes ago`;
  }

function format_release(release) {
  console.assert(release.build, 'No build information was found.')
  let info = [
    release.current ? "^^^current^^^" : "", 
    release.description,
    release.build.source_blob.author, 
    release.build.source_blob.message ? `##${release.build.source_blob.message.replace(/#/g, '').replace(/\s+/g, ' ')}##` : '',
    release.build.source_blob.commit ? `${release.build.source_blob.commit.substring(0, 7)}` : '', 
  ].filter(x => x && x !== '').map((x) => x.toString().replace(/\n/g, ' '));
  return `**• v${release.version}**\t${getDateDiff(new Date(release.created_at))}\t${info.join(' - ')}`
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

async function list(appkit, args) {
  try {
    let get = util.promisify(appkit.api.get)
    console.assert(args.app && args.app !== '', 'An application name was not provided.');
    let results = await get(`/apps/${args.app}/releases`)
    if(results.length === 0) {
      return console.log(appkit.terminal.markdown('###===### No releases were found.'))
    }
    let obj = args.all === true || results.length < 11 ? results : results.slice(results.length - 10)
    obj = await Promise.all(obj.map(async (release) => Object.assign(release, {build:await get(`/slugs/${release.slug.id}`)}) ))
    obj.map(format_release).map(appkit.terminal.markdown).map((x) => console.log(x))
  } catch (e) {
    return appkit.terminal.error(e)
  }
}

function wait_for_build(appkit, app, build_id, callback, iteration) {
  if(typeof(iteration) === 'undefined') {
    iteration = 0
  }
  if(iteration === 5 * 60) {
    return callback(new Error('Timeout occured'))
  } else {
    appkit.api.get(`/apps/${app}/builds/${build_id}`, (err, build) => {
      if(err) {
        return callback(err)
      } else {
        if(build.status === 'succeeded') {
          return callback(null, build)
        } else if (build.status === 'failed') {
          return callback(new Error('build failed.'))
        } else {
          process.stdout.write('\b..')
          setTimeout(wait_for_build.bind(null, appkit, app, build_id, callback, (iteration + 1)), 1000)
        }
      }
    });
  }
}

function create(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  
  let task = appkit.terminal.task(`Deploying **⬢ ${args.URL} to ${args.app} **`);
  task.start();
  
  appkit.api.get(`/apps/${args.app}/features`, (err, features) => {
    if(err) {
      appkit.terminal.error(err)
    } else {
      let auto_release_enabled = features.filter((x) => x.name === 'auto-release' && x.enabled === true).length === 1
      if(auto_release_enabled) {
        let payload = { org:app.organization.name, checksum:'', url:args.URL, repo:'', sha:'', branch:'', version:args.version }
        appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/builds`, (err, build) => {
          if(err) {
            task.end('error')
            return appkit.terminal.error(err);
          }
          task.end('ok');
        });
      } else {
        let payload = { checksum:'', url:args.URL, repo:'', sha:'', branch:'', version:args.version }
        appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/builds`, (err, build) => {
          if(err) {
            task.end('error')
            return appkit.terminal.error(err);
          }
          wait_for_build(appkit, args.app, build.id, (err, result) => {
            if(err) {
              task.end('error')
              return appkit.terminal.error(err);
            }
            appkit.api.post(JSON.stringify({"version":args.version, "slug":result.id}), `/apps/${args.app}/releases`, (err, result) => {
              if(err) {
                task.end('error')
                return appkit.terminal.error(err);
              }
              task.end('ok');
            });
          })
        })
      }
    }
  })
}

async function info(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  if(args.RELEASE === '' || !args.RELEASE) {
    args.RELEASE = 'latest';
  }
  try {
    appkit.terminal.print(null, 
      await find_release(appkit, args.app, args.RELEASE))
  } catch (err) {
    return appkit.terminal.error(err)
  }
}

async function rollback(appkit, args) {
  let post = util.promisify(appkit.api.post)
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  let task = appkit.terminal.task(`Rolling back **⬢ ${args.app}**`);
  task.start();
  if(args.RELEASE === '' || !args.RELEASE) {
    args.RELEASE = 'previous';
  }
  try {
    let release = await find_release(appkit, args.app, args.RELEASE)
    post(JSON.stringify({release:release.id, description:args.version}), `/apps/${args.app}/releases`);
    task.end('ok')
  } catch (err) {
    task.end('error')
    appkit.terminal.error(err)
  }
}


module.exports = {
  init:function(appkit) {
    let all_option = {
      'all':{
        'default':false,
        'demand':false,
        'boolean':true,
        'description':'Show all of the releases not just the last 10.'
      }
    }
    let create_release_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to deploy to.'
      },
      'version':{
        'alias':'v',
        'demand':false,
        'string':true,
        'description':'Notes or an internal version number for this release.'
      }
    }
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    };
    let require_rollback_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to rollback.'
      }
    };
    appkit.args
      .command('releases', 'list releases on an app', Object.assign(require_app_option, all_option), list.bind(null, appkit))
      .command('releases:create URL', 'deploy a new version of code from a zip, tgz or docker URL', create_release_option, create.bind(null, appkit))
      .command('releases:info [RELEASE]', 'view release info', require_app_option, info.bind(null, appkit))
      .command('releases:rollback [RELEASE]', 'rollback to a previous release on an app', require_rollback_option, rollback.bind(null, appkit))
      // aliases
      .command('release', false, Object.assign(require_app_option, all_option), list.bind(null, appkit))
      .command('releases:list', false, Object.assign(require_app_option, all_option), list.bind(null, appkit))
      .command('release:list', false, Object.assign(require_app_option, all_option), list.bind(null, appkit))
      .command('release:create URL', false, create_release_option, create.bind(null, appkit))
      .command('release:info [RELEASE]', false, require_app_option, info.bind(null, appkit))
      .command('release:rollback [RELEASE]', false, require_rollback_option, rollback.bind(null, appkit))
      .command('rollback [RELEASE]', false, require_rollback_option, rollback.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'releases',
  help:'manage releases (create, list, rollback)',
  primary:true
}