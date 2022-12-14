#!/usr/bin/env
const nunjucks = require('nunjucks');
const YAML = require('yaml');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const beautify = require('js-beautify');
const editorconfig = require('editorconfig');
require('dotenv').config();

const srcDir = process.env.SOURCE_HTML_DIR || 'src';
const filePattern = process.env.BUILD_HTML_FILE_PATTERN || "**/*.{njk,twig,html}";
const outDir = process.env.OUTPUT_HTML_DIR || 'dist';

const beautifyOption = {};
//editorconfigの設定をjs-beautifyの設定に反映
const eConfig = editorconfig.parseSync('dummy.html')
if (eConfig.indent_style === 'tab') {
  beautifyOption.indent_with_tabs = true;
} else if (eConfig.indent_style === 'space') {
  beautifyOption.indent_with_tabs = false;
}
if (eConfig.indent_size) {
  beautifyOption.indent_size = eConfig.indent_size;
}
if (eConfig.max_line_length) {
  if (eConfig.max_line_length === 'off') {
    beautifyOption.wrap_line_length = 0;
  } else {
    beautifyOption.wrap_line_length = parseInt(eConfig.max_line_length, 10);
  }
}
if (eConfig.insert_final_newline === true) {
  beautifyOption.end_with_newline = true;
} else if (eConfig.insert_final_newline === false) {
  beautifyOption.end_with_newline = false;
}
if (eConfig.end_of_line) {
  if (eConfig.end_of_line === 'cr') {
    beautifyOption.eol = '\r';
  } else if (eConfig.end_of_line === 'lf') {
    beautifyOption.eol = '\n';
  } else if (eConfig.end_of_line === 'crlf') {
    beautifyOption.eol = '\r\n';
  }
}

let globalTemplateVars = {};
const globalTemplateVarFile = path.join(path.dirname(srcDir), 'vars.yml');
if (fs.existsSync(globalTemplateVarFile)) {
  globalTemplateVars = YAML.parse(fs.readFileSync(globalTemplateVarFile, 'utf8'));
}
const nunjucksOptions = {
  autoescape: true,
  // tags: {
  //   blockStart: '<%',
  //   blockEnd: '%>',
  //   variableStart: '<$',
  //   variableEnd: '$>',
  //   commentStart: '<#',
  //   commentEnd: '#>'
  // }
};
nunjucks.configure(srcDir, nunjucksOptions);
const srcFileKeys = glob.sync(filePattern, { cwd: srcDir });
const pages = [];
const loadedLocalVarFiles = {};
srcFileKeys
  .filter((templateFile) => {
    const hasUnderscore = templateFile.split(path.sep).some(parts => parts.match(/^_/));
    if (hasUnderscore) {
      return false;
    }
    return true;
  })
  .forEach((templateFile) => {
    const srcFilePath = path.join(srcDir, templateFile);
    const localTemplateVarFile = path.join(srcDir, path.dirname(templateFile), 'vars.yml');
    if (!loadedLocalVarFiles[localTemplateVarFile]) {
      loadedLocalVarFiles[localTemplateVarFile] = {};
      if (fs.existsSync(localTemplateVarFile)) {
        loadedLocalVarFiles[localTemplateVarFile] = YAML.parse(fs.readFileSync(localTemplateVarFile, 'utf8'));
      }
    }
    localTemplateVars = loadedLocalVarFiles[localTemplateVarFile];
    const sliceEnd = -(path.extname(templateFile).length);
    let outFileName = path.basename(templateFile).slice(0, sliceEnd);
    if (!outFileName.match(/\.[a-zA-Z0-9]+$/)) {
      outFileName += '.html';
    }
    const outFilePath = path.join(outDir, path.dirname(templateFile), outFileName);
    const url = '/' + path.dirname(templateFile).replace(path.win32.sep, '/') + '/' + outFileName;
    const templateVars = Object.assign(globalTemplateVars, localTemplateVars);
    pages.push({
      url: url,
      src: srcFilePath,
      variables: templateVars
    });
    const html = nunjucks.render(templateFile, templateVars);
    if (!fs.existsSync(path.dirname(outFilePath))) {
      fs.mkdirSync(path.dirname(outFilePath), { recursive: true }, (err) => { if (err) throw err; });
    }
    fs.writeFileSync(outFilePath, beautify.html_beautify(html, beautifyOption), (err) => { if (err) throw err; });
  });
fs.writeFileSync('pages.json', JSON.stringify(pages, null, 2), (err) => {
  if (err) throw err;
});
