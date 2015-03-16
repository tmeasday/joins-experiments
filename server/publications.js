// Meteor.publish('flip', function(flipId) {
//   PublishJoins(this, Flips.find(flipId), {
//     responses: {
//       comments: {
//         helpfuls: {}
//       }
//     }
//   });
// });


// Lower level API
Meteor.publish('flip', function(flipId) {
  var self = this;
  
  var tree = new SubscriptionTree(self);
  var flips = Flips.find(flipId);

  flips._publishCursor(tree);
  tree.ready();

  tree.forEach(flips, function(flip) {
    var responses = Responses.find({flipId: flipId});
    responses._publishCursor(this);
    this.ready();
  });
});
