"use strict"

const fs = require('fs');
const nrc = require('netrc');
const netrc = nrc();

function login(appkit, args) {
  let exec = (OTP) => {
    let loader = appkit.terminal.task('Logging you in');
    loader.start();
    let headers = {
      'Authorization':'Basic ' + ((Buffer.from(args.username + ':' + args.password)).toString('base64')),
      'Content-Type':'application/json',
      'Accept':'application/json',
      'User-Agent':'akkeris-cli',
    };
    if(OTP) {
      headers = Object.assign(headers, OTP)
    }
    appkit.http.post(
      JSON.stringify({
        'notes':'Akkeris CLI Token (' + require('os').hostname() + ')', 
        'note':'Akkeris CLI Token (' + (new Date()).toISOString() + ')', 
        'notes_url':'', 
        'fingerprint':'',
        'scopes':['read:user','read:org'],
      }), 
      `https://${appkit.config.akkeris_auth_host}/authorizations`, 
      headers,
    (err, data) => {
      if(err) {
        if(err.body) {
          err.body = err.body.toString('utf8');
        }
        if(err.body && err.body.indexOf('2FA') > -1 || err.body && err.body.indexOf('OTP') > -1) {
          let otp_header = Object.keys(err.headers).filter((x) => { return x.toLowerCase().indexOf("-otp") !== -1 && x.toLowerCase().startsWith("x-") })
          if(otp_header.length !== 1) {
            loader.end('error')
            return appkit.terminal.error("Unable to determine type of two factor OTP: " + err.body, true)
          }
          loader.end('ok');
          appkit.terminal.question('Two Factor Token: ', (OTP) => {
            let obj = {}
            obj[otp_header[0]] = OTP
            exec(obj);
          });
        } else {
          loader.end('error');
          return appkit.terminal.error(err, true);
        }
      } else {
        loader.end('ok');
        if(!data.token) {
          return appkit.terminal.error('Login failed, or something else bad happened.');
        }
        netrc[appkit.config.akkeris_api_host] = {login:args.username, password:data.token};
        nrc.save(netrc);
      }
    });
  };
  if(!args.username) {
    appkit.terminal.question('Username: ', (username) => {
      args.username = username;
      if(!args.password) {
        appkit.terminal.hidden('Password: ', (password) => {
          args.password = password;
          exec();
        });
      } else {
        exec();
      }
    });
  } else {
  if(!args.password) {
      appkit.terminal.hidden('Password: ', (password) => {
        args.password = password;
        exec();
      });
    } else {
      exec();
    }
  }
}

function logout(appkit, args) {
  if(netrc[appkit.config.akkeris_api_host]) {
    delete netrc[appkit.config.akkeris_api_host];
    nrc.save(netrc);
  }
}

function token(appkit, args) {
  let token = netrc[appkit.config.akkeris_api_host];
  console.log(token && token.password ? token.password : '== No token was found.');
}

function format_whoami(data) {
  return `${data.name} (**${data.email}**)`;
}

function whoami(appkit, args) {
  let loader = appkit.terminal.task('Getting your account information');
  loader.start();
  appkit.api.get('/account', (err, data) => {
    if(err) {
      loader.end('error');
      return appkit.terminal.error(err);
    }
    loader.end('ok');
    console.log(appkit.terminal.markdown(format_whoami(data)));
  });
}

module.exports = {
  init:function(appkit) {
    let login_options = {
      'username':{
        'alias':'u',
        'demand':false,
        'string':true,
        'description':'The username to login as'
      },
      'password':{
        'alias':'p',
        'demand':false,
        'string':true,
        'description':'The password to use when logging in'
      }
    };
    appkit.args
      //.command('auth:2fa', 'check 2fa status', {}, auth_2fa.bind(null, appkit))
      //.command('auth:2fa:disable', 'disable two-factor authentication for your account', {}, auth_2fa_disable.bind(null, appkit))
      //.command('auth:2fa:enable', 'enable 2fa on your account', {}, auth_2fa_enable.bind(null, appkit))
      //.command('auth:2fa:generate', 'generates and replaces recovery codes', {}, auth_2fa_generate.bind(null, appkit))
      .command('auth', 'authentication (login, logout)', {}, whoami.bind(null, appkit))
      .command('auth:login', 'log in with your credentials', login_options, login.bind(null, appkit))
      .command('auth:logout', 'clear local authentication credentials', {}, logout.bind(null, appkit))
      .command('auth:token', 'display your api token', {}, token.bind(null, appkit))
      .command('auth:whoami', 'display your user information', {}, whoami.bind(null, appkit))
      .command('token', false, {}, token.bind(null, appkit))
      .command('whoami', false, {}, whoami.bind(null, appkit))
      .command('login', false, login_options, login.bind(null, appkit))
      .command('logout', false, {}, logout.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'auth',
  help:'login and logout',
  primary:true
}