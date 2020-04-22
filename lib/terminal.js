const util = require('util');
const assert = require('assert');
const ui = require('cliui');
const cli_table = require('cli-table3');

// colors array: [dark, med, light]
const colors_red = ['\x1B[2;31m', '\x1B[1;31m', '\x1B[1;91m'];
const colors_blue = ['\x1B[2;34m', '\x1B[1;34m', '\x1B[38;5;104m'];
const colors_yellow = ['\x1B[33m', '\x1B[1;93m', '\x1B[38;5;228m'];
const colors_gray = ['\x1B[2;37m', '\x1B[37m'];
const colors_green = ['\x1B[32m', '\x1B[92m'];
// default color
const colors = colors_blue;

// highlight color
const highlight = '\x1B[1;38;5;105m'; // 125

// error color
const error_color = '\x1B[1;38;5;124m';

// success task checked.
const task_ok = '\x1B[0m\x1B[36m ✓ \x1B[0m';
const task_warn = '\x1B[33m ⚠ \x1B[0m';
const task_error = '\x1B[31m ✕ \x1B[0m';

const hideCursor = '\x1B[?25l';
const showCursor = '\x1B[?25h';
const clearLine = '\x1B[2K';
const saveCursor = '\x1B7';
const restoreCursor = '\x1B8';
const normalColor = '\x1B[0m';
const boldText = '\x1B[1m';
const italicText = '\x1B[3m';

function getDateDiff(date /*: Date */) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
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

/**
 * Format markdown-style tags surrounding text in a string to ASCII color tags
 * \*\*blue\*\* ~~yellow~~ !!red!! ##gray## ^^green^^
 * @param {string} strs String to format
 */
