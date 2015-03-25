Meteor.publish('flips', function() {
  return PublishJoins(this, Flips.find(), {
    responses: {
      comments: {
        helpfuls: {}
      }
    }
  });
});

