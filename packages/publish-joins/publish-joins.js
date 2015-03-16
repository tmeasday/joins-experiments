PublishJoins = function(sub, cursor, joins) {
  // FIXME: only necessary if sub isn't a tree
  var tree = new SubscriptionTree(sub);
  tree.publish(function() {
    return publisher(this, cursor, joins);
  });
};

var publisher = function(tree, cursor, joins) {
  _.each(joins, function(childJoins, joinName) {
    tree.forEach(cursor, function(doc) {
      var model = cursor._cursorDescription.options.transform(doc);
      return publisher(this, model[joinName](), childJoins);
    });
  });
  
  return cursor;
}