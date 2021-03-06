/* eslint-disable no-await-in-loop */
const assert = require('assert');

function destroy(appkit, args) {
  assert.ok(args.ADDON, 'An addon wasnt provided.');
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  const del = (input) => {
    if (input === args.ADDON) {
      appkit.api.get(`/apps/${args.app}/addons`, (err, existing_addons) => {
        // If the user has provided a service:plan lets see if any of those happen to match
        // an existing addon on the app, if there's only one match we have a strong reason
        // to try and delete this addon rather than something else. We first check with ':'
        // character becuase all addons+plans must have a :
        if (args.ADDON.indexOf(':') > -1 && existing_addons
          && existing_addons.filter((a) => a.addon.plan.name === args.ADDON).length === 1) {
          const a = existing_addons.filter((x) => x.addon.plan.name === args.ADDON);
          args.ADDON = a[0].name;
        }

        const task = appkit.terminal.task(`Destroying addon **+ ${args.ADDON}** `);
        task.start();
        appkit.api.delete(`/apps/${args.app}/addons/${args.ADDON}`, (error, addon) => {
          if (error) {
            task.end('error');
            appkit.terminal.error(error);
            return;
          }
          task.end('ok');
          console.log(appkit.terminal.markdown(`###===### Successfully removed ~~${addon.name}~~ from ~~${args.app}~~`));
        });
      });
    } else {
      appkit.terminal.soft_error(`Confirmation did not match !!${args.ADDON}!!. Aborted.`);
    }
  };
  if (args.confirm) {
    del(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    WARNING: This will remove **+ ${args.ADDON}** from ${args.app} including all/any backups or data.\n ~~▸~~    To proceed, type !!${args.ADDON}!! or re-run this command with !!--confirm ${args.ADDON}!!\n`, del);
  }
}

function promote(appkit, args) {
  assert.ok(args.ADDON_ID, 'No addon name was provided.');
  const loader = appkit.terminal.loading(`Promoting addon ${args.ADDON_ID} to the primary addon service on ${args.app}`);
  loader.start();

  const payload = { primary: true };
  appkit.api.patch(JSON.stringify(payload), `/apps/${args.app}/addons/${args.ADDON_ID}`, (err, addon) => {
    if (err && err.code !== 404) {
      loader.end();
      appkit.terminal.error(err);
      return;
    } if (err && err.code === 404) {
      appkit.api.patch(JSON.stringify(payload), `/apps/${args.app}/addon-attachments/${args.ADDON_ID}`, (error, addon2) => {
        loader.end();
        if (error) {
          appkit.terminal.error(error);
          return;
        }
        console.log(appkit.terminal.markdown(`\n###===### Addon attachment ~~${addon2.name}~~ promoted\n`));
        appkit.terminal.print(error, addon2);
      });
    } else {
      loader.end();
      console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ promoted\n`));
      appkit.terminal.print(err, addon);
    }
  });
}

async function wait(timeInMills) {
  return new Promise((resolve) => setTimeout(resolve, timeInMills));
}

async function wait_on_addon(appkit, args, addon, loading_message) {
  let loader = appkit.terminal.loading(loading_message);
  try {
    loader.start();
    let state = '';
    for (let i = 0; i < 1000; i++) {
      if (i === 999) {
        throw new Error('It seems this addon is taking too long to complete its task, you should contact your system administrator to see if everything is alright.');
      }
      addon = await appkit.api.get(`/apps/${args.app}/addons/${addon.id}`);
      if (addon.state !== 'provisioning') {
        loader.end();
        return addon;
      } if (addon.state_description && addon.state_description !== '' && addon.state_description !== state) {
        state = addon.state_description;
        loader.end();
        loader = appkit.terminal.loading(`${loading_message} (${addon.state_description})`);
        loader.start();
      }
      await wait(5000);
    }
  } catch (e) {
    loader.end();
    throw e;
  }
  return null;
}

async function wait_for_addon(appkit, args) {
  try {
    assert.ok(args.ADDON, 'No addon was provided.');
    const addon = await appkit.api.get(`/apps/${args.app}/addons/${args.ADDON}`);
    if (addon.state === 'provisioning') {
      await wait_on_addon(
        appkit,
        args,
        addon,
        appkit.terminal.markdown(`###===### Waiting for addon ~~${addon.name}~~ to become available`),
      );
    }
    console.log(appkit.terminal.markdown(`###===### Addon ~~${addon.name} available~~\n`));
    appkit.terminal.print(null, addon);
  } catch (e) {
    appkit.terminal.error(e);
  }
}

