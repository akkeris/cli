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

/*

function prep() {
  //git archive --format tar HEAD | gzip --best -c
}

function parse_release(release) {
  console.assert(release, `Invalid inputed value ${release}`)
  let field = 'version'
  let search = release
  if(isNaN(parseInt(release, 10))) {
    if(release.toLowerCase().trim()[0] === 'v' && !isNaN(parseInt(release.toLowerCase().trim()substring(1), 10))) {
      // This is in the format vXXX
      field = 'version'
      release = release.toLowerCase().trim()
    } else if (/^[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}$/.exec(release) !== null) {
      // most likely a uuid
      field = 'id'    
      release = release.toLowerCase().trim()
    } else {
      console.assert(false, `Invalid input ${release}`)
    }
  } else {
    // this is probably a release number with out the version
    release = 'v' + release.toLowerCase().trim()
  }
  return {
    field,
    search
  }
}
*/

function list(appkit, args) {
  let get = util.promisify(appkit.api.get)
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get(`/apps/${args.app}/releases`, async(err, results) => {
    try {
      if(results.length === 0) {
        return console.log(appkit.terminal.markdown('###===### No releases were found.'))
      }
      let obj = args.all === true ? results : results.slice(results.length - 10)
      obj = await Promise.all(obj.map(async (release) => Object.assign(release, {build:await get(`/slugs/${release.slug.id}`)}) ))
      obj.map(format_release).map(appkit.terminal.markdown).map((x) => console.log(x))
    } catch (e) {
      console.error(e)
    }
  });
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

function info(appkit, args) {
  //TODO: Support uuid's, vNNN
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  if(args.RELEASE === '' || !args.RELEASE) {
    args.RELEASE = 'latest';
  }
  let fetch_release_info = () => {
    appkit.api.get(`/apps/${args.app}/releases/${args.RELEASE}`, appkit.terminal.print);
  };
  if(args.RELEASE.toLowerCase() === "latest" || args.RELEASE.toLowerCase() === "current") {
    appkit.api.get(`/apps/${args.app}/releases`, (err, releases) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      args.RELEASE = releases[releases.length - 1].id;
      fetch_release_info();
    });
  } else {
    fetch_release_info();
  }
}

function rollback(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');

  let task = appkit.terminal.task(`Rolling back **⬢ ${args.app}**`);
  task.start();
  let done = (err) => {
    if(err) {
      task.end('error')
      return appkit.terminal.error(err);
    }
    task.end('ok')
  }
  //TODO: Support uuid's, vNNN
  if(Number.isNaN(parseInt(args.RELEASE))) {
    appkit.api.post(JSON.stringify({release:args.RELEASE, description:args.version}), `/apps/${args.app}/releases`, done);
  } else {
    appkit.api.get(`/apps/${args.app}/releases`, async(err, results) => {
      try {
        if(results.length === 0) {
          return console.log(appkit.terminal.markdown('###===### Cannot rollback, no releases were found.'))
        }
        if(results.length === 1) {
          return console.log(appkit.terminal.markdown('###===### Cannot rollback, theres only one release.'))
        }
        if(!args.RELEASE) {
          args.RELEASE = results[results.length - 2].id
        }
        appkit.api.post(JSON.stringify({release:args.RELEASE, description:args.version}), `/apps/${args.app}/releases`, done);
      } catch (e) {
        task.end('error')
        return appkit.terminal.error(e)
      }
    });
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