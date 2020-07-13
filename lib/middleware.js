const fuzzy = require('fuzzy');
const proc = require('child_process');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

const isWindows = process.platform === 'win32';

// If the `help` command has the help flag, ignore it
// If any other command has the --help flag, show normal Yargs help for that command
function help_flag_middleware(appkit, argv, yargs) {
  if (argv._ && argv.help) {
    if (argv._.length === 0 || argv._.includes('help')) {
      appkit.akaHelp(appkit, argv);
      process.exit(0);
    } else {
      yargs.help(true).parse();
    }
  }
}

// Get rid of invalid options on the help command
function help_options_middleware(argv) {
  let validKeys = ['_', '$0', 'group'];
  if (!argv.group) {
    validKeys = [...validKeys, 'a', 'all'];
  }
  if (argv._ && (argv._.length === 0 || argv._.includes('help'))) {
    Object.keys(argv).filter((key) => !validKeys.includes(key)).forEach((badKey) => { delete argv[badKey]; });
  }
}

// This checks to see if -a (--app) is in the requested config set,
// in a .akkeris
function find_app_middleware(appkit, argv, yargs) {
  if (argv._ && argv._[0] && (argv._[0] === 'apps:create' || argv._[0] === 'create')) {
    return; // Handle in `create_app_prechecks`
  }

  const force_select_app = () => { argv.a = argv.app = '~$force_select_app$~'; };

  const options = yargs.getOptions().string;
  const requiredOptions = yargs.getDemandedOptions();
  if ((options.includes('app') || options.includes('a')) && 'app' in requiredOptions) {
    // we don't want to do anything destructive implicitly.
    if (argv._ && argv._[0] && (
      argv._[0].includes('destroy')
      || argv._[0].includes('delete')
      || argv._[0].includes('remove')
      || argv._[0].includes('unset')
    )) {
      if (!argv.a && !argv.app) {
        force_select_app();
      }
      return;
    }
    if (!argv.a && !argv.app && process.env.AKKERIS_APP) {
      argv.a = argv.app = process.env.AKKERIS_APP;
      console.log(appkit.terminal.markdown(`###===### Using **⬢ ${argv.a}** from environment variable ##$AKKERIS_APP##`));
    } else if (!argv.a && !argv.app && !process.env.AKKERIS_APP) {
      const spawnOpts = { env: process.env, shell: isWindows || undefined };
      const branch_name = proc.spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], spawnOpts)
        .stdout.toString('utf8').trim();
      let apps = proc.spawnSync('git', ['config', '--get-regexp', 'branch.*.akkeris'], spawnOpts)
        .stdout.toString('utf8').trim();
      if (branch_name === '' || !branch_name) {
        force_select_app();
        return;
      }
      apps = apps.split('\n').filter((x) => x !== '').map((x) => {
        const [branch_info, name] = x.split(' ');
        const branch = branch_info.split('.')[1];
        return { branch, name };
      }).filter((x) => x.branch === branch_name);
      if (apps.length === 1) {
        argv.a = argv.app = apps[0].name;
        console.log(appkit.terminal.markdown(`###===### Using app **⬢ ${argv.a}** from ##git config --get branch.${apps[0].branch}.akkeris##`));
      } else {
        force_select_app();
      }
    }
  }
}

// Retrieve a list of apps and let the user select one
async function select_app_middleware(appkit, argv) {
  if (argv._ && argv._[0] && (argv._[0] === 'apps:create' || argv._[0] === 'create')) {
    return; // Handle in `create_app_middleware`
  }

  if (argv.a === '~$force_select_app$~' || argv.app === '~$force_select_app$~') {
    let appNames;
    try {
      appNames = (await appkit.api.get('/apps')).map((i) => i.name);
    } catch (err) {
      // Catch login errors here
      if (err.code === 401) {
        appkit.terminal.error(err);
        process.exit(1);
      }
      appkit.terminal.error(err.body);
      return;
    }

    if (appNames.length === 0) {
      appkit.terminal.error(appkit.terminal.markdown('###===### No apps were found. At least one app must exist in order to use this command.'));
      process.exit(1);
    }

    console.log();
    console.log(appkit.terminal.markdown('!!Missing parameter:!! ^^app^^'));
    console.log(appkit.terminal.markdown('###(Press [CTRL+C] to cancel at any time)###'));
    console.log();

    // Prompt user to search for / select an app from the list
    const searchApps = async (input) => fuzzy.filter((input || ''), appNames).map((e) => e.original);
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
    // Support situations where a user may not specify a space but include it in the name of the app.
    if ((typeof (argv.space) === 'undefined' || argv.space === null) && argv.NAME && argv.NAME.includes('-')) {
      const parts = argv.NAME.split('-');
      [argv.NAME] = parts;
      argv.space = parts.slice(1).join('-');
    }
    if (!argv.s && !argv.space) {
      argv.s = argv.space = '~$select_space$~';
    }
    if (!argv.o && !argv.org) {
      argv.o = argv.org = '~$select_org$~';
    }
    if (!argv.NAME) {
      argv.NAME = '~$select_name$~';
    }
  }
}

// Let the user enter missing apps:create options
async function create_app_middleware(appkit, argv) {
  const questions = [];
  const missing = [];

  if (argv.NAME === '~$select_name$~') {
    missing.push('name');
    questions.push({
      type: 'input',
      name: 'app',
      message: 'Enter a name for your app',
      suffix: ':',
      validate: (value) => {
        if (value.length === 0) {
          return 'This field is required.';
        } if (!value.match(/^[0-9A-Za-z]+$/i)) {
          return 'Alphanumeric characters only';
        }
        return true;
      },
    });
  }

  if (argv.space === '~$select_space$~') {
    missing.push('space');
    const spaceNames = (await appkit.api.get('/spaces')).map((i) => i.name).sort();
    if (spaceNames.length === 0) {
      appkit.terminal.error(appkit.terminal.markdown('###===### No spaces were found. At least one space must exist in order to create an app.'));
    }
    const searchSpaces = async (input) => fuzzy.filter((input || ''), spaceNames).map((e) => e.original);
    questions.push({
      type: 'autocomplete',
      name: 'space',
      message: 'Select a space',
      suffix: ':',
      source: (answers, input) => searchSpaces(input),
    });
  }

  if (argv.org === '~$select_org$~') {
    missing.push('org');
    const orgNames = (await appkit.api.get('/organizations')).map((i) => i.name).sort();
    if (orgNames.length === 0) {
      appkit.terminal.error(appkit.terminal.markdown('###===### No orgs were found. At least one org must exist in order to create an app.'));
    }
    const searchOrgs = async (input) => fuzzy.filter((input || ''), orgNames).map((e) => e.original);
    questions.push({
      type: 'autocomplete',
      name: 'org',
      message: 'Select an org',
      suffix: ':',
      source: (answers, input) => searchOrgs(input),
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
    argv.description = argv.d = answers.description;
  }
}

module.exports = {
  help_flag_middleware,
  help_options_middleware,
  find_app_middleware,
  select_app_middleware,
  create_app_prechecks,
  create_app_middleware,
};
