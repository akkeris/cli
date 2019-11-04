#!/usr/bin/env node

"use strict"

const assert = require('assert')
const spawn = require('cross-spawn');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const inquirer = require('inquirer');
const fuzzy = require('fuzzy');
const stringWidth = require('string-width');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

// Only check to updates when our last update check was this long ago (ms)
// Default - 86400000 (24 hours)
const AKA_UPDATE_INTERVAL = process.env.AKA_UPDATE_INTERVAL ? process.env.AKA_UPDATE_INTERVAL : 86400000;

// Filename of saved update information
// Default - .aka_version
const AKA_UPDATE_FILENAME = '.aka_version'

const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : s;

process.on('uncaughtException', (e) => {
  if(process.env.DEBUG) {
    console.error(e.message)
    console.error(e.stack)
  } else {
    console.log("An unexpected error occured, if this persists try running `mv ~/.akkeris ~/.akkeris.backup`.\n.  -> Pro tip: Add DEBUG=true to your environment for more information.")
  }
})

function init_plugins(m, plugins_dir, pluginName) {
  let success;
  fs.readdirSync(plugins_dir).sort((a, b) => { return a < b ? -1 : 1 }).forEach((plugin => {
    if(path.basename(plugin).startsWith('.') || path.basename(plugin).startsWith("tmp")) {
      return;
    }
    if (pluginName && plugin !== pluginName) {
      return;
    }
    try {
      if(fs.statSync(path.join(plugins_dir, plugin, 'index.js')).isFile()) {
        try {
          m.exports.plugins[plugin] = require(path.join(plugins_dir, plugin, 'index.js'));
        } catch (err) {
          console.log(m.exports.terminal.markdown(`\n !!▸!! error loading plugin "${plugin}": ${err}\n`));
        }
        if(m.exports.plugins[plugin] && m.exports.plugins[plugin].init) {
          try {
            m.exports.plugins[plugin].init(m.exports);
          } catch (err) {
            console.log(m.exports.terminal.markdown(`\n !!▸!! error initializing plugin "${plugin}": ${err}\n`));
          }
          success = true;
        }
      }
    } catch (err) {
      console.log(m.exports.terminal.markdown(`\n !!▸!! error initializing plugin "${plugin}": ${err}\n`));
    }
  }));
  return success || false;
}