function markdown(strs) {
  if (process.env.AKA_NO_COLORS) {
    return strs.replace(/(\*\*\*)(.+)(\*\*\*)/g, '$2')
      .replace(/(\*\*)(.+)(\*\*)/g, '$2')
      .replace(/(\*)(.+)(\*)/g, '$2')
      .replace(/(~~~)([^~]+)(~~~)/g, '$2')
      .replace(/(~~)([^~]+)(~~)/g, '$2')
      .replace(/(!!)([^!]+)(!!)/g, '$2')
      .replace(/(###)([^#]+)(###)/g, '$2')
      .replace(/(##)([^#]+)(##)/g, '$2')
      .replace(/(\^\^\^)([^^]+)(\^\^\^)/g, '$2')
      .replace(/(\^\^)([^^]+)(\^\^)/g, '$2');
  }
  return strs.replace(/(\*\*\*)(.+)(\*\*\*)/g, `${colors[1]}$2${normalColor}`)
    .replace(/(\*\*)(.+)(\*\*)/g, `${colors[2]}$2${normalColor}`)
    .replace(/(\*)(.+)(\*)/g, `${colors[0]}$2${normalColor}`)
    .replace(/(~~~)([^~]+)(~~~)/g, `${colors_yellow[1]}$2${normalColor}`)
    .replace(/(~~)([^~]+)(~~)/g, `${colors_yellow[0]}$2${normalColor}`)
    .replace(/(!!)([^!]+)(!!)/g, `${colors_red[1]}$2${normalColor}`)
    .replace(/(###)([^#]+)(###)/g, `${colors_gray[0]}$2${normalColor}`)
    .replace(/(##)([^#]+)(##)/g, `${colors_gray[1]}$2${normalColor}`)
    .replace(/(\^\^\^)([^^]+)(\^\^\^)/g, `${colors_green[0]}$2${normalColor}`)
    .replace(/(\^\^)([^^]+)(\^\^)/g, `${colors_green[1]}$2${normalColor}`);
}

function task(text) {
  assert.ok(text, 'A task name must be provided!');
  text = markdown(text);
  const loading_text = ['\u28fe', '\u28fd', '\u28fb', '\u28bf', '\u287f', '\u28df', '\u28ef', '\u28f7'];
  let i = 0;
  let interval = null;
  const start = function start() {
    process.stdout.write(`${hideCursor + text} ...  `);
    interval = setInterval(() => {
      process.stdout.write(`\b${highlight}${loading_text[i % loading_text.length]}\x1B[0m`);
      i++;
    }, 100);
  };
  const end = function end(result) {
    if (interval) {
      clearInterval(interval);
    }
    process.stdout.write(`\b${normalColor}${showCursor}`);
    if (result.toLowerCase() === 'ok') {
      process.stdout.write(`${task_ok}\n`);
    } else if (result.toLowerCase() === 'warn' || result.toLowerCase() === 'warning') {
      process.stdout.write(`${task_warn}\n`);
    } else if (result.toLowerCase() === 'error' || result.toLowerCase() === 'err') {
      process.stdout.write(`${task_error}\n`);
    } else {
      process.stdout.write('\n');
    }
  };
  return { start, end };
}


function loading(text) {
  text = text || 'Loading';
  text = markdown(text);
  // const loading_text_moons = ['🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔'];
  // const loading_text_clocks = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];
  const loading_text_binary = ['\u28fe', '\u28fd', '\u28fb', '\u28bf', '\u287f', '\u28df', '\u28ef', '\u28f7'];
  const loading_text = loading_text_binary;
  let i = 0;
  let interval = null;
  const start = function start() {
    process.stdout.write(`${saveCursor + hideCursor + text} ...  `);
    interval = setInterval(() => {
      process.stdout.write(`\b${highlight}${loading_text[i % loading_text.length]}\x1B[0m`);
      i++;
    }, 75);
  };
  const end = function end() {
    if (interval) {
      clearInterval(interval);
      process.stdout.write(clearLine + normalColor + showCursor + restoreCursor);
    }
  };
  return { start, end };
}

function error(obj, onLogin) {
  if (process.env.DEBUG && obj && obj.message && obj.stack) {
    console.log(obj.message);
    console.log(obj.stack);
  }
  if (obj && obj.code && obj.code === 401 && !onLogin) {
    process.stderr.write(` ${error_color}▸${normalColor} You do not appear to be logged in, use "aka auth:login" and try again.\n${normalColor}`);
  } else if (obj.code && obj.body) {
    try {
      const msg = JSON.parse(obj.body.toString());
      if (msg.message) {
        console.error(`☠  ${error_color}Error ${obj.code}${normalColor}${msg.message ? (`, ${msg.message}`) : obj.body.toString()}`);
      } else if (msg.error_description && msg.error) {
        console.error(`☠  ${error_color}Error ${normalColor}${msg.error_description} (${msg.error})`);
      } else {
        console.error(`☠  ${error_color}Error ${normalColor}`, obj.body);
      }
    } catch (e) {
      const msg = obj.body.toString();
      console.error(`☠  ${error_color}Error ${normalColor}`, obj.code, msg && msg !== '' ? msg.replace(/\n/, '\n          ') : 'The specified item was not found. Did you forget to provide an app name, or other parameter?');
    }
  } else if (obj.message) {
    console.error(`☠  ${obj.message}`);
  } else {
    console.error(`☠  ${obj}`);
  }
}

function fromKeyedArrayToTable(data) {
  const out = [];
  Object.keys(data).forEach((key) => {
    data[key].forEach((item, i) => {
      out[i] = out[i] || {};
      out[i][key] = item;
    });
  });
  return out;
}

function table(obj, options) {
  if (obj.length === 0) {
    console.log('No data found.');
    return;
  }
  const keys = Object.keys(obj[0]);
  const t = new cli_table({ head: keys, style: { head: ['bold', 'blue'] }, ...options }); // eslint-disable-line
  obj.forEach((o) => {
    const d = [];
    keys.forEach((k) => {
      if (o[k] && typeof (o[k]) === 'object') {
        o[k] = Object.keys(o[k]).map((z) => `${z}=${o[k][z] ? o[k][z].toString() : null}`).join(', ');
      }
      d.push(o[k] ? o[k].toString() : '');
    });
    t.push(d);
  });
  console.log(t.toString());
}

function vtable(obj, sort) {
  const dis = ui({ width: process.stdout.columns });
  const keys = sort ? Object.keys(obj).sort() : Object.keys(obj);

  let max_width = 35;
  keys.forEach((d) => {
    if (obj[d] && typeof (obj[d]) === 'object') {
      const subkeys = sort ? Object.keys(obj[d]).sort() : Object.keys(obj[d]);
      obj[d] = subkeys.map((z) => {
        if (obj[d][z] && typeof (obj[d][z]) !== 'string') {
          return Object.keys(obj[d][z]).map((y) => (`${y}=${obj[d][z][y].toString()}`)).join(', ');
        }
        return `${z}=${obj[d][z] ? obj[d][z].toString() : ''}`;
      }).join(', ');
    }
    max_width = d.length > max_width ? d.length : max_width;
  });
  keys.forEach((d) => {
    dis.div(
      { text: colors[2] + d + normalColor, width: max_width + 2, padding: [0, 1, 0, 1] },
      { text: obj[d], padding: [0, 1, 0, 1] },
    );
  });
  console.log(dis.toString());
}

function shell(obj) {
  Object.keys(obj).forEach((d) => {
    console.log(`${d}="${obj[d]}"`);
  });
}

function header(text) {
  console.log(`${highlight}➟➟➟ ${normalColor}${text}`);
}

function hidden(prompt, callback) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const stdin = process.openStdin(); let
    i = 0;
  const data_track = function data_track(char) {
    char += '';
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        stdin.pause();
        break;
      default:
        process.stdout.write(`\x1B[2K\x1B[200D${prompt}[${(i % 2 === 1) ? '=-' : '-='}]`);
        i++;
        break;
    }
  };
  process.stdin.on('data', data_track);

  rl.question(prompt, (value) => {
    rl.history = rl.history.slice(1);
    process.stdin.removeListener('data', data_track);
    rl.close();
    callback(value);
  });
}

function print(err, obj, sort) {
  if (err) {
    return error(err);
  } if (Array.isArray(obj)) {
    return table(obj);
  }
  if (obj.name && obj.id) {
    console.log(markdown(`###===### ^^^${obj.name} (${obj.id})^^^`));
  }
  return vtable(obj, sort);
}

function format_objects(formatter, not_found, err, data) {
  if (data && data.length > 0) {
    data = data.map(formatter).map(markdown);
    console.log(data.join('\n'));
  } else if (data && data.length === 0) {
    console.log(not_found);
  } else {
    error(err);
  }
}

function question(prompt, cb) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      if (cb) {
        cb(answer);
      }
      resolve(answer);
    });
  });
}

question[util.promisify.custom] = (prompt) => new Promise((resolve) => {
  question(prompt, (answer) => resolve(answer));
});

function input(cb) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('> ', (answer) => {
    rl.close();
    cb(answer);
  });
}

function confirm(strs, cb) {
  console.log(markdown(strs));
  input(cb);
}

function soft_error(strs) {
  console.log(markdown(`  !!▸!!    ${strs}`));
}

function update_statement(current, latest) {
  return markdown(`~~Update available! Run 'aka update' to update.~~ \n!!${current}!! -> ^^${latest}^^`);
}

function bold(s) {
  return boldText + s + normalColor;
}

function italic(s) {
  return italicText + s + normalColor;
}

module.exports = {
  question,
  hidden,
  soft_error,
  confirm,
  input,
  loading,
  task,
  error,
  table,
  vtable,
  shell,
  color: colors[2],
  nocolor: normalColor,
  highlight,
  header,
  fromKeyedArrayToTable,
  print,
  markdown,
  friendly_date: getDateDiff,
  format_objects,
  update_statement,
  bold,
  italic,
};
