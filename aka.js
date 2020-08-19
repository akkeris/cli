#!/usr/bin/env node

const assert = require('assert');
const proc = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const stringWidth = require('string-width');

// Only check to updates when our last update check was this long ago (ms)
// Default - 86400000 (24 hours)
const AKA_UPDATE_INTERVAL = process.env.AKA_UPDATE_INTERVAL ? process.env.AKA_UPDATE_INTERVAL : 86400000;

// Filename of saved update information
// Default - .aka_version
const AKA_UPDATE_FILENAME = '.aka_version';

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const isWindows = process.platform === 'win32';

process.on('uncaughtException', (e) => {
  if (process.env.DEBUG) {
    console.error(e.message);
    console.error(e.stack);
  } else {
    console.log('An unexpected error occured, if this persists try running `mv ~/.akkeris ~/.akkeris.backup`.');
    console.log('  -> Pro tip: Add DEBUG=true to your environment for more information.');
  }
});

function init_plugins(m, plugins_dir, pluginName, thirdParty) {
  let success;
  fs.readdirSync(plugins_dir).sort((a, b) => (a < b ? -1 : 1)).forEach(((plugin) => {
    if (path.basename(plugin).startsWith('.') || path.basename(plugin).startsWith('tmp')) {
      return;
    }
    if (pluginName && plugin !== pluginName) {
      return;
    }
    try {
      if (fs.statSync(path.join(plugins_dir, plugin, 'index.js')).isFile()) {
        try {
          m.exports.plugins[plugin] = require(path.join(plugins_dir, plugin, 'index.js'));
          m.exports.plugins[plugin].thirdPartyPlugin = thirdParty;
        } catch (err) {
          console.log(m.exports.terminal.markdown(`\n !!▸!! error loading plugin "${plugin}": ${err}\n`));
        }
        if (m.exports.plugins[plugin] && m.exports.plugins[plugin].init) {
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
  try {
    fs.statSync(directory);
  } catch (e) {
    try {
      fs.mkdirSync(directory);
      fs.statSync(directory);
    } catch (err) {
      console.error(`The plugins directory cannot be accessed, could not be created, or is a file (${directory}).`);
    }
  }
}

/* eslint-disable no-useless-escape */
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

  `);
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

function squirrel_wars() {
  `
                     sddhyo:oyshhmhs:
                 ++syoyddddhsyhmmddyyo
               ohhyyyhhddmddmmmmdhhhhhss
              :+osyyhddmmmmddmmmddddhhmds
             :+oosyydmmhyo+++shshyhddshdd
              osyyhdddy+: /osysosoymdyshh:           o   .++.                         o
             sdhhyhdmdso+sddmhyysssyyooy         ..+/+//:shh/                      +y+
            osssoohdNmddyhhyssossooo+++:.       /syo+:/+hhdho                    +yo
            ::/ooshdmdhyyso//+::/+//++//+++ossyddhoo+/ssyyhhhy+:              /oyo
             :ossyhhyss+o/      /+syhhhdddhddddmdhhhhhyhh+:/ssyy+.          :oyo:
              soyyyhyo       .:+sshhhhhhhhhyhdddddddhyyyyyoooyssy/        :+yo: 
              ++yyyhyo     .:+syhhdddyhyyyysssyhhhyyyyyhyhhdyssoso      :+yo:
               oysyyh+    :+osyyyhhhhhsyssoossssssssosssyyss+osssyo    +yo
               +sosos+:  :+osyyhhhhhhhyyoo+++oosssshdhysssoossoo://  +yo
                oysoos: /+oyyyysysoosyyso/:/++osyysshhhyyyyss+/: :/so
                 hsys:sys:+ossooso+++/:/oo/::///osooosssssyyyhhsoos
                  o/yoosy:/+ooo+sshmddhyss/: ::/:://+oooooooosooyy
                   oo/yosy:/+++ooymNNNNmmhhs+: :::/+osssssoo
                     yooysy//+oooodmNNNddmdhhhsosyyyyys
                        yoysy////+ydmNNNdddmdhhhdds
                          yooownejoydNNNmddddddmNh
                           sossosssshNNmmdmmmmNNMs
                             sosddmmsmNmhddmmNNNd
                               sososommdhhhhdNmd
     _______   ______      __    __   __   ______       ______       _______  __ 
    /       | /  __  \\    |  |  |  | |  | |   _  \\     |   _  \\     |   ____||  |
   |   (---- |  |  |  |   |  |  |  | |  | |  |_)  |    |  |_)  |    |  |__   |  |
    \\   \\    |  |  |  |   |  |  |  | |  | |      /     |      /     |   __|  |  |
.----)   |   |   --'  '--.|   --'  | |  | |  |\\  \\----.|  |\\  \\----.|  |____ |   ----.
|_______/     \\_____\\_____\\\\______/  |__| | _|  ._____|| _|  ._____||_______||_______|

                  ____    __    ____  ___       ______          _______ 
                  \\   \\  /  \\  /   / /   \\     |   _  \\        /       |
                   \\   \\/    \\/   / /  ^  \\    |  |_)  |      |   (----
                    \\            / /  /_\\  \\   |      /        \\   \\
                     \\    /\\    / /  _____  \\  |  |\\  \\----.----)   |
                      \\__/  \\__/ /__/     \\__\\ | _|  ._____|_______/

`.split('\n').forEach((i, idx) => setTimeout(() => console.log(i), 25 * idx));
}
/* eslint-enable no-useless-escape */

function squirrel_selector() {
  switch (Math.floor(Math.random() * 4)) {
    case 0:
      squirrel();
      break;
    case 1:
      squirrel_2();
      break;
    case 2:
      squirrel_3();
      break;
    case 3:
      squirrel_wars();
      break;
    default:
      squirrel();
  }
}

function set_profile(appkit, args) {
  if (!args || !args.auth || !args.app) {
    appkit.terminal.question('Akkeris Auth Host (auth.example.com): ', (auth) => {
      appkit.terminal.question('Akkeris Apps Host (apps.example.com): ', (apps) => {
        appkit.terminal.question('Periodically check for updates? (y/n): ', (updates) => {
          auth = auth.toLowerCase().trim();
          apps = apps.toLowerCase().trim();
          if (auth.startsWith('https://') || auth.startsWith('http://')) {
            auth = (new url.URL(auth)).hostname;
          }
          if (apps.startsWith('https://') || apps.startsWith('http://')) {
            apps = (new url.URL(apps)).hostname;
          }
          if (updates.toLowerCase().trim() === 'yes' || updates.toLowerCase().trim() === 'y') {
            updates = '1';
          } else {
            updates = '0';
          }
          const configPath = path.join(get_home(), '.akkeris', 'config.json');
          fs.writeFileSync(configPath, JSON.stringify({ auth, apps, updates }, null, 2));
          process.env.AKKERIS_API_HOST = apps;
          process.env.AKKERIS_AUTH_HOST = auth;
          process.env.AKKERIS_UPDATES = updates;
          console.log('Profile updated!');
        });
      });
    });
  }
}

function load_config() {
  const config = JSON.parse(fs.readFileSync(path.join(get_home(), '.akkeris', 'config.json')).toString('UTF8'));
  process.env.AKKERIS_AUTH_HOST = config.auth;
  process.env.AKKERIS_API_HOST = config.apps;
  process.env.AKKERIS_UPDATES = config.updates ? config.updates : 0;
}

function welcome() {
  console.log('');
  console.log('Hi! It looks like you might be new here. Lets take a second');
  console.log("to get started, you'll need your akkeris auth and apps host");
  console.log('in addition to your login and password.');
  console.log('');
  proc.spawnSync('ak', ['auth:profile'], { env: process.env, stdio: 'inherit', shell: isWindows || undefined });
  proc.spawnSync('ak', ['auth:login'], { env: process.env, stdio: 'inherit', shell: isWindows || undefined });
}

function load_profile() {
  if (!process.env.AKKERIS_API_HOST || !process.env.AKKERIS_AUTH_HOST) {
    try {
      load_config();
    } catch (e) {
      if (process.argv
        && (process.argv[1] === 'auth:profile' || process.argv[2] === 'auth:profile' || process.argv[3] === 'auth:profile')
      ) {
        return;
      }
      welcome();
      load_config();
    }
  }
  process.env.AKKERIS_AUTH_HOST = process.env.AKKERIS_AUTH_HOST.toLowerCase().trim();
  process.env.AKKERIS_API_HOST = process.env.AKKERIS_API_HOST.toLowerCase().trim();
  if (process.env.AKKERIS_AUTH_HOST.startsWith('https://') || process.env.AKKERIS_AUTH_HOST.startsWith('http://')) {
    process.env.AKKERIS_AUTH_HOST = (new url.URL(process.env.AKKERIS_AUTH_HOST)).host;
  }
  if (process.env.AKKERIS_API_HOST.startsWith('https://') || process.env.AKKERIS_API_HOST.startsWith('http://')) {
    if (process.env.AKKERIS_API_HOST.startsWith('http://')) {
      process.env.AKKERIS_API_INSECURE = 'true';
    }
    process.env.AKKERIS_API_HOST = (new url.URL(process.env.AKKERIS_API_HOST)).host;
  }
}

const zsh_shell = process.env.SHELL && process.env.SHELL.indexOf('zsh') !== -1;

function install_auto_completions(appkit) {
  const task = appkit.terminal.task('Installing autocomplete scripts, this will take affect with the next shell.');
  task.start();

  let script;

  // Override _stream.write and return a function that rolls back the override (https://stackoverflow.com/questions/9609393/catching-console-log-in-node-js)
  const hook_stream = (_stream, fn) => {
    const old_write = _stream.write;
    _stream.write = fn;
    return () => { _stream.write = old_write; };
  };

  // Capture the autocomplete script that yargs sends to stdout
  const unhook_stdout = hook_stream(process.stdout, (str) => { script = `\n${str}`; });
  appkit.args.showCompletionScript();
  unhook_stdout();

  // Write to zsh/bash profile
  fs.writeFileSync(path.join(get_home(), zsh_shell ? '.zshrc' : '.bash_profile'), script, { flag: 'a' });

  task.end('ok');
}

// Run 'npm outdated akkeris --global --json' in the background
// Writes output to @param update_file_path
function spawn_update_check(update_file_path) {
  const output = fs.openSync(update_file_path, 'w');
  proc.spawn('npm outdated akkeris --global --json', {
    shell: true,
    detached: true,
    stdio: ['ignore', output, 'ignore'],
  }).unref();
}

function check_for_updates() {
  const update_file_path = path.join(get_home(), '.akkeris', AKA_UPDATE_FILENAME).toString('utf8');

  // If update file DNE, this is our first time checking. Check immediately
  if (!fs.existsSync(update_file_path)) {
    spawn_update_check(update_file_path);
    return {};
  }

  const file_stats = fs.statSync(update_file_path);

  // Only check for updates when it's been at least AKA_UPDATE_INTERVAL ms since last check
  const last_update = file_stats.mtimeMs;
  if ((Date.now() - last_update) > AKA_UPDATE_INTERVAL) {
    spawn_update_check(update_file_path);
    return {};
  }

  // If the CLI is up to date, the file will be empty
  if (file_stats.size < 1) {
    return {};
  }

  try {
    // Read current version and latest version from file
    const update_file = JSON.parse(fs.readFileSync(update_file_path));
    if (update_file.akkeris && update_file.akkeris.latest > update_file.akkeris.current) {
      return { current: update_file.akkeris.current, latest: update_file.akkeris.latest };
    }
    return {};
  } catch (err) {
    // JSON parse error - invalid file. Delete and rebuild on next run
    if (process.env.DEBUG) { console.log(err); }
    fs.unlinkSync(update_file_path);
    return {};
  }
}

function addMetaCommands(yargs) {
  yargs
    .command('update', 'Update the Akkeris client', {}, module.exports.update.bind(null, module.exports))
    .command('version', 'Display current version', {}, module.exports.version.bind(null, module.exports))
    .command('auth:profile', 'Set the authorization and apps endpoints', {
      apps: { description: 'The URL for the Apps API end point' },
      auth: { description: 'The URL for the Auth API end point' },
    }, set_profile.bind(null, module.exports))
    .command(
      'autocomplete',
      'Install bash/zsh shell autocompletion',
      {},
      install_auto_completions.bind(null, module.exports),
    )
    // Secret Commands
    .command('squirrel', false, {}, squirrel_selector);
}

// Get random tips or update available statement (if applicable)
function get_epilogue() {
  const update_available = module.exports.update_available
    ? (Object.keys(module.exports.update_available).length !== 0) : false;
  if (update_available) {
    return module.exports.terminal.update_statement(
      module.exports.update_available.current, module.exports.update_available.latest,
    );
  }
  return module.exports.random_tips[Math.floor(module.exports.random_tips.length * Math.random())];
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

// Yargs caches help messages now apparently
// Need this to clear cached help message when we call yargs.parse
function clearCachedHelp(appkit) {
  if (typeof appkit.args.getUsageInstance().clearCachedHelpMessage === 'function') {
    appkit.args.getUsageInstance().clearCachedHelpMessage();
  }
}

// Reset yargs and initialize it with only one desired plugin
function initPluginGroup(appkit, group) {
  appkit.args.reset();

  if (group !== 'plugins' && !init_plugins(module, module.exports.config.plugins_dir, group)) {
    if (!init_plugins(module, module.exports.config.third_party_plugins_dir, group)) {
      throw new Error('Could not initialize plugin');
    }
  } else if (group === 'plugins') {
    require('./lib/plugins.js').init(appkit.args, appkit);
  }
}

// Print help for a specific command group
function print_group_help(appkit, argv, group) {
  // Initialize UI
  let errorMessage = '';
  const ui = require('cliui')({ width: process.stdout.columns });
  ui.div(appkit.terminal.bold('\nAkkeris CLI Help\n'));

  try {
    initPluginGroup(appkit, group);
  } catch (err) {
    console.log(module.exports.terminal.markdown('\n !!▸!! Bad bad error. You should never see this\n'));
    return;
  }

  // A specific command was provided along with the group name
  if (argv.group.length > 1) {
    const { getCommands } = appkit.args.getUsageInstance();

    // Verify that the specific command is valid
    const givenCommand = argv.group[1];
    let foundCommand = getCommands().filter((a) => a[0].split(' ').find((b) => b === givenCommand));

    if (!foundCommand || foundCommand.length < 1) {
      const fullCommand = `${argv.group[0]}:${givenCommand}`;
      foundCommand = getCommands().filter((a) => a[0].split(' ').find((b) => b === fullCommand));
    }

    // Tell Yargs to run the specific command with the '--help' flag
    if (foundCommand && foundCommand.length > 0) {
      appkit.args.help(true).parse(`${foundCommand[0][0]} --help`);
    } else {
      errorMessage = `${appkit.terminal.italic(appkit.terminal.markdown('!!Invalid command:!!'))} ${givenCommand}`;
    }
  }

  // Render the name of the group
  ui.div(appkit.terminal.italic(capitalize(group)));

  // Render all of the group commands
  const commands = appkit.args.getUsageInstance().getCommands().sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const width = commands.reduce((acc, curr) => Math.max(stringWidth(`${path.basename(process.argv[1])} ${curr[0]}`), acc), 0) + 6;
  commands.forEach((command) => {
    ui.span(
      { text: `• ${path.basename(process.argv[1])} ${command[0]}`, padding: [0, 2, 0, 2], width },
      { text: command[1] },
    );
  });
  ui.div();

  // Render helper text
  let helpText = `\n${appkit.terminal.italic('Run')} `;
  helpText += appkit.terminal.italic(appkit.terminal.markdown(`~~${path.basename(process.argv[1])} <command> --help~~`));
  helpText += ` ${appkit.terminal.italic('to view help documentation for a specific command')}`;
  ui.div(helpText);

  print_ui(ui, errorMessage);
}

// Print help for all command groups
function print_all_help(appkit, argv, errorMessage) {
  appkit.args.reset();

  // Initialize UI
  const ui = require('cliui')({ width: process.stdout.columns });
  ui.div(appkit.terminal.bold('\nAkkeris CLI Help\n'));

  // Add "meta" commands (update, version, etc)
  addMetaCommands(appkit.args);

  // Add "plugins" command group (not technically a plugin)
  appkit.plugins.plugins = { help: 'Manage Akkeris CLI plugins' };

  // Print 'meta' commands (version, update, etc)
  const metaCommands = appkit.args.getUsageInstance().getCommands().sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const width = metaCommands
    .reduce((acc, curr) => Math.max(stringWidth(`${path.basename(process.argv[1])} ${curr[0]}`), acc), 0) + 6;
  metaCommands.forEach((command) => {
    ui.div(
      { text: `• ${path.basename(process.argv[1])} ${command[0]}`, width },
      { text: command[1] },
    );
  });

  ui.div('\nCommand Groups\n');
  // Render each command group
  Object.keys(appkit.plugins).sort().filter((group) => !appkit.plugins[group].hidden).forEach((group) => {
    ui.div({ width, text: `• ${group}` }, { text: capitalize(appkit.plugins[group].help) });
  });

  // Render helper text
  let helpText = `\n${appkit.terminal.italic('Run')} `;
  helpText += appkit.terminal.italic(appkit.terminal.markdown(`~~${path.basename(process.argv[1])} help <group>~~`));
  helpText += ` ${appkit.terminal.italic('to view help documentation for a specific command group')}`;
  ui.div(helpText);

  print_ui(ui, errorMessage);
}

function print_old_help(appkit) {
  // Have to initialize plugins again
  addMetaCommands(appkit.args);
  require('./lib/plugins.js').init(appkit.args, appkit);
  init_plugins(module, module.exports.config.plugins_dir);
  init_plugins(module, module.exports.config.third_party_plugins_dir);
  appkit.args.epilog(get_epilogue());
  appkit.args.showHelp();
}

// Override yargs' default help and show something a bit cleaner
function help(appkit, argv) {
  clearCachedHelp(appkit);
  let errorMessage;
  const invokedByHelp = argv._ && argv._.length > 0 && argv._[0] === 'help';
  const groupProvided = argv.group && argv.group.length > 0;

  // Ways to show old (default yargs) help:
  //    --a flag
  //    AKKERIS_HELP_OLD env var
  let old_help = process.env.AKKERIS_HELP_OLD;
  old_help = old_help && (old_help === '1' || old_help.toLowerCase() === 'true' || old_help.toLowerCase() === 't');
  if ((invokedByHelp && argv.a) || old_help) {
    print_old_help(appkit);
    return;
  }

  // We got here through an unrecognized command
  if (!invokedByHelp && argv.group) {
    // Display all command groups + "unrecognized command" error
    errorMessage = `${appkit.terminal.italic(appkit.terminal.markdown('!!Unrecognized command:!!'))} ${argv.group[0]}`;
  }

  // We got here by the command `aka help [group | command]`
  if (invokedByHelp && groupProvided) {
    const { getCommands } = appkit.args.getUsageInstance();

    // Handle meta commands (update, version,etc)
    addMetaCommands(appkit.args);
    const metaCommand = getCommands().findIndex((command) => command[0] === argv.group[0]);
    if (metaCommand !== -1) {
      appkit.args.help(true).parse(`${getCommands()[metaCommand][0]} --help`);
      return;
    }

    // Add "plugins" command group (not technically a plugin)
    appkit.plugins.plugins = { help: 'Manage Akkeris CLI plugins' };

    // Display group help if the provided group is valid
    const validGroup = Object.keys(appkit.plugins)
      .filter((group) => !appkit.plugins[group].hidden).find((group) => group === argv.group[0]);
    if (validGroup) {
      print_group_help(appkit, argv, validGroup);
      return;
    }

    // Provided group was not valid.
    // Did they supply a command instead? Try to find the command they are looking for

    // Initialize all plugins
    init_plugins(module, module.exports.config.plugins_dir);
    init_plugins(module, module.exports.config.third_party_plugins_dir, undefined, true);

    // Get a list of all valid commands
    const foundCommand = getCommands()
      .filter((a) => a[0].split(' ').find((b) => b === argv.group[0]));

    // Found the command they were looking for. Call it with the '--help' flag
    if (foundCommand.length > 0) {
      appkit.args.help(true).parse(`${foundCommand[0][0]} --help`);
      return;
    }

    // Display all command groups + "unrecognized command or group" error
    errorMessage = `${appkit.terminal.italic(appkit.terminal.markdown('!!Invalid command or group:!!'))} ${argv.group[0]}`;
  }

  print_all_help(appkit, argv, errorMessage);
}

// Initialize, setup any items at runtime
module.exports.init = function init() {
  // Set common dir paths
  const akkeris_home = path.join(get_home(), '.akkeris');
  const akkeris_plugins = path.join(get_home(), '.akkeris', 'plugins');
  const akkeris_base_plugins = path.join(path.dirname(module.filename), 'plugins');

  // Create necessary directories
  create_dir(akkeris_home);
  create_dir(akkeris_plugins);
  create_dir(akkeris_base_plugins);

  module.exports.terminal = require(path.join(__dirname, 'lib', 'terminal.js'));
  module.exports.middleware = require(path.join(__dirname, 'lib', 'middleware.js'));
  module.exports.akaHelp = help;

  load_profile();

  module.exports.config = {
    plugins_dir: null,
    akkeris_api_host: (process.env.AKKERIS_API_HOST),
    akkeris_auth_host: (process.env.AKKERIS_AUTH_HOST),
    package: JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json').toString('utf8'))),
  };

  if (process.env.AKKERIS_UPDATES && process.env.AKKERIS_UPDATES === '1') {
    module.exports.update_available = check_for_updates();
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
        hidden: true,
      },
    }, help.bind(null, module.exports));

  addMetaCommands(module.exports.args);

  module.exports.args
    .recommendCommands()
    .middleware([
      module.exports.middleware.help_options_middleware,
      module.exports.middleware.help_flag_middleware.bind(null, module.exports),
    ], true)
    .middleware([
      module.exports.middleware.create_app_prechecks,
      module.exports.middleware.find_app_middleware.bind(null, module.exports),
    ], true)
    .middleware([
      module.exports.middleware.create_app_middleware.bind(null, module.exports),
      module.exports.middleware.select_app_middleware.bind(null, module.exports),
    ]);

  // map cli width for yargs
  module.exports.args.wrap(module.exports.args.terminalWidth());

  // load plugins
  module.exports.plugins = {};
  module.exports.config.plugins_dir = path.join(path.dirname(module.filename), 'plugins');
  module.exports.config.third_party_plugins_dir = path.join(get_home(), '.akkeris', 'plugins');
  require('./lib/plugins.js').init(module.exports.args, module.exports);

  assert.ok(module.filename, 'No module.filename exists, no clue where we are. This is a very odd error.');

  // Scan and initialize the plugins as needed.
  init_plugins(module, module.exports.config.plugins_dir);
  init_plugins(module, module.exports.config.third_party_plugins_dir, undefined, true);

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
};

module.exports.version = function version(appkit) {
  console.log(`akkeris/${appkit.config.package.version} ${process.arch}-${process.platform} node-${process.version}`);
  console.log(appkit.terminal.markdown('###===### Installed Plugins'));
  Object.keys(module.exports.plugins).forEach((plugin) => {
    if (!module.exports.plugins[plugin].thirdPartyPlugin) return;
    console.log(`${module.exports.plugins[plugin].group} ${module.exports.plugins[plugin].version ? `@${module.exports.plugins[plugin].group}` : ''}`);
  });
};

// Update our dependencies and our plugins as needed.
module.exports.update = function update(appkit) {
  assert.ok(appkit.config.third_party_plugins_dir, 'Update was ran without init being ran first, everything is empty.');
  fs.readdirSync(appkit.config.third_party_plugins_dir).forEach(((plugin) => {
    try {
      if (fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, '.git')).isDirectory()) {
        console.log(appkit.terminal.markdown(`###===### updating ${plugin} plugin`));
        proc.spawnSync('git', ['pull', '--quiet'], {
          cwd: path.join(appkit.config.third_party_plugins_dir, plugin),
          env: process.env,
          stdio: 'inherit',
          shell: isWindows || undefined,
        });
        // If `update.js` file is available, run that before the `update` function
        if (fs.statSync(path.join(appkit.config.third_party_plugins_dir, plugin, 'update.js')).isFile()) {
          try {
            require(path.join(appkit.config.third_party_plugins_dir, plugin, 'update.js'));
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
      if (process.env.NODE_DEBUG) {
        console.info(e);
      }
    }
  }));
  console.log(appkit.terminal.markdown('###===### updating akkeris'));
  proc.spawnSync('npm', ['install', '-g', 'akkeris@latest'], {
    cwd: __dirname, env: process.env, stdio: 'inherit', shell: isWindows || undefined,
  });

  // Clear 'update available' file
  const update_file = path.join(get_home(), '.akkeris', AKA_UPDATE_FILENAME).toString('utf8');
  if (fs.existsSync(update_file)) {
    fs.unlinkSync(update_file);
  }
};