async function create(appkit, args) {
  let addon = null;
  try {
    assert.ok(args.SERVICE_PLAN, 'No service plan was provided.');
  } catch (e) {
    appkit.terminal.error(e);
    return;
  }
  const loader = appkit.terminal.loading(`Provisioning addon ${args.SERVICE_PLAN} and attaching it to ${args.app}`);
  try {
    loader.start();
    addon = await appkit.api.post(
      JSON.stringify({ plan: args.SERVICE_PLAN, attachment: { name: args.as }, name: args.name }),
      `/apps/${args.app}/addons`,
    );
    loader.end();
  } catch (e) {
    loader.end();
    appkit.terminal.error(e);
    return;
  }

  try {
    assert.ok(addon, 'The addon to create was null, unsure how this happened');
    if (addon.state === 'provisioning' && args.wait) {
      addon = await wait_on_addon(
        appkit,
        args,
        addon,
        appkit.terminal.markdown(`###===### Waiting for addon ~~${addon.name}~~ to be provisioned (this may take 10 minutes)`),
      );
      console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ provisioned\n`));
      appkit.terminal.print(null, addon);
    } else if (addon.state === 'provisioning') {
      console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ is being created in the background. This app will restart when its finished.\n`));
    } else {
      console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ provisioned\n`));
      appkit.terminal.print(null, addon);
    }
  } catch (e) {
    appkit.terminal.error(e);
  }
}


function format_plans(addon_service) {
  return `**+ ${addon_service.human_name} ${addon_service.name} $${addon_service.price.cents / 100}/${addon_service.price.unit}**
  ***Id:*** ${addon_service.id} 
  ***Description:*** ${addon_service.description}
${addon_service.attributes ? Object.keys(addon_service.attributes).map((key) => `  ***${key.replace(/_/g, ' ').replace(/^(\w)|\s(\w)/g, (c) => c.toUpperCase())}:*** ${addon_service.attributes[key]}`).join('\n') : ''}\n`;
}

function list_addons_plans(appkit, args) {
  assert.ok(args.SERVICE, 'There was no service provided.');
  appkit.api.get(`/addon-services/${args.SERVICE}/plans`,
    (err, plans) => {
      if (plans) {
        plans = plans.filter((plan) => plan.state === 'ga' || plan.state === 'public');
      }
      return appkit.terminal.format_objects(
        format_plans,
        appkit.terminal.markdown('###===### No plans were found.'),
        err,
        plans,
      );
    });
}

function format_plan_info(addon_service) {
  const apps = [];
  addon_service.provisioned_by.map((app) => (apps.push(`   • Name: ${app.name}\n     ID: ${app.id}`)));
  return `**+ ${addon_service.human_name} (${addon_service.name}) $${addon_service.price.cents / 100}/${addon_service.price.unit}**
  ***Id:*** ${addon_service.id}
  ***State:*** ${addon_service.state}
  ***Description:*** ${addon_service.description}
  ***Provisioned By (${apps.length}):*** \n${apps.length !== 0 ? `${apps.join('\n\n')}\n` : ''}`;
}

function list_addon_plan_info(appkit, args) {
  assert.ok(args.SERVICE, 'There was no service provided.');
  assert.ok(args.SERVICE_PLAN, 'There was no plan provided.');
  appkit.api.get(`/addon-services/${args.SERVICE}/plans/${args.SERVICE_PLAN}`,
    (err, plan) => {
      if (err) {
        console.log(appkit.terminal.markdown('###===### Inavlid service or plan.'));
      } else {
        console.log(appkit.terminal.markdown(format_plan_info(plan)));
      }
    },
    appkit.terminal.markdown('###===### Invalid ID.'));
}

function format_services(addon_service) {
  return `**+ ${addon_service.human_name} (${addon_service.name})**
  ***Description:*** ${addon_service.description}
  ***Id:*** ${addon_service.id}
  ***State:*** ${addon_service.state}\n`;
}

function format_addons(addon) {
  return `**+ ${addon.id} (${addon.name})**
  ***Plan:*** ${addon.plan.name}
  ***Primary:*** ${addon.primary}
  ***State:*** ${addon.state === 'provisioning' ? '^^provisioning^^' : addon.state}\n`;
}

function format_attached_addons(appkit, addon) {
  const md = (s) => appkit.terminal.markdown(s);
  const ital = (s) => appkit.terminal.italic(s);
  const owner = addon.app.name === addon.addon.app.name;

  return md(`**+ ${owner ? addon.addon.id : addon.id} (${addon.name})** ${!owner && '🔗'}
  ***Plan:*** ${addon.addon.plan.name}
  ***Primary:*** ${addon.primary}
  ***State:*** ${addon.state || 'provisioned'}
  ${!owner && ital(`^^Attached From^^ ${addon.addon.app.name}`)}\n`);
}


function list_attached_addons(appkit, args) {
  appkit.api.get(`/apps/${args.app}/addon-attachments`,
    appkit.terminal.format_objects.bind(null, format_attached_addons,
      appkit.terminal.markdown('###===### No attached addons were found.')));
}

// function list_owned_addons(appkit, args) {
//   appkit.api.get(`/apps/${args.app}/addon-attachments`,
//     appkit.terminal.format_objects.bind(null, format_addons,
//       appkit.terminal.markdown('###===### No addons were found.')));
// }

function list_addons(appkit) {
  appkit.api.get('/addon-services',
    appkit.terminal.format_objects.bind(null, format_services,
      appkit.terminal.markdown('###===### No services were found.')));
}

async function list_all_addons(appkit, args) {
  let addons; let
    attachments;
  try {
    addons = await appkit.api.get(`/apps/${args.app}/addons`);
    attachments = await appkit.api.get(`/apps/${args.app}/addon-attachments`);
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  if (addons.length === 0 && attachments.length === 0) {
    console.log(appkit.terminal.markdown('###===### No addons (attached or owned) were found.'));
    return;
  }

  if (addons.length > 0) {
    console.log(addons.map(format_addons).map(appkit.terminal.markdown).join('\n'));
  }
  if (attachments.length > 0) {
    console.log(attachments.map(format_attached_addons.bind(null, appkit)).join('\n'));
  }
}

function info_addons(appkit, args) {
  assert.ok(args.ADDON && args.ADDON !== '', 'No addon id was specified.');
  appkit.api.get(`/apps/${args.app}/addons/${args.ADDON}`, appkit.terminal.print);
}

function attach(appkit, args) {
  assert.ok(args.app && args.app !== '', 'No application was specified.');
  assert.ok(args.ADDON_ID && args.ADDON_ID !== '', 'No addon id was specified.');
  const loader = appkit.terminal.loading(`Attaching addon ${args.ADDON_ID} to ${args.app}`);
  loader.start();
  appkit.api.get(`/apps/${args.app}`, (err, data) => {
    if (err) {
      loader.end();
      appkit.terminal.error(err);
      return;
    }
    assert.ok(data.id, 'Ensure the app id is defined.');
    const payload = {
      app: data.id,
      addon: args.ADDON_ID,
      force: (!!(args.confirm && args.confirm === args.ADDON_ID)),
      name: (args.as ? args.as : null),
    };
    appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/addon-attachments`, (error, data2) => {
      loader.end();
      appkit.terminal.print(error, data2);
    });
  });
}

