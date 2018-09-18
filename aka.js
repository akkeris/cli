#!/usr/bin/env node

"use strict"

const proc = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');

// Only check to updates when our last update check was this long ago (ms)
// Default - 86400000 (24 hours)
const AKA_UPDATE_INTERVAL = process.env.AKA_UPDATE_INTERVAL ? process.env.AKA_UPDATE_INTERVAL : 86400000;

// Filename of saved update information
// Default - .aka_version
const AKA_UPDATE_FILENAME = '.aka_version'

process.on('uncaughtException', (e) => {
  if(process.env.DEBUG) {
    console.error(e.message)
    console.error(e.stack)
  } else {
    console.log("An unexpected error occured, if this persists try running `mv ~/.akkeris ~/.akkeris.backup`.")
  }
})

function init_plugins(module, plugins_dir) {
  fs.readdirSync(plugins_dir).sort((a, b) => { return a < b ? -1 : 1 }).forEach((plugin => {
    if(path.basename(plugin).startsWith('.') || path.basename(plugin).startsWith("tmp")) {
      return;
    }
    try {
      if(fs.statSync(path.join(plugins_dir, plugin, 'index.js')).isFile()) {
        try {
          module.exports.plugins[plugin] = require(path.join(plugins_dir, plugin, 'index.js'));
        } catch (err) {
          console.log(module.exports.terminal.markdown(`\n !!▸!! error loading plugin "${plugin}": ${err}\n`));
        }
        if(module.exports.plugins[plugin] && module.exports.plugins[plugin].init) {
          try {
            module.exports.plugins[plugin].init(module.exports);
          } catch (err) {
            console.log(module.exports.terminal.markdown(`\n !!▸!! error initializing plugin "${plugin}": ${err}\n`));
          }
        }
      }
    } catch (err) {
      console.log(module.exports.terminal.markdown(`\n !!▸!! error initializing plugin "${plugin}": ${err}\n`));
    }
  }));
}

function get_home() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function create_dir(directory) {
  let stats = null;
  try {
    stats = fs.statSync(directory);
  } catch (e) {
    try {
      fs.mkdirSync(directory);
      stats = fs.statSync(directory);
    } catch (e) {
      console.error(`The plugins directory cannot be accessed, could not be created, or is a file (${directory}).`);
      return null;
    }
  }
}

function squirrel() {
  console.log(`
                              _
                          .-'\` \`}
                  _./)   /       }
                .'o   \\ |       }
                '.___.'\`.\\    {\`
                /\`\\_/  , \`.    }
                \\=' .-'   _\`\  {
                 \`'\`;/      \`,  }
                    _\\       ;  }
                   /__\`;-...'--'

                   SQUIRREL!

  `)
}

function set_profile(appkit, args, cb) {
  if(!args || !args.auth || !args.app) {
    appkit.terminal.question('Akkeris Auth Host (auth.example.com): ', (auth) => {
      appkit.terminal.question('Akkeris Apps Host (apps.example.com): ', (apps) => {
        appkit.terminal.question('Periodically check for updates? (y/n): ', (updates) => {
          if (auth.startsWith('https://') || auth.startsWith('http://')) {
            auth = (new url.URL(auth)).hostname
          }
          if (apps.startsWith('https://') || apps.startsWith('http://')) {
            apps = (new url.URL(apps)).hostname
          }
          if (updates.toLowerCase() === 'yes' || updates.toLowerCase() === 'y') {
            updates = "1"; 
          } else {
            updates = "0";
          }
          fs.writeFileSync(path.join(get_home(), '.akkeris', 'config.json'), JSON.stringify({auth, apps, updates}, null, 2));
          process.env.AKKERIS_API_HOST = apps
          process.env.AKKERIS_AUTH_HOST = auth
          process.env.AKKERIS_UPDATES = updates
          console.log("Profile updated!")
        });
      });
    });
  }
}

function load_profile() {
  if(!process.env.AKKERIS_API_HOST || !process.env.AKKERIS_AUTH_HOST) {
    try {
      let config = JSON.parse(fs.readFileSync(path.join(get_home(), '.akkeris', 'config.json')).toString('UTF8'))
      process.env.AKKERIS_AUTH_HOST = config.auth;
      process.env.AKKERIS_API_HOST = config.apps;
      process.env.AKKERIS_UPDATES = config.updates ? config.updates : 0;
    } catch (e) {
      if(process.argv && (process.argv[1] === 'auth:profile' || process.argv[2] === 'auth:profile' || process.argv[3] === 'auth:profile')) {
        return;
      }
      welcome()
    }
  }
}

function welcome() {
  console.log("")
  console.log("Hi! It looks like you might be new here. Lets take a second")
  console.log("to get started, you'll need your akkeris auth and apps host")
  console.log("in addition to your login and password.")
  console.log("")
  proc.spawnSync('ak',['auth:profile'], {env:process.env, stdio:'inherit'});
  proc.spawnSync('ak',['auth:login'], {env:process.env, stdio:'inherit'});
}

