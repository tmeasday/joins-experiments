Meteor.publish('flip', function(flipId) {
  console.log(flipId);
  PublishJoins(this, Flips.find(flipId), {
    responses: {
      comments: {
        helpfuls: {}
      }
    }
  });
});

