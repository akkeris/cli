"use strict"

function destroy(appkit, args) {
  console.assert(args.ADDON, 'An addon wasnt provided.');
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
    let del = (input) => {
      if(input === args.ADDON) {
        appkit.api.get('/apps/' + args.app + '/addons', (err, existing_addons) => {
          // If the user has provided a service:plan lets see if any of those happen to match
          // an existing addon on the app, if there's only one match we have a strong reason
          // to try and delete this addon rather than something else. We first check with ':'
          // character becuase all addons+plans must have a :
          if(args.ADDON.indexOf(':') > -1 && existing_addons && 
            existing_addons.filter((a) => { return a.addon.plan.name === args.ADDON }).length === 1) 
          {
            let a = existing_addons.filter((a) => { return a.addon.plan.name === args.ADDON });
            args.ADDON = a[0].name;
          }

          let task = appkit.terminal.task(`Destroying addon **+ ${args.ADDON}** `);
          task.start();
          appkit.api.delete('/apps/' + args.app + '/addons/' + args.ADDON, (err, addon) => {
            if(err) {
              task.end('error');
              return appkit.terminal.error(err);
            }
            task.end('ok');
            console.log(appkit.terminal.markdown(`###===### Successfully removed ~~${addon.name}~~ from ~~${args.app}~~`));
          });
        });
      } else {
        appkit.terminal.soft_error(`Confirmation did not match !!${args.ADDON}!!. Aborted.`);
      }
    };
    if(args.confirm) {
      del(args.confirm);
    } else {
      appkit.terminal.confirm(` ~~▸~~    WARNING: This will remove **+ ${args.ADDON}** from ${args.app} including all/any backups or data.\n ~~▸~~    To proceed, type !!${args.ADDON}!! or re-run this command with !!--confirm ${args.ADDON}!!\n`, del);
    }
}

function create(appkit, args) {
  console.assert(args.SERVICE_PLAN, 'No service plan was provided.');
  let loader = appkit.terminal.loading('Provisioning addon ' + args.SERVICE_PLAN + ' and attaching it to ' + args.app);
  loader.start();
  let payload = {plan:args.SERVICE_PLAN};
  appkit.api.post(JSON.stringify(payload), '/apps/' + args.app + '/addons', function(err, addon) {
    loader.end();
    if(err) {
      return appkit.terminal.error(err);
    }
    console.log(appkit.terminal.markdown(`\n###===### Addon ~~${addon.name}~~ Provisioned\n`));
    appkit.terminal.print(err, addon);
  });
}

function format_plans(addon_service) {
  return `**+ ${addon_service.human_name} (${addon_service.name}) \$${addon_service.price.cents/100}/${addon_service.price.unit}**
  ***Id:*** ${addon_service.id}
  ***State:*** ${addon_service.state}
  ***Description:*** ${addon_service.description}\n`;
}

function list_addons_plans(appkit, args) {
  console.assert(args.SERVICE, 'There was no service provided.');
  appkit.api.get('/addon-services/' + args.SERVICE + '/plans', 
    appkit.terminal.format_objects.bind(null, format_plans, 
      appkit.terminal.markdown('###===### No plans were found.')));
}

function list_addon_plan_info(appkit, args){
  console.assert(args.SERVICE, 'There was no service provided.');
  console.assert(args.SERVICE_PLAN, 'There was no plan ID provided.');
  appkit.api.get(`/addon-services/${args.SERVICE}/plans/${args.SERVICE_PLAN}`,
    (err, plan) => {
      if (err) {
        console.log(appkit.terminal.markdown('###===### Inavlid service or plan ID.'));
      } else { 
      console.log(appkit.terminal.markdown(format_plan_info(plan)));
      }
    },
    appkit.terminal.markdown('###===### Invalid ID.'));
}