function check_for_updates(){
  const update_file_path = path.join(get_home(), '.akkeris', AKA_UPDATE_FILENAME).toString('utf8');
  // First time checking, need to create file
  if (!fs.existsSync(update_file_path)) {
    spawn_update_check(update_file_path);
    return {};
  } 
  else {
    const file_stats = fs.statSync(update_file_path);

    // If the CLI is up to date, the file will be empty
    if (file_stats.size < 1) {
      return {};
    }

    // Only check for updates when it's been at least AKA_UPDATE_INTERVAL ms since last check
    const last_update = file_stats.mtimeMs;
    if ((Date.now() - last_update) > AKA_UPDATE_INTERVAL) {
      spawn_update_check(update_file_path);
    }

    try {
      // Read current version and latest version from file
      let update_file = JSON.parse(fs.readFileSync(update_file_path))
      if (update_file.akkeris && update_file.akkeris.latest > update_file.akkeris.current) {
        return { current: update_file.akkeris.current, latest: update_file.akkeris.latest };
      }
    } catch (err) {
      // JSON parse error - invalid file. Delete and rebuild on next run
      if (process.env.DEBUG) { console.log(err); }
      fs.unlinkSync(update_file_path);
      return {};
    }
  }
}

// Run 'npm outdated akkeris --global --json' in the background
// Writes output to @param update_file_path
function spawn_update_check(update_file_path) {
  var output = fs.openSync(update_file_path, 'w');
  proc.spawn('npm outdated akkeris --global --json', {
    shell: true, 
    detached: true, 
    stdio: [ 'ignore', output, 'ignore' ] 
  }).unref();
}

// Initialize, setup any items at runtime
module.exports.init = function init() {

  // Set common dir paths
  let akkeris_home = path.join(get_home(), '.akkeris')
  let akkeris_plugins = path.join(get_home(), '.akkeris', 'plugins')
  let akkeris_base_plugins = path.join(path.dirname(module.filename), 'plugins')

  // Create necessary directories
  create_dir(akkeris_home)
  create_dir(akkeris_plugins)
  create_dir(akkeris_base_plugins)

  module.exports.terminal = require(path.join(__dirname, 'lib', 'terminal.js'))

  load_profile()

  module.exports.config = {
    plugins_dir:null, 
    akkeris_api_host:(process.env.AKKERIS_API_HOST),
    akkeris_auth_host:(process.env.AKKERIS_AUTH_HOST),
    package:JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json').toString('utf8')))
  };

  if (process.env.AKKERIS_UPDATES && process.env.AKKERIS_UPDATES === "1") {
    module.exports.update_available = check_for_updates()
  } else {
    module.exports.update_available = {};
  }

  // Establish the base arguments for the CLI.
  module.exports.args = require('yargs')
    .usage('Usage: akkeris COMMAND [--app APP] [command-specific-options]')
    .command('update', 'update the akkeris client', {}, module.exports.update.bind(null, module.exports))
    .command('version', 'display version', {}, module.exports.version.bind(null, module.exports))
    .command('squirrel', false, {}, squirrel)
    .command('auth:profile', 'Set the authorization endpoint and apps end point', {
        "apps":{ "description":"The URL for the apps API end point." },
        "auth":{ "description":"The URL for the auth API end point." }
      }, 
      set_profile.bind(null, module.exports))
    .command('completion', 'show akkeris auto-completion script (e.g, "ak completion >> ~/.bashrc").', {}, () => {
      module.exports.args.showCompletionScript();
    })
    .recommendCommands()
  // map cli width for yargs
  module.exports.args.wrap(module.exports.args.terminalWidth())
  module.exports.random_tips = [
    '🚀  Fun tip! You can use "latest" rather than a specific ID for builds and releases when getting info.',
  ];

  // load plugins
  module.exports.plugins = {};
  module.exports.config.plugins_dir = path.join(path.dirname(module.filename), 'plugins')
  module.exports.config.third_party_plugins_dir = path.join(get_home(), '.akkeris', 'plugins')
  require('./lib/plugins.js').init(module.exports.args, module.exports);

  console.assert(module.filename, 'No module.filename exists, no clue where we are. This is a very odd error.');
  
  // Scan and initialize the plugins as needed.
  init_plugins(module, module.exports.config.plugins_dir)
  init_plugins(module, module.exports.config.third_party_plugins_dir)
  
  // Grab netrc info
  const netrc = require('netrc')();
  module.exports.account = netrc[module.exports.config.akkeris_api_host];
}

module.exports.version = function version(appkit, args) {
  console.log("akkeris/" + appkit.config.package.version + " " + process.arch + "-" + process.platform + " node-" +process.version);
  console.log(appkit.terminal.markdown(`###===### Installed Plugins`));
  Object.keys(module.exports.plugins).forEach((plugin) => {
    console.log(module.exports.plugins[plugin].group + " " + (module.exports.plugins[plugin].version ? "@" + module.exports.plugins[plugin].group : ""))
  });
}

