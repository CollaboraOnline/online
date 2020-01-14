const tasks = require('./tasks');

module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  on('task', {
    copyFile: tasks.copyFile,
  });

  return config;
};