function format_plan_info(addon_service) {
  let apps = [];
  addon_service.provisioned_by.map((app) => ( apps.push(`   • Name: ${app.name}\n     ID: ${app.id}`) ));
  return `**+ ${addon_service.human_name} (${addon_service.name}) \$${addon_service.price.cents/100}/${addon_service.price.unit}**
  ***Id:*** ${addon_service.id}
  ***State:*** ${addon_service.state}
  ***Description:*** ${addon_service.description}
  ***Attached Apps (${apps.length}):*** \n${ apps.length != 0 ? `${apps.join('\n\n')}\n` : '' }`;
}

function format_services(addon_service) {
  return `**+ ${addon_service.human_name} (${addon_service.name})**
  ***Description:*** ${addon_service.description}
  ***Id:*** ${addon_service.id}
  ***State:*** ${addon_service.state}\n`;
}

function format_addons(addon_service) {
  return `**+ ${addon_service.name}**
  ***Plan:*** ${addon_service.plan.name}
  ***Id:*** ${addon_service.id}\n`;
}

function format_attached_addons(addon_service) {
  return `**+ ${addon_service.name}**
  ***Plan:*** ${addon_service.addon.plan.name}
  ***Id:*** ${addon_service.app.name === addon_service.addon.app.name ? addon_service.addon.id : (addon_service.id + ' ^^attached^^' )}\n`;
}


function list_attached_addons(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/addon-attachments', 
    appkit.terminal.format_objects.bind(null, format_attached_addons, 
      appkit.terminal.markdown('###===### No attached addons were found.')));
}

function list_owned_addons(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/addon-attachments', 
    appkit.terminal.format_objects.bind(null, format_addons, 
      appkit.terminal.markdown('###===### No addons were found.')));
}

function list_addons(appkit, args) {
  appkit.api.get('/addon-services', 
    appkit.terminal.format_objects.bind(null, format_services, 
      appkit.terminal.markdown('###===### No services were found.')));
}

function list_all_addons(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/addon-attachments', (err, attachments) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    appkit.api.get('/apps/' + args.app + '/addons', (err, addons) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      if(addons.length === 0 && attachments.length === 0) {
        console.log(appkit.terminal.markdown('###===### No addons (attached or owned) were found.'));
      } else {
        if(addons.length > 0) console.log(addons.map(format_addons).map(appkit.terminal.markdown).join('\n'));
        if(attachments.length > 0) console.log(attachments.map(format_attached_addons).map(appkit.terminal.markdown).join('\n'));
      }
    })
  });
}

function info_addons(appkit, args) {
  console.assert(args.ADDON && args.ADDON !== '', 'No addon id was specified.');
  appkit.api.get('/apps/' + args.app + '/addons/' + args.ADDON, appkit.terminal.print);
}

function attach(appkit, args) {
  console.assert(args.app && args.app !== '', 'No application was specified.');
  console.assert(args.ADDON_NAME && args.ADDON_NAME !== '', 'No addon id was specified.');
  let loader = appkit.terminal.loading('Attaching addon ' + args.ADDON_NAME + ' to ' + args.app);
  loader.start();
  appkit.api.get('/apps/' + args.app, (err, data) => {
    if(err) {
      loader.end();
      return appkit.terminal.error(err);
    }
    console.assert(data.id, 'Ensure the app id is defined.');
    let payload = {"app":data.id, "addon":args.ADDON_NAME, force:(args.confirm && args.confirm === args.ADDON_NAME ? true : false), name:(args.as ? args.as : null)};
    appkit.api.post(JSON.stringify(payload), '/apps/' + args.app + '/addon-attachments',  (err, data) => {
      loader.end();
      appkit.terminal.print(err, data);
    });
  });
}

