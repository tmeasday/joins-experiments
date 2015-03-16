Meteor.publish('flip', function(flipId) {
  PublishJoins(this, Flips.find(flipId), {
    responses: {
      comments: {
        helpfuls: {}
      }
    }
  });
});