// Update our dependencies and our plugins as needed.
module.exports.update = function update(appkit) {
  console.assert(appkit.config.third_party_plugins_dir, 'Update was ran without init being ran first, everything is empty.');
  fs.readdirSync(appkit.config.third_party_plugins_dir).forEach((plugin => {
    try {
      if(fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, '.git')).isDirectory()) {
        console.log(appkit.terminal.markdown(`###===### updating ${plugin} plugin`));
        proc.spawnSync('git',['pull', '--quiet'], {cwd:path.join(appkit.config.third_party_plugins_dir, plugin), env:process.env, stdio:'inherit'});
        if(fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, 'index.js')).isFile()) {
          if(module.exports.plugins[plugin].update) {
            try {
              require(path.join(appkit.config.third_party_plugins_dir, plugin, 'index.js')).update(module.exports);
            } catch (err) {
              console.log(appkit.terminal.markdown(` !!▸!! error updating plugin "${plugin}": ${err}`));
            }
          }
        }
      }
    } catch (e) {
      // skip.
      if(process.env.NODE_DEBUG) {
        console.info(e);
      }
    }
  }));
  console.log(appkit.terminal.markdown(`###===### updating akkeris`));
  proc.spawnSync('npm',['update', '-g', 'akkeris'], {cwd:__dirname, env:process.env, stdio:'inherit'});
  
  // Clear 'update available' file
  fs.unlinkSync(path.join(get_home(), '.akkeris', AKA_UPDATE_FILENAME).toString('utf8'));
}

function is_redirect(type, res) { return type.toLowerCase() === 'get' && res.headers['location'] && (res.statusCode === 301 || res.statusCode === 302); }
function is_response_ok(res) { return res.statusCode > 199 && res.statusCode < 300 ? true : false; }
function response_body(type, callback, res) {
  let body = new Buffer(0);
  res.on('data', (e) => body = Buffer.concat([body,e]) );
  res.on('end', (e) => {
    if(res.headers['content-encoding'] === 'gzip' && body.length > 0) {
      body = zlib.gunzipSync(body);
    }
    if(is_redirect(type, res)) {
      get(res.headers['location'], headers, callback);
    } else if(is_response_ok(res)) {
      callback(null, res.headers['content-type'] === 'application/zip' ? body : body.toString('utf8'), res.headers);
    } else {
      callback({code:res.statusCode, body, headers:res.headers}, null);
    } 
  });
}

function request(type, payload, rurl, headers, callback) {
  let connector = rurl.startsWith('http://') ? http : https;
  let opts = url.parse(rurl);
  opts.method = type;
  opts.headers = headers || {};
  let req = connector.request(opts, response_body.bind(null, type, (e, d) => { 
    if(d) {
      d = JSON.parse(d)
    }
    callback(e,d);
  }));
  if(payload) {
    req.write(payload);
  }
  req.on('error', (err) => { callback(err); });
  req.end();
}

function appkit_request(type, payload, rurl, callback) {
  let headers = {};
  headers['content-type'] = headers['content-type'] || 'application/json';
  if(module.exports.account && module.exports.account.password) {
    headers['authorization'] = 'Bearer ' + module.exports.account.password;
  }
  if(module.exports.args && module.exports.args.argv && module.exports.args.argv.authtoken) {
    headers['authorization'] = 'Bearer ' + module.exports.args.argv.authtoken;
  }
  // Override for bearer token
  if(process.env.API_TOKEN) {
    headers['authorization'] = 'Bearer ' + process.env.API_TOKEN;
  }
  // Override if shared-secret is used
  if(process.env.API_AUTH) {
    headers['authorization'] = process.env.API_AUTH;
  }
  headers['accept-encoding'] = 'gzip'
  headers['user-agent'] = 'akkeris-cli';

  let full_url = rurl.startsWith("http") ? rurl : 
                ( (module.exports.config.akkeris_api_host.startsWith("http") ? 
                    module.exports.config.akkeris_api_host : 
                    'https://' + module.exports.config.akkeris_api_host) + rurl);
  request(type, payload, full_url, headers, callback);
}

module.exports.http = {
  get:request.bind(null, 'get', null),
  post:request.bind(null, 'post'),
  patch:request.bind(null, 'patch'),
  delete:request.bind(null, 'delete', null),
  put:request.bind(null, 'put')
}

module.exports.api = {
  get:appkit_request.bind(null, 'get', null),
  post:appkit_request.bind(null, 'post'),
  patch:appkit_request.bind(null, 'patch'),
  delete:appkit_request.bind(null, 'delete', null),
  put:appkit_request.bind(null, 'put')
}

if(require.main === module) {
  module.exports.init();

  const update_available = module.exports.update_available ? (Object.keys(module.exports.update_available).length !== 0) : false;
  let epilogue = '';
  if (update_available) {
    epilogue = module.exports.terminal.update_statement(module.exports.update_available.current, module.exports.update_available.latest);
  } else {
    epilogue = module.exports.random_tips[Math.floor(module.exports.random_tips.length * Math.random())]
  }
  
  module.exports.args
    .strict()
    .demand(1)
    .epilog(epilogue)
    .argv
}