function detach(appkit, args) {
  console.assert(args.app && args.app !== '', 'No application was specified.');
  console.assert(args.ATTACHMENT_NAME && args.ATTACHMENT_NAME !== '', 'No attachment name or id was specified.');
  let loader = appkit.terminal.loading('Detaching addon ' + args.ATTACHMENT_NAME + ' from ' + args.app);
  loader.start();
  appkit.api.get('/apps/' + args.app, (err, app) => {
    if(err) {
      loader.end();
      return appkit.terminal.error(err);
    }
    console.assert(app.id, 'Ensure the app id is defined.');
    appkit.api.delete('/apps/' + args.app + '/addon-attachments/' + args.ATTACHMENT_NAME,  (err, data) => {
      loader.end();
      if(err) {
        return appkit.terminal.error(err);
      }
      console.log(appkit.terminal.markdown(`###===### **${args.ATTACHMENT_NAME}** has been succesfully detached from ##${app.name}##`))
    });
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

    let attach_create_option = JSON.parse(JSON.stringify(require_app_option));
    attach_create_option.confirm = {
      'demand':false,
      'string':true,
      'description':'override existing add-on attachment with the same name (pass the name as the value).'
    };

    appkit.args
      .command('addons', 'manage (list) add-on resources', require_app_option, list_all_addons.bind(null, appkit))
      .command('addons:attach ADDON_NAME', 'attach add-on resource to an app', attach_create_option, attach.bind(null, appkit))
      .command('addons:create SERVICE_PLAN', 'create an add-on resource', require_app_option, create.bind(null, appkit))
      .command('addons:destroy ADDON', 'destroy add-on resources', require_app_option, destroy.bind(null, appkit))
      .command('addons:delete ADDON', false, require_app_option, destroy.bind(null, appkit))
      .command('addons:remove ADDON', false, require_app_option, destroy.bind(null, appkit))
      .command('addons:detach ATTACHMENT_NAME', 'detach add-on resource from an app', require_app_option, detach.bind(null, appkit))
      .command('addons:info ADDON', 'Show info about an add-on and its attachments.', require_app_option, info_addons.bind(null, appkit))
      .command('addons:plans SERVICE', 'list all available plans for an add-on service', {}, list_addons_plans.bind(null, appkit))
      .command('addons:services', 'list all available add-on services', {}, list_addons.bind(null, appkit))
      .command('addons:plans:info SERVICE SERVICE_PLAN', 'Show info about an add-on service plan', {}, list_addon_plan_info.bind(null, appkit))
      // aliases
      .command('addon', false, require_app_option, list_attached_addons.bind(null, appkit))
      .command('addon:attach ADDON_NAME', false, attach_create_option, attach.bind(null, appkit))
      .command('addon:create SERVICE_PLAN', false, require_app_option, create.bind(null, appkit))
      .command('addon:destroy ADDON', false, require_app_option, destroy.bind(null, appkit))
      .command('addon:delete ADDON', false, require_app_option, destroy.bind(null, appkit))
      .command('addon:remove ADDON', false, require_app_option, destroy.bind(null, appkit))
      .command('addon:detach ATTACHMENT_NAME', false, require_app_option, detach.bind(null, appkit))
      .command('addon:info ADDON', false, require_app_option, info_addons.bind(null, appkit))
      .command('addon:plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('addon:services', false, {}, list_addons.bind(null, appkit))
      .command('services', false, {}, list_addons.bind(null, appkit))
      .command('addons:plan SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('addon:plan SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('services:plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('service:plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('service:plan SERVICE', false, {}, list_addons_plans.bind(null, appkit))
      .command('plans SERVICE', false, {}, list_addons_plans.bind(null, appkit))

      // not implemented:
      //.command('addons:upgrade ADDON_NAME ADDON_SERVICE:PLAN', 'upgrade an existing add-on resource to PLAN', require_app_option, info.bind(null, appkit))
      //.command('addons:rename ADDON NEW_NAME', 'Rename an add-on.', require_app_option, info.bind(null, appkit))
      //.command('addons:open ADDON_NAME', 'open an add-on\'s dashboard in your browser', require_app_option, info.bind(null, appkit))
      //.command('addons:docs ADDON_NAME', 'open an add-on\'s documentation in your browser', require_app_option, info.bind(null, appkit))
      //.command('addons:downgrade ADDON_NAME ADDON_SERVICE:PLAN', 'downgrade an existing add-on resource to PLAN', require_app_option, info.bind(null, appkit))
      
  },
  update:function() {
    // do nothing.
  },
  group:'addons',
  help:'manage addons (create, list)',
  primary:true
}