function get_home() {
  return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
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

                      ''              .
                      +d/           -yd.
                      +mdy-...--..-/hdm.
                      'dmmdyhyyyyyhdmms
                       /mhhhhhddddddyd.
                       .dmyhhhhhhhdhhh
                       .yddyhhyyyhhyds
                      .ohhyyyssdysyhys-
                     .+yhyyhooydyoohys+'
                    -+syssys/:smh+/oso+-
                   -oyyysooo++sdy++oooo/
                  -oyyyoo+++++++//:+++so-
                 :yhyyo::-::::::::--::+yo
               '+hhyo/-...----:-------/yy.
               .hhssso+:-.....-.....--:+s/
               -dhshdys+-.'........-//ooo/
               'hmhhhddy+:--------/+oyhyy.
                ydmmddmddhy++:-:+ohhdddh+
               'oddddhhdmmhhhsoyyhdmmdy:'
               -sddmh++/ohdhdddhhhhdmm+
               /ydddy//::oso+oossoohmm+
               /yhdhy/:-:+/::::////hmd:
               /ydmdo--://:---:/:/odmo
              'syhds/o:::--.-::::/ymd+
              /sydho:::::-..-::::/omho'
             .syhdd+---::-..-::://sdhs.
             .sydhh+-:-::--.-:::/ohhys-
             :ohhss+///+/::-:+//++osyy/.'
            .ooo/++oshy++///+hy///+ooyo:..''
            :so+/:::+yyso+++sh+---/+ohys//-..'
            +hss+:-::/++/++///---:+oyhhyo/:-..'
            sdho+/:::://::/:::-:-/oshdmho++/-.'
            yddyy/://:/+///://::-:+ydmmdy+/:-.'
           'ymdhy+os+/+sysoohs////+sddNmh+::-'
            .hddhssoo+osdmdmmhso+oshddNmh+:.'
             .hddhhssssyhdmmdhhyyyhdddmds+.
              .hmmNmddmmmNMNNNNNNmmmmmy:'
         :/+oosshdmmddNNNNNmNNNmdhmdhyo:.
         -+ooo+ooo+/:--.''   ''./yysyhhho



                     SQUIRREL!

  `)
}

function squirrel_2() {
  `
                                                                0k       kO         
             xdx0        xO                                 0kxxddO   0lldox        
            c,;cd        c:ox                              O0ocllccO Od;;:cox      
           x;;;;:xkkkO0Oc,;llO                            Okol:::::dx;;,;::oOOodk0   
          0c;;;;;;;;:ccc;,;lcd                          kkxoc,,;,;l;''';;;c::cld0  
       Oo;;:;;;;;;;;:lllccclclO                          k:;:,','''''.''';;;:;clk    
     0:,;;;;,,,,'',;:cllolclccx                     kxd OOc,''.''....''.,;:;:lodO    
     c:::;;,,,',,:dkxxxoldoc;lxk                    kc:cccl;'.'....''.'',,;:cclx     
     c:;;;;:cc:ccxl'..ldoodoloxk                 Oxxol;,,,,,'.'..'.'''','::::oO      
     :'',::cccoooc;;,;xxodooodddk                xlxlc:,,,''......'..'.';;:ok0       
    k;.;cooccloxxxxOkkdoooooddddxO             Oolc;;c:;''''..........',,:odx        
    d'.,clxolodxxkkxxdxdddddddxxdd              0o:;,'','.............',;llokkk      
    kc,.,oooddxxxkkxxkkkxdddxxxooook            Odc:;,.''.............',;cclx0       
      Oocloddxxxxxxdxxxkkkkkxdoloooolodx         d:',''...............',;::oO0       
        Ol::clcoddddxkkOOOkxdolooooll:::ccclx    kc;''................',::odxk0      
          OxdoodkxxxkOOOkkxddolloollccc:cccccccd  x:'.................'.,:dokkx      
           kddddxxxxkOO0Oxxxdoloolcccc:ccccccccccdOc,..................,,;coxk       
          oodxddkkxkO000Okxdoooollccc:;:ccc:ccccccc:,'..................,;;cdxO      
         xlodxxxOOOOO00Okxdooodollllc::;::c::cccc:::,'.................''';;clO      
         olddkkkkkOO00Oxddolllolllcllc:::c::ccccc::;;'...................,,;:dO      
         llolkOkxkOOOkllolllolcllllllc::ccccccccc::;;,...................';cldkx     
        0cccokkkdkOOxocclccllclcclolcccclllllllccc:::;,.................',:cldxO     
        Oc:cdkxddOkxocccclolc:::cclllclllllclllllccc::;.................';::lxk      
        k;:ldxooxOdlc:;clllccccccccllclccccccclllclc::;'...............',::lodx0     
        x,coddoxklc::c:ccllcccc:cloddollllc::::cclcll:;'...............'';;clddk     
        oloooddoolcc:::cccc::::coxxkkxxxdol:;:ccclllc:;,................,,,:lox      
      Olccolllcccc:c;;;:;::;:coxkkkxddddoc:::ccclllc:;;,................',;clk       
     0;;;,:c:loolcccc:cc:::ccllooddddoolccccccclllloc:;,..'.............';xk0        
     0'..,',.:     xc;;:;;;::ccloddxdollccccllllllccc::;'..''.........',:cx          
      0xx:..dO      o;;;;,;:clodddxddollcccccllcllccc:::,''..........',lkO           
                     xc:;,;clllldddoollllllllllllllcc:::;''.......',,ldk             
                      0l:;;:clcllooollcllcllclclccc:::;;;,''.''.',;:ld0              
                       k:;,;:ccclooolcccclcllllccccc::;;,',,',',;codO0               
                        d:;,::::lloc:cccclllllclc:ccc:::;,,,,,;cdO0                  
                         kc;;;:;::c:;;:::ccccccccccccc:;;::ldxk0                     
                           Oo:;::;;,,;:;;;:::::::::c:::;;ck                          
                         k0 00xl::;;',;;,;:;;;;;;;:::;;;,;;ck                        
                     dc;...........,'','',,,,;;;,;;,,,,,;;coO                        
                    kxdc;;;;;;;,'........'.''''',,,,:codk                            
                     xc;:::::;;;:;;,.......',;:;loxO                                 
                     Oxo,:c;,;:ldxlldddxkkO0                                         
                   _____             _               _   _ 
                  / ____|           (_)             | | | |
                 | (___   __ _ _   _ _ _ __ _ __ ___| | | |
                  \\___ \\ / _  | | | | |  __|  __/ _ \\ | | |
                  ____) | (_| | |_| | | |  | | |  __/ | |_|
                 |_____/ \\__, |\\__,_|_|_|  |_|  \\___|_| (_)
                            | |                            
                            |_|      

  `.split('\n').forEach((i, idx) => setTimeout(() => console.log(i), 25 * idx));
}


function squirrel_3() {
  console.log(`
              ,;:;;,
              ;;;;;
      .=',    ;:;;:,
    /_', "=. ';:;:;
    @=:__,  \,;:;:'
      _(\.=  ;:;;'
      \`"_(  _/="\`
       \`"'\`\`

       baby squirrel
  `);
}

function squirrel_selector() {
  switch(Math.floor(Math.random() * 3)) {
    case 0:
      squirrel();
      break;
    case 1:
      squirrel_2();
      break;
    case 2:
      squirrel_3();
      break;
    default:
      squirrel();
  }
}

function set_profile(appkit, args, cb) {
  if(!args || !args.auth || !args.app) {
    appkit.terminal.question('Akkeris Auth Host (auth.example.com): ', (auth) => {
      appkit.terminal.question('Akkeris Apps Host (apps.example.com): ', (apps) => {
        appkit.terminal.question('Periodically check for updates? (y/n): ', (updates) => {
            auth = auth.toLowerCase().trim()
            apps = apps.toLowerCase().trim()
            if (auth.startsWith('https://') || auth.startsWith('http://')) {
              auth = (new url.URL(auth)).hostname
            }
            if (apps.startsWith('https://') || apps.startsWith('http://')) {
              apps = (new url.URL(apps)).hostname
            }
            if (updates.toLowerCase().trim() === 'yes' || updates.toLowerCase().trim() === 'y') {
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

function load_config() {
  let config = JSON.parse(fs.readFileSync(path.join(get_home(), '.akkeris', 'config.json')).toString('UTF8'))
  process.env.AKKERIS_AUTH_HOST = config.auth;
  process.env.AKKERIS_API_HOST = config.apps;
  process.env.AKKERIS_UPDATES = config.updates ? config.updates : 0;
}

function load_profile() {
  if(!process.env.AKKERIS_API_HOST || !process.env.AKKERIS_AUTH_HOST) {
    try {
      load_config()
    } catch (e) {
      if(process.argv && (process.argv[1] === 'auth:profile' || process.argv[2] === 'auth:profile' || process.argv[3] === 'auth:profile')) {
        return;
      }
      welcome()
      load_config()
    }
  }
  process.env.AKKERIS_AUTH_HOST = process.env.AKKERIS_AUTH_HOST.toLowerCase().trim()
  process.env.AKKERIS_API_HOST = process.env.AKKERIS_API_HOST.toLowerCase().trim()
  if (process.env.AKKERIS_AUTH_HOST.startsWith('https://') || process.env.AKKERIS_AUTH_HOST.startsWith('http://')) {
    process.env.AKKERIS_AUTH_HOST = (new url.URL(process.env.AKKERIS_AUTH_HOST)).host

  }
  if (process.env.AKKERIS_API_HOST.startsWith('https://') || process.env.AKKERIS_API_HOST.startsWith('http://')) {
    if(process.env.AKKERIS_API_HOST.startsWith('http://')) {
      process.env.AKKERIS_API_INSECURE = "true"
    }
    process.env.AKKERIS_API_HOST = (new url.URL(process.env.AKKERIS_API_HOST)).host

  }
}

function welcome() {
  console.log("")
  console.log("Hi! It looks like you might be new here. Lets take a second")
  console.log("to get started, you'll need your akkeris auth and apps host")
  console.log("in addition to your login and password.")
  console.log("")
  spawn.sync('ak',['auth:profile'], {env:process.env, stdio:'inherit'});
  spawn.sync('ak',['auth:login'], {env:process.env, stdio:'inherit'});
}
 
let zsh_shell = process.env.SHELL && process.env.SHELL.indexOf('zsh') !== -1;

function install_auto_completions(appkit) {
  
  let task = appkit.terminal.task('Installing autocomplete scripts, this will take affect with the next shell.');
  task.start();

  let script;

  // Override _stream.write and return a function that rolls back the override (https://stackoverflow.com/questions/9609393/catching-console-log-in-node-js)
  const hook_stream = (_stream, fn) => {
    const old_write = _stream.write;
    _stream.write = fn;
    return () => _stream.write = old_write;
  };

  // Capture the autocomplete script that yargs sends to stdout
  const unhook_stdout = hook_stream(process.stdout, (str) => script = `\n${str}`);
  appkit.args.showCompletionScript();
  unhook_stdout();
  
  // Write to zsh/bash profile
  fs.writeFileSync(path.join(get_home(), zsh_shell ? '.zshrc' : '.bash_profile'), script, {'flag':'a'}); 

  task.end('ok');
}

function check_for_updates() {
  const update_file_path = path.join(get_home(), '.akkeris', AKA_UPDATE_FILENAME).toString('utf8');
  
  // If update file DNE, this is our first time checking. Check immediately
  if (!fs.existsSync(update_file_path)) {
    spawn_update_check(update_file_path);
    return {};
  } 
  else {
    const file_stats = fs.statSync(update_file_path);

    // Only check for updates when it's been at least AKA_UPDATE_INTERVAL ms since last check
    const last_update = file_stats.mtimeMs;
    if ((Date.now() - last_update) > AKA_UPDATE_INTERVAL) {
      spawn_update_check(update_file_path);
    }

    // If the CLI is up to date, the file will be empty
    if (file_stats.size < 1) {
      return {};
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
  spawn('npm outdated akkeris --global --json', {
    shell: true, 
    detached: true, 
    stdio: [ 'ignore', output, 'ignore' ] 
  }).unref();
}

function addMetaCommands(yargs) {
  yargs
    .command('update', 'Update the Akkeris client', {}, module.exports.update.bind(null, module.exports))
    .command('version', 'Display current version', {}, module.exports.version.bind(null, module.exports))
    .command('auth:profile', 'Set the authorization and apps endpoints', {
        "apps":{ "description": "The URL for the Apps API end point" },
        "auth":{ "description": "The URL for the Auth API end point" }
      }, set_profile.bind(null, module.exports))
    .command('autocomplete', `Install bash/zsh shell autocompletion`, {}, install_auto_completions.bind(null, module.exports))
    // Secret Commands
    .command('squirrel', false, {}, squirrel_selector);
}

// Get random tips or update available statement (if applicable)
function get_epilogue() {
  const update_available = module.exports.update_available ? (Object.keys(module.exports.update_available).length !== 0) : false;
  if (update_available) {
    return module.exports.terminal.update_statement(module.exports.update_available.current, module.exports.update_available.latest);
  } else {
    return module.exports.random_tips[Math.floor(module.exports.random_tips.length * Math.random())]
  }
}

// Print UI and any error messages
function print_ui(cliui, errorMessage) {
  if (errorMessage) {
    cliui.span(`\n${errorMessage}`);
  } else {
    cliui.span(`\n${get_epilogue()}`);
  }
  console.log(cliui.toString());
}

// Print help for a specific command group
function print_group_help(appkit, argv, group) {
  // Initialize UI
  let errorMessage = ''
  const ui = require('cliui')({width: process.stdout.columns})
  ui.div(appkit.terminal.bold('\nAkkeris CLI Help\n'))

  // Reset yargs so we can initialize it with only the plugin that we want
  appkit.args.reset();
  
  if (group !== "plugins" && !init_plugins(module, module.exports.config.plugins_dir, group)) {
    if (!init_plugins(module, module.exports.config.third_party_plugins_dir, group)) {
      console.log(module.exports.terminal.markdown(`\n !!▸!! Bad bad error. You should never see this\n`));
      return;
    }
  } else if (group === "plugins") { 
    require('./lib/plugins.js').init(appkit.args, appkit); 
  }

  // A specific command was provided along with the group name
  if (argv.group.length > 1) {
    // Verify that the specific command is valid
    const givenCommand = argv.group[1];
    const foundCommand = appkit.args.getUsageInstance().getCommands().filter(a => a[0].split(" ").find(b => b === givenCommand))

    // Tell Yargs to run the specific command with the '--help' flag 
    if (foundCommand && foundCommand.length > 0) {
      appkit.args.help(true).parse(`${foundCommand[0][0]} --help`)
    } else {
      errorMessage = `${appkit.terminal.italic(appkit.terminal.markdown("!!Invalid command:!!"))} ${givenCommand}`
    }
  }

  // Render the name of the group
  ui.div(appkit.terminal.italic(capitalize(group)))
  
  // Render all of the group commands
  const commands = appkit.args.getUsageInstance().getCommands().sort((a, b) => a[0] < b[0] ? -1 : 1);
  const width = commands.reduce((acc, curr) => Math.max(stringWidth(`${path.basename(__filename)} ${curr[0]}`), acc), 0) + 6;
  commands.forEach((command) => {
    ui.span(
      { text: `• ${path.basename(__filename)} ${command[0]}`, padding: [0, 2, 0, 2], width },
      { text: command[1] }
    )
  });
  ui.div();

  // Render helper text
  ui.div(`\n${appkit.terminal.italic('Run')} ${appkit.terminal.italic(appkit.terminal.markdown(`~~${path.basename(__filename)} help <group> <command>~~`))} ${appkit.terminal.italic('to view help documentation for a specific command')}`);
  
  print_ui(ui, errorMessage);
}

// Print help for all command groups
function print_all_help(appkit, argv, errorMessage) {
  appkit.args.reset();

  // Initialize UI
  const ui = require('cliui')({width: process.stdout.columns});
  ui.div(appkit.terminal.bold('\nAkkeris CLI Help\n'));

  // Add "meta" commands (update, version, etc)
  addMetaCommands(appkit.args);

  // Add "plugins" command group (not technically a plugin)
  appkit.plugins.plugins = { help: 'Manage Akkeris CLI plugins' }

  // Print 'meta' commands (version, update, etc)
  const metaCommands = appkit.args.getUsageInstance().getCommands().sort((a, b) => a[0] < b[0] ? -1 : 1);
  const width = metaCommands.reduce((acc, curr) => Math.max(stringWidth(`${path.basename(__filename)} ${curr[0]}`), acc), 0) + 6;
  metaCommands.forEach((command) => {
    ui.div(
      { text: `• ${path.basename(__filename)} ${command[0]}`, width },
      { text: command[1] }
    )
  });

  ui.div('\nCommand Groups\n')
  // Render each command group
  Object.keys(appkit.plugins).sort().filter(group => !appkit.plugins[group].hidden).forEach((group) => {
    ui.div({ width, text: `• ${group}` }, { text: capitalize(appkit.plugins[group].help) });
  });
  
  // Render helper text
  ui.div(`\n${appkit.terminal.italic('Run')} ${appkit.terminal.italic(appkit.terminal.markdown(`~~${path.basename(__filename)} help <group>~~`))} ${appkit.terminal.italic('to view help documentation for a specific command group')}`);
  
  print_ui(ui, errorMessage);
}

function print_old_help(appkit) {
  // Have to initialize plugins again
  addMetaCommands(appkit.args);
  require('./lib/plugins.js').init(appkit.args, appkit); 
  init_plugins(module, module.exports.config.plugins_dir)
  init_plugins(module, module.exports.config.third_party_plugins_dir)

  appkit.args.epilog(get_epilogue())
  appkit.args.showHelp()
}

// Override yargs' default help and show something a bit cleaner
function help(appkit, argv) {
  let errorMessage;
  const invokedByHelp = argv._ && argv._.length > 0 && argv._[0] === 'help';
  const groupProvided = argv.group && argv.group.length > 0;
  const old_help = process.env.AKKERIS_HELP_OLD;

  if ((invokedByHelp && argv.a) || (
    old_help && (old_help === "1" || old_help.toLowerCase() === "true" || old_help.toLowerCase() === "t")
  )) {
    // Show old (full) help:
    print_old_help(appkit);
    return;
  }

  if (invokedByHelp && groupProvided) {
    // Handle meta commands (update, version,etc)
    addMetaCommands(appkit.args);
    const metaCommand = appkit.args.getUsageInstance().getCommands().findIndex(command => command[0] === argv.group[0]);
    if (metaCommand !== -1) {
      appkit.args.help(true).parse(`${appkit.args.getUsageInstance().getCommands()[metaCommand][0]} --help`)
      return;
    }

    // Add "plugins" command group (not technically a plugin)
    appkit.plugins.plugins = { help: 'Manage Akkeris CLI plugins' }

    const validGroup = Object.keys(appkit.plugins).filter(group => !appkit.plugins[group].hidden).find(group => group === argv.group[0])
    if (validGroup) {
      print_group_help(appkit, argv, validGroup);
      return;
    } else {
      errorMessage = `${appkit.terminal.italic(appkit.terminal.markdown("!!Invalid command group:!!"))} ${argv.group[0]}`;
    }
  } else if (!invokedByHelp && argv.group) {
    errorMessage = `${appkit.terminal.italic(appkit.terminal.markdown("!!Unrecognized command:!!"))} ${argv.group[0]}`;
  }

  print_all_help(appkit, argv, errorMessage);
}

// If the `help` command has the help flag, ignore it
// If any other command has the --help flag, show normal Yargs help for that command
function help_flag_middleware(appkit, argv, yargs) {
  if (argv._ && argv.help) {
    if (argv._.length === 0 || argv._.includes('help')) {
      help(appkit, argv)
      process.exit(0)
    } else {
      yargs.help(true).parse()
    }
  }
}

// Get rid of invalid options on the help command
function help_options_middleware(argv) {
  const validKeys = ['_', '$0', 'group', 'a', 'all'];
  if (argv._ && (argv._.length === 0 || argv._.includes('help'))) {
    Object.keys(argv).filter(key => !validKeys.includes(key)).forEach(badKey => { delete argv[badKey]; });
  }
}

// This checks to see if -a (--app) is in the requested config set,
// in a .akkeris
function find_app_middleware(appkit, argv, yargs) {
  if (argv._ && argv._[0] && (argv._[0] === 'apps:create' || argv._[0] === 'create')) return; // Handle in `create_app_prechecks`
  const force_select_app = () => { argv.a = argv.app = "~$force_select_app$~"; };

  const options = yargs.getOptions().string;
  const requiredOptions = yargs.getDemandedOptions();
  if ((options.includes("app") || options.includes("a")) && 'app' in requiredOptions) {
    // we don't want to do anything destructive implicitly.
    if(argv._ && argv._[0] && (argv._[0].includes('destroy') || argv._[0].includes('delete') || argv._[0].includes('remove') || argv._[0].includes('unset'))) {
      if (!argv.a && !argv.app) {
        force_select_app();
      }
      return
    }
    if(!argv.a && !argv.app && process.env.AKKERIS_APP) {
      argv.a = argv.app = process.env.AKKERIS_APP
      console.log(appkit.terminal.markdown(`###===### Using **⬢ ${argv.a}** from environment variable ##$AKKERIS_APP##`));
    } else if(!argv.a && !argv.app && !process.env.AKKERIS_APP) {
      let branch_name = spawn.sync('git',['rev-parse','--abbrev-ref','HEAD'], {env:process.env}).stdout.toString('utf8').trim();
      let apps = spawn.sync('git',['config','--get-regexp','branch.*.akkeris'], {env:process.env}).stdout.toString('utf8').trim();
      if(branch_name === '' || !branch_name) {
        force_select_app();
        return
      }
      apps = apps.split('\n').filter((x) => x !== '').map((x) => {
        let [branch_info, name] = x.split(' ')
        let branch = branch_info.split('.')[1]
        return {branch, name}
      }).filter((x) =>  x.branch === branch_name)
      if(apps.length === 1) {
        argv.a = argv.app = apps[0].name
        console.log(appkit.terminal.markdown(`###===### Using app **⬢ ${argv.a}** from ##git config --get branch.${apps[0].branch}.akkeris##`));
      } else {
        force_select_app();
      }
    }
  }
}

// Retrieve a list of apps and let the user select one 
async function select_app_middleware(appkit, argv) {
  if (argv._ && argv._[0] && (argv._[0] === 'apps:create' || argv._[0] === 'create')) return; // Handle in `create_app_middleware`

  if (argv.a === '~$force_select_app$~' || argv.app === '~$force_select_app$~') {
    const appNames = (await appkit.api.get('/apps')).map(i => i.name);
    if (appNames.length === 0) {
      appkit.terminal.error(appkit.terminal.markdown('###===### No apps were found. At least one app must exist in order to use this command.'));
    }

    console.log();
    console.log(appkit.terminal.markdown('!!Missing parameter:!! ^^app^^'));
    console.log(appkit.terminal.markdown('###(Press [CTRL+C] to cancel at any time)###'));
    console.log();

    // Prompt user to search for / select an app from the list
    const searchApps = async (input) => fuzzy.filter((input || ''), appNames).map(e => e.original);
    const answer = await inquirer.prompt({
      type: 'autocomplete',
      name: 'app',
      message: 'Select an app',
      suffix: ':',
      source: (answers, input) => searchApps(input),
    });
    
    // Overwrite app name with the selected app
    argv.a = argv.app = answer.app;
    
    console.log();
  }
}

// If options are missing during apps:create, provide the opportunity to select them
function create_app_prechecks(argv) {
  if (argv._ && argv._[0] && (argv._[0] === 'apps:create' || argv._[0] === 'create')) {
    if (!argv.s && !argv.space) {
      argv.s = argv.space = "~$select_space$~";
    }
    if (!argv.o && !argv.org) {
      argv.o = argv.org = "~$select_org$~";
    }
    if (!argv.NAME) {
      argv.NAME = "~$select_name$~";
    }
    if (!argv.d && !argv.description) {
      argv.d = argv.description = "~$select_description$~";
    }
  }
}

// Let the user enter missing apps:create options
async function create_app_middleware(appkit, argv) {
  const questions = [];
  const missing = [];

  if (argv.NAME === "~$select_name$~") {
    missing.push('name');
    questions.push({
      type: 'input',
      name: 'app',
      message: 'Enter a name for your app',
      suffix: ':',
      validate: (value) => {
        if (value.length === 0) {
          return 'This field is required.'
        } else if (!value.match(/^[0-9A-Za-z]+$/i)) {
          return 'Alphanumeric characters only';
        }
        return true;
      },
    });
  }

  if (argv.space === "~$select_space$~") {
    missing.push('space');
    const spaceNames = (await appkit.api.get('/spaces')).map(i => i.name).sort();
    if (spaceNames.length === 0) {
      appkit.terminal.error(appkit.terminal.markdown('###===### No spaces were found. At least one space must exist in order to create an app.'));
    }
    const searchSpaces = async (input) => fuzzy.filter((input || ''), spaceNames).map(e => e.original);
    questions.push({
      type: 'autocomplete',
      name: 'space',
      message: 'Select a space',
      suffix: ':',
      source: (answers, input) => searchSpaces(input),
    });
  }

  if (argv.org === "~$select_org$~") {
    missing.push('org');
    const orgNames = (await appkit.api.get('/organizations')).map(i => i.name).sort();
    if (orgNames.length === 0) {
      appkit.terminal.error(appkit.terminal.markdown('###===### No orgs were found. At least one org must exist in order to create an app.'));
    }
    const searchOrgs = async (input) => fuzzy.filter((input || ''), orgNames).map(e => e.original);
    questions.push({
      type: 'autocomplete',
      name: 'org',
      message: 'Select an org',
      suffix: ':',
      source: (answers, input) => searchOrgs(input),
    });
  }

  if (argv.description === "~$select_description$~") {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Enter a description for your app (optional)',
      suffix: ':',
    });
  }

  if (questions.length !== 0) {
    console.log();
    console.log(appkit.terminal.markdown(`!!Missing parameters:!! ^^${missing.join(', ')}^^`));
    console.log(appkit.terminal.markdown('###(Press [CTRL+C] to cancel at any time)###'));
    console.log();

    // Prompt user for input on missing options
    const answers = await inquirer.prompt(questions);

    console.log();

    // Replace argv with answers to questions
    if (answers.app) {
      argv.NAME = answers.app;
    }
    if (answers.space) {
      argv.space = argv.s = answers.space;
    }
    if (answers.org) {
      argv.org = argv.o = answers.org;
    }
    if (answers.description) {
      argv.description = argv.d = answers.description;
    } else if (argv.d === '~$select_description$~') {
      argv.description = undefined;
      argv.d = undefined;
    }
  }
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
  module.exports.args = require('yargs');
  
  module.exports.args
    .usage('Usage: akkeris COMMAND [--app APP] [command-specific-options]')
    .command(['$0 [group..]', 'help'], 'Akkeris Help', {
      all: {
        alias: 'a',
        boolean: true,
        demand: false,
        default: false,
      },
    }, help.bind(null, module.exports));
  
  addMetaCommands(module.exports.args);

  module.exports.args
    .recommendCommands()
    .middleware([help_options_middleware, help_flag_middleware.bind(null, module.exports)], true)
    .middleware([create_app_prechecks, find_app_middleware.bind(null, module.exports)], true)
    .middleware([create_app_middleware.bind(null, module.exports), select_app_middleware.bind(null, module.exports)])

  // map cli width for yargs
  module.exports.args.wrap(module.exports.args.terminalWidth())

  // load plugins
  module.exports.plugins = {};
  module.exports.config.plugins_dir = path.join(path.dirname(module.filename), 'plugins')
  module.exports.config.third_party_plugins_dir = path.join(get_home(), '.akkeris', 'plugins')
  require('./lib/plugins.js').init(module.exports.args, module.exports);

  assert.ok(module.filename, 'No module.filename exists, no clue where we are. This is a very odd error.');
  
  // Scan and initialize the plugins as needed.
  init_plugins(module, module.exports.config.plugins_dir)
  init_plugins(module, module.exports.config.third_party_plugins_dir)
  
  // Grab netrc info
  const netrc = require('netrc')();
  module.exports.account = netrc[module.exports.config.akkeris_api_host];

  // Make sure we have the best tips to recommend
  module.exports.random_tips = [
    module.exports.terminal.markdown('🚀  Fun tip! You can use ##latest## rather than a specific ID for builds and releases when getting info.'),
    module.exports.terminal.markdown('🚀  Hate using -a all the time? Run ##git config --add branch.BRANCH.akkeris APP## to default to APP when in BRANCH.'),
    module.exports.terminal.markdown('🚀  Hate specifying an app all the time? Set the ##$AKKERIS_APP## to the app you\'re working on to default to that app.'),
    module.exports.terminal.markdown('🚀  Did you know? When using repo:set if you don\'t specify a token it will use your organization\'s token.'),
    module.exports.terminal.markdown('🚀  Did you know? There\'s more out there! Run ##aka plugins## to explore optional akkeris features!'),
    module.exports.terminal.markdown('🚀  Did you know? You can use \'ak\' as a short cut for \'aka\'!'),
    module.exports.terminal.markdown('🚀  You should try \'aka squirrel\'!'),
  ];
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
  assert.ok(appkit.config.third_party_plugins_dir, 'Update was ran without init being ran first, everything is empty.');
  fs.readdirSync(appkit.config.third_party_plugins_dir).forEach((plugin => {
    try {
      if(fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, '.git')).isDirectory()) {
        console.log(appkit.terminal.markdown(`###===### updating ${plugin} plugin`));
        spawn.sync('git',['pull', '--quiet'], {cwd:path.join(appkit.config.third_party_plugins_dir, plugin), env:process.env, stdio:'inherit'});
        // If `update.js` file is available, run that before the `update` function
        if (fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, 'update.js')).isFile()) {
          try {
            try {
              require(path.join(appkit.config.third_party_plugins_dir, plugin, 'update.js'))(spawn);
            } catch (e) {
              // If install.js > module.exports is not a function, use old plugin install method
              if (e instanceof TypeError) {
                require(path.join(appkit.config.third_party_plugins_dir, plugin, 'update.js'));
              } else {
                throw e;
              }
            }
          } catch (err) {
            console.log(appkit.terminal.markdown(` !!▸!! error updating plugin "${plugin}": ${err}`));
          }
        }
        if (fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, 'index.js')).isFile()) {
          if (module.exports.plugins[plugin].update) {
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
  spawn.sync('npm',['update', '-g', 'akkeris'], {cwd:__dirname, env:process.env, stdio:'inherit'});
  
  // Clear 'update available' file
  let update_file = path.join(get_home(), '.akkeris', AKA_UPDATE_FILENAME).toString('utf8')
  if(fs.existsSync(update_file)) {
    fs.unlinkSync(update_file);
  }
}

function is_redirect(type, res) { return type.toLowerCase() === 'get' && res.headers['location'] && (res.statusCode === 301 || res.statusCode === 302); }
function is_response_ok(res) { return res.statusCode > 199 && res.statusCode < 300 ? true : false; }
function response_body(type, callback, res) {
  let body = Buffer.alloc(0);
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

function req_help(type, payload, rurl, headers, callback, resolve, reject) {
    let connector = rurl.startsWith('http://') ? http : https;
    let opts = url.parse(rurl);
    opts.method = type;
    opts.headers = headers || {};
    let req = connector.request(opts, response_body.bind(null, type, (e, d) => { 
      if(d) {
        d = JSON.parse(d)
      }
      if(callback) callback(e,d);
      if(e) {
        reject(e)
      } else {
        resolve(d)
      }
    }));
    if(payload) {
      req.write(payload);
    }
    req.on('abort', (err) => {
      if(callback) callback(new Error("Request aborted."))
        reject(new Error("Request aborted."))
    })
    req.on('error', (err) => {
      if(callback) callback(err); 
      reject(err)
    });
    req.end();
}

function request(type, payload, rurl, headers, callback) {
  if(callback) {
    req_help(type, payload, rurl, headers, callback, () => {}, () => {})
  } else {
    return new Promise((resolve, reject) => {
      req_help(type, payload, rurl, headers, null, resolve, reject)
    })
  }
}

function appkit_request(type, payload, rurl, callback) {
  let headers = {};
  headers['content-type'] = headers['content-type'] || 'application/json';
  if(module.exports.account && module.exports.account.password) {
    headers['authorization'] = 'Bearer ' + module.exports.account.password;
  }
  // Override for bearer token
  if(process.env.API_TOKEN) {
    headers['authorization'] = 'Bearer ' + process.env.API_TOKEN;
  }
  // Override if shared-secret is used
  if(process.env.API_AUTH) {
    headers['authorization'] = process.env.API_AUTH;
  }
  headers['accept'] = '*/*';
  headers['accept-encoding'] = 'gzip';
  headers['user-agent'] = 'akkeris-cli';

  let full_url = rurl.startsWith("http") ? rurl : 
                ( (module.exports.config.akkeris_api_host.startsWith("http") ? 
                    module.exports.config.akkeris_api_host : 
                    (process.env.AKKERIS_API_INSECURE ? 'http://' : 'https://') + module.exports.config.akkeris_api_host) + rurl);
  if (process.env.DEBUG) {
    console.log(` => [akkeris-debug-http] ${type} ${full_url} ${JSON.stringify(headers)} ${JSON.stringify(payload)} `)
  }
  return request(type, payload, full_url, headers, callback);
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

  module.exports.args
    .strict()
    .help(false)
    .argv
}