function req_help(type, payload, rurl, headers, callback, resolve, reject) {
  const connector = rurl.startsWith('http://') ? http : https;
  const opts = url.parse(rurl);
  opts.method = type;
  opts.headers = headers || {};
  const req = connector.request(opts, response_body.bind(null, type, (e, d) => { // eslint-disable-line
    if (d) {
      d = JSON.parse(d);
    }
    if (callback) callback(e, d);
    if (e) {
      reject(e);
    } else {
      resolve(d);
    }
  }));
  if (payload) {
    req.write(payload);
  }
  req.on('abort', () => {
    if (callback) callback(new Error('Request aborted.'));
    reject(new Error('Request aborted.'));
  });
  req.on('error', (err) => {
    if (callback) callback(err);
    reject(err);
  });
  req.end();
}

function request(type, payload, rurl, headers, callback) { // eslint-disable-line
  if (callback) {
    req_help(type, payload, rurl, headers, callback, () => {}, () => {});
  } else {
    return new Promise((resolve, reject) => {
      req_help(type, payload, rurl, headers, null, resolve, reject);
    });
  }
}

function is_redirect(type, res) {
  return type.toLowerCase() === 'get' && res.headers.location && (res.statusCode === 301 || res.statusCode === 302);
}
function is_response_ok(res) { return !!(res.statusCode > 199 && res.statusCode < 300); }
function response_body(type, callback, res) {
  let body = Buffer.alloc(0);
  res.on('data', (e) => { body = Buffer.concat([body, e]); });
  res.on('end', () => {
    if (res.headers['content-encoding'] === 'gzip' && body.length > 0) {
      body = zlib.gunzipSync(body);
    }
    if (is_redirect(type, res)) {
      request('get', null, res.headers.location, res.headers, callback);
    } else if (is_response_ok(res)) {
      callback(null, res.headers['content-type'] === 'application/zip' ? body : body.toString('utf8'), res.headers);
    } else {
      callback({ code: res.statusCode, body, headers: res.headers }, null);
    }
  });
}

