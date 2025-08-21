module.exports = {
  // pkg configuration for building single executable
  targets: [
    'node18-macos-x64',
    'node18-linux-x64',
    'node18-win-x64'
  ],
  outputPath: './build',
  assets: [],
  scripts: {
    // Entry point is the compiled CLI
    main: './dist/cli/index.js'
  }
};