function detach(appkit, args) {
  assert.ok(args.app && args.app !== '', 'No application was specified.');
  assert.ok(args.ADDON_ID && args.ADDON_ID !== '', 'No attachment name or id was specified.');
  const loader = appkit.terminal.loading(`Detaching addon ${args.ADDON_ID} from ${args.app}`);
  loader.start();
  appkit.api.get(`/apps/${args.app}`, (err, app) => {
    if (err) {
      loader.end();
      appkit.terminal.error(err);
      return;
    }
    assert.ok(app.id, 'Ensure the app id is defined.');
    appkit.api.delete(`/apps/${args.app}/addon-attachments/${args.ADDON_ID}`, (error) => {
      loader.end();
      if (error) {
        appkit.terminal.error(error);
        return;
      }
      console.log(appkit.terminal.markdown(`###===### **${args.ADDON_ID}** has been succesfully detached from ##${app.name}##`));
    });
  });
}

async function rename(appkit, args) {
  const name = args.attachment || args.addon;
  const type = args.attachment ? 'attachment' : 'addon';
  if (!args.attachment && !args.addon) {
    appkit.terminal.error(new Error('You must either specify an attachment or addon to rename.'));
    return;
  }
  const loader = appkit.terminal.loading(`Renaming ${type} ${name} to ${args.NEW_NAME}`);
  loader.start();
  try {
    assert.ok(name, 'No name was specified');
    assert.ok(args.NEW_NAME, 'No new name was specified');
    if (type === 'addon') {
      await appkit.api.patch(JSON.stringify({ attachment: { name: args.NEW_NAME } }), `/apps/${args.app}/addons/${name}`);
    } else {
      await appkit.api.patch(JSON.stringify({ name: args.NEW_NAME }, `/apps/${args.app}/addon-attachments/${name}`));
    }
    loader.end();
    console.log(appkit.terminal.markdown(`###===### **${name}** has been succesfully renamed to ##${args.NEW_NAME}##`));
  } catch (e) {
    loader.end();
    appkit.terminal.error(e);
  }
}

