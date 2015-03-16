PublishJoins = function(sub, cursor, joins) {
  // FIXME: only necessary if sub isn't a tree
  var tree = new SubscriptionTree(sub);

  cursor._publishCursor(tree);
  tree.ready();

  _.each(joins, function(childJoins, joinName) {
    tree.forEach(cursor, function(doc) {
      var childCursor = doc[joinName]();
      PublishJoins(this, childCursor, childJoins);
    });
  });
}