function appkit_request(type, payload, rurl, callback) {
  const headers = {};
  headers['content-type'] = headers['content-type'] || 'application/json';
  if (module.exports.account && module.exports.account.password) {
    headers.authorization = `Bearer ${module.exports.account.password}`;
  }
  // Override for bearer token
  if (process.env.API_TOKEN) {
    headers.authorization = `Bearer ${process.env.API_TOKEN}`;
  }
  // Override if shared-secret is used
  if (process.env.API_AUTH) {
    headers.authorization = process.env.API_AUTH;
  }
  headers.accept = '*/*';
  headers['accept-encoding'] = 'gzip';
  headers['user-agent'] = 'akkeris-cli';
  const full_url = rurl.startsWith('http') ? rurl
    : ((module.exports.config.akkeris_api_host.startsWith('http')
      ? module.exports.config.akkeris_api_host
      : (process.env.AKKERIS_API_INSECURE ? 'http://' : 'https://') + module.exports.config.akkeris_api_host) + rurl);
  if (process.env.DEBUG) {
    console.log(` => [akkeris-debug-http] ${type} ${full_url} ${JSON.stringify(headers)} ${JSON.stringify(payload)} `);
  }
  return request(type, payload, full_url, headers, callback);
}

module.exports.http = {
  get: request.bind(null, 'get', null),
  post: request.bind(null, 'post'),
  patch: request.bind(null, 'patch'),
  delete: request.bind(null, 'delete', null),
  put: request.bind(null, 'put'),
};

module.exports.api = {
  get: appkit_request.bind(null, 'get', null),
  post: appkit_request.bind(null, 'post'),
  patch: appkit_request.bind(null, 'patch'),
  delete: appkit_request.bind(null, 'delete', null),
  put: appkit_request.bind(null, 'put'),
};

if (require.main === module) {
  module.exports.init();

  module.exports.args // eslint-disable-line
    .strict()
    .version(false)
    .help(false)
    .argv;
}
