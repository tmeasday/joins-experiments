PublishJoins = function(sub, cursor, joins) {
  _.each(joins, function(childJoins, joinName) {
    subscriptionForEach(sub, cursor, function(doc) {
      var model = cursor._cursorDescription.options.transform(doc);
      return PublishJoins(this, model[joinName](), childJoins);
    });
  });
  
  return cursor;
}