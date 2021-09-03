const assert = require('assert');

/* eslint-disable */
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
/* eslint-enable */

async function listRecommendations(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const recommendations = await appkit.api.get(`/apps/${args.app}/recommendations`);

    console.log(appkit.terminal.markdown(`###===### **⬢ ${args.app}** Recommendations ###===###`));

    if (!recommendations || recommendations.length === 0) {
      console.log(appkit.terminal.markdown('\nNo recommendations were found.'));
      return;
    }

    // Sort by service
    const filtered = {};
    recommendations.forEach((x) => {
      if (!filtered[x.service]) {
        filtered[x.service] = [];
      }
      filtered[x.service].push(x);
    });

    // Output should look like the following:
    /*
        === ⬢ app-space Recommendations ===

        Service: Service_name

        resize formation (269af9dd-b668-4b5a-b9f1-e76e97304c6d)
        -------------------------------------------------------
        description         Resize web from gp1 to gp0 (Underutilized VMem Request in app)
        resource            web
        plan                gp0

        ...
    */

    const md = (s) => appkit.terminal.markdown(s);
    const bld = (s) => md(appkit.terminal.bold(s));
    const label = (s) => ({ text: md(`**${s}**`), width: 20 });
    const ui = require('cliui')();

    ui.div();

    Object.keys(filtered).forEach((service) => {
      ui.div(bld(`Service: ${service[0].toUpperCase()}${service.slice(1)}`));
      ui.div();

      filtered[service].forEach((rec) => {
        ui.div(md(`***${rec.action} ${rec.resource_type.name}*** ###(${rec.id})###`));

        // Spit out - for the entire length of header (+ 4 for spaces/parenthesis)
        ui.div(md(`###${'-'.repeat(rec.action.length + rec.resource_type.name.length + rec.id.length + 4)}###`));

        Object.keys(rec.details).forEach((key) => {
          ui.div(label(key), rec.details[key]);
        });
      });
    });

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
}

async function deleteRecommendation(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.ID && args.ID !== '', 'An ID for a recommendation was not provided');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    await appkit.api.get(`/apps/${args.app}/recommendations?recommendation=${args.ID}`);
  } catch (err) {
    console.log();
    appkit.terminal.error(err);
    return;
  }

  const del = (input) => {
    console.log();
    if (input === 'yes') {
      const task = appkit.terminal.task(`Deleting recommendation **${args.ID}** on ***${args.app}***`);
      task.start();
      appkit.api.delete(`/apps/${args.app}/recommendations?recommendation=${args.ID}`, (err) => {
        if (err) {
          task.end('error');
          appkit.terminal.error(err);
          return;
        }
        task.end('ok');
      });
    } else {
      appkit.terminal.soft_error('Aborted.');
    }
  };

  if (args.confirm) {
    del('yes');
  } else {
    appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete the recommendation **${args.ID}** on ***${args.app}***.\n ~~▸~~    To proceed, type !!yes!! ###(or rerun with --confirm)###\n`, del);
  }
}

async function clearRecommendations(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  let recommendations;

  try {
    recommendations = await appkit.api.get(`/apps/${args.app}/recommendations`);
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  if (!recommendations || recommendations.length === 0) {
    console.log(appkit.terminal.markdown('\nNo recommendations were found.'));
    return;
  }

  console.log('\nRecommendations:\n');
  recommendations.forEach((r) => {
    console.log(appkit.terminal.markdown(` !!•!! (${r.service[0].toUpperCase()}${r.service.slice(1)}) ${r.action} ${r.resource_type.name} ###(${r.id})###`));
  });
  console.log();

  const del = async (input) => {
    console.log();
    if (input === 'yes') {
      const task = appkit.terminal.task(`Deleting recommendations on ***${args.app}***`);
      task.start();

      try {
        await asyncForEach(recommendations, async (recommendation) => {
          await appkit.api.delete(`/apps/${args.app}/recommendations?recommendation=${recommendation.id}`);
        });
      } catch (err) {
        task.end('error');
        appkit.terminal.error(err);
        return;
      }
      task.end('ok');
    } else {
      appkit.terminal.soft_error('Aborted.');
    }
  };

  if (args.confirm) {
    await del('yes');
  } else {
    appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete ALL recommendations on ***${args.app}*** (see above).\n ~~▸~~    To proceed, type !!yes!! ###(or rerun with --confirm)###\n`, del);
  }
}

const beta = '\x1B[3m\x1B[1m(BETA)\x1B[0m';

module.exports = {
  init(appkit) {
    const require_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
    };

    const require_confirm_app_option = {
      ...require_app_option,
      confirm: {
        alias: 'c',
        demand: false,
        boolean: true,
        description: 'Confirm (in advance) that you want to perform this destructive action',
      },
    };

    appkit.args
      .command('recommendations', `Show a list of available recommendations on an app ${beta}`, require_app_option, listRecommendations.bind(null, appkit))
      .command('recommendations:delete ID', `Delete a recommendation on an app ${beta}`, require_confirm_app_option, deleteRecommendation.bind(null, appkit))
      .command('recommendations:clear', `Delete all recommendations on an app ${beta}`, require_confirm_app_option, clearRecommendations.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'recommendations',
  help: `manage recommendations for apps ${beta}`,
  primary: true,
};
