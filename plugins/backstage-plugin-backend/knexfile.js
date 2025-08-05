import path from 'path';

module.exports = {
  client: 'better-sqlite3',
  connection: {
    directory: path.resolve(__dirname, 'db'),
  },
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    extension: 'js',
  },
};