async function upgrade(appkit, args) {
  let maintenance_ran = false;
  let loader = null;
  try {
    if (args.ADDON.indexOf(':') !== -1) {
      appkit.terminal.error(new Error(`The addon ${args.ADDON} could not be found.`));
      return;
    }
    assert.ok(args.PLAN, 'No plan was specified');
    assert.ok(args.ADDON, 'No addon was specified');
    let addon = await appkit.api.get(`/apps/${args.app}/addons/${args.ADDON}`);
    const addon_service = await appkit.api.get(`/addon-services/${addon.addon_service.id}`);
    const addon_plan = await appkit.api.get(`/addon-services/${addon_service.id}/plans/${args.PLAN}`);
    if (addon_service.supports_upgrading) {
      loader = appkit.terminal.loading(
        appkit.terminal.markdown(`\n###===### Waiting for addon ~~${addon.name}~~ to be upgraded`),
      );
      loader.start();
      await appkit.api.patch(JSON.stringify({ maintenance: true }), `/apps/${args.app}`);
      maintenance_ran = true;
      await appkit.api.patch(JSON.stringify({ plan: addon_plan.id }), `/apps/${args.app}/addons/${args.ADDON}`);
      addon.state = 'provisioning';
      loader.end();
      addon = await wait_on_addon(
        appkit,
        args,
        addon,
        appkit.terminal.markdown(`###===### Waiting for addon ~~${addon.name}~~ to be upgraded`),
      );
      console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ provisioned\n`));
      appkit.terminal.print(null, addon);
    } else {
      throw new Error(`The service ${addon_service.name} does not support upgrades.`);
    }
  } catch (e) {
    if (loader) {
      loader.end();
    }
    appkit.terminal.error(e);
  } finally {
    if (maintenance_ran) {
      await appkit.api.patch(JSON.stringify({ maintenance: false }), `/apps/${args.app}`);
    }
  }
}

async function downgrade(appkit, args) {
  let maintenance_ran = false;
  let loader = null;
  try {
    assert.ok(args.PLAN, 'No plan was specified');
    assert.ok(args.ADDON, 'No addon was specified');
    let addon = await appkit.api.get(`/apps/${args.app}/addons/${args.ADDON}`);
    const addon_service = await appkit.api.get(`/addon-services/${addon.addon_service.id}`);
    const addon_plan = await appkit.api.get(`/addon-services/${addon_service.id}/plans/${args.PLAN}`);
    if (addon_service.supports_upgrading) {
      loader = appkit.terminal.loading(
        appkit.terminal.markdown(`\n###===### Waiting for addon ~~${addon.name}~~ to be downgraded`),
      );
      loader.start();
      await appkit.api.patch(JSON.stringify({ maintenance: true }), `/apps/${args.app}`);
      maintenance_ran = true;
      await appkit.api.patch(JSON.stringify({ plan: addon_plan.id }), `/apps/${args.app}/addons/${args.ADDON}`);
      addon.state = 'provisioning';
      loader.end();
      addon = await wait_on_addon(
        appkit,
        args,
        addon,
        appkit.terminal.markdown(`\n###===### Waiting for addon ~~${addon.name}~~ to be downgraded`),
      );
      console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ provisioned\n`));
      appkit.terminal.print(null, addon);
    } else {
      throw new Error(`The service ${addon_service.name} does not support downgrades.`);
    }
  } catch (e) {
    if (loader) {
      loader.end();
    }
    appkit.terminal.error(e);
  } finally {
    if (maintenance_ran) {
      await appkit.api.patch(JSON.stringify({ maintenance: false }), `/apps/${args.app}`);
    }
  }
}

module.exports = {
  init(appkit) {
    const require_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on.',
      },
    };
    const require_app_wait_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on.',
      },
      wait: {
        alias: 'w',
        demand: false,
        default: true,
        boolean: true,
        description: 'Whether to wait for the addon to be provisioned.',
      },
    };

    const attach_create_option = JSON.parse(JSON.stringify(require_app_option));
    attach_create_option.confirm = {
      demand: false,
      string: true,
      description: 'override existing add-on attachment with the same name (pass the name as the value).',
    };
    attach_create_option.as = {
      demand: false,
      string: true,
      description: 'name for the initial add-on attachment (and prefix for config vars)',
    };

    const require_addon_create = JSON.parse(JSON.stringify(require_app_wait_option));
    require_addon_create.name = {
      demand: false,
      string: true,
      description: 'name for the add-on resource',
    };
    require_addon_create.as = {
      demand: false,
      string: true,
      description: 'name for the initial add-on attachment (and prefix for config vars)',
    };

    const require_rename = JSON.parse(JSON.stringify(require_app_option));
    require_rename.attachment = {
      demand: false,
      string: true,
      description: 'The attachment to rename',
    };
    require_rename.addon = {
      demand: false,
      string: true,
      description: 'The addon to rename',
    };

    const require_addon_delete = JSON.parse(JSON.stringify(require_app_option));
    require_addon_delete.confirm = {
      alias: 'c',
      demand: false,
      string: true,
      description: 'Confirm (in advance) the name of the addon to destroy.',
    };

    appkit.args
      .command('addons', 'Manage (list) add-on resources', require_app_option, list_all_addons.bind(null, appkit))
      .command('addons:attach ADDON_ID', 'Attach an add-on resource to an app', attach_create_option, attach.bind(null, appkit))
      .command('addons:create SERVICE_PLAN', 'Create an add-on resource', require_addon_create, create.bind(null, appkit), [])
      .command('addons:destroy ADDON', 'Destroy an add-on resource', require_addon_delete, destroy.bind(null, appkit))
      .command('addons:rename NEW_NAME', 'Rename an add-on attachment\'s name.', require_rename, rename.bind(null, appkit))
      .command('addons:upgrade ADDON PLAN', 'Upgrade an add-on\'s plan', require_app_wait_option, upgrade.bind(null, appkit))
      .command('addons:downgrade ADDON PLAN', 'Downgrade an add-on\'s plan', require_app_wait_option, downgrade.bind(null, appkit))
      .command('addons:detach ADDON_ID', 'Detach an add-on resource from an app', require_app_option, detach.bind(null, appkit))
      .command('addons:info ADDON', 'Show info about an add-on and its attachments', require_app_option, info_addons.bind(null, appkit))
      .command('addons:plans SERVICE', 'List all available plans for an add-on service', {}, list_addons_plans.bind(null, appkit))
      .command('addons:services', 'List all available add-on services', {}, list_addons.bind(null, appkit))
      .command('addons:wait ADDON', 'Show provisioning status of the add-ons on an app', require_app_option, wait_for_addon.bind(null, appkit))
      .command('addons:plans:info SERVICE SERVICE_PLAN', 'Show info about an add-on service plan', {}, list_addon_plan_info.bind(null, appkit))
      .command('addons:promote ADDON_ID', 'Promote an add-on and make it the primary for an add-on service', require_app_option, promote.bind(null, appkit))
      // aliases
      .command('addon', false, require_app_option, list_attached_addons.bind(null, appkit))
      .command('addon:attach ADDON_ID', false, attach_create_option, attach.bind(null, appkit))
      .command('addon:create SERVICE_PLAN', false, require_app_option, create.bind(null, appkit))
      .command('addon:destroy ADDON', false, require_addon_delete, destroy.bind(null, appkit))
      .command('addon:delete ADDON', false, require_addon_delete, destroy.bind(null, appkit))
      .command('addons:delete ADDON', false, require_addon_delete, destroy.bind(null, appkit))
      .command('addon:remove ADDON', false, require_addon_delete, destroy.bind(null, appkit))
      .command('addons:remove ADDON', false, require_addon_delete, destroy.bind(null, appkit))
      .command('addon:detach ADDON_ID', false, require_app_option, detach.bind(null, appkit))
      .command('addon:info ADDON', false, require_app_option, info_addons.bind(null, appkit))
      .command('addon:plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('addon:services', false, {}, list_addons.bind(null, appkit))
      .command('addon:plan SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('addons:plan SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('addons:primary ADDON_ID', false, require_app_option, promote.bind(null, appkit))
      .command('services', false, {}, list_addons.bind(null, appkit))
      .command('services:plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('service:plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('service:plan SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('upgrade ADDON PLAN', false, require_app_wait_option, upgrade.bind(null, appkit))
      .command('downgrade ADDON PLAN', false, require_app_wait_option, downgrade.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'addons',
  help: 'manage addons (create, list)',
  primary: true,
};
