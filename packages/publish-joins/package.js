Package.describe({
  name: 'publish-joins',
  version: '0.1.0',
  summary: 'Publish a related set of mongo documents based on joins',
  // URL to the Git repository containing the source code for this package.
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0.3.2');
  api.use('underscore');
  api.addFiles('subscription-tree.js', 'server');
  api.addFiles('publish-joins.js', 'server');
  
  // for now, make test only (actually PR)
  api.export('subscriptionForEach', 'server', {testOnly: true});
  api.export('PublishJoins', 'server');
});

Package.onTest(function(api) {
  api.use(['tinytest', 'test-helpers', 'publish-joins', 'mongo', 'random', 'underscore']);
  api.addFiles('subscription-tree-tests.js');
  api.addFiles('publish-joins-tests.js');
});
