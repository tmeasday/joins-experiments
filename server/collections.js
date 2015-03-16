Flips = new Mongo.Collection('flips');
Flips.helpers({
  responses: function() {
    return Responses.find({flipId: this._id});
  }
});

Responses = new Mongo.Collection('responses');
Responses.helpers({
  comments: function() {
    return Comments.find({responseId: this._id});
  }
});

Comments = new Mongo.Collection('comments');
Comments.helpers({
  helpfuls: function() {
    return Helpfuls.find({commentId: this._id});
  }
});

Helpfuls = new Mongo.Collection('helpfuls');

if (Flips.find().count() === 0) {
  _.times(10, function() {
    var flipId = Flips.insert({name: Random.id()});
    
    _.times(10, function(reponseNo) {
      var responseId = Responses.insert({
        flipId: flipId,
        name: 'response ' + responseNo
      });
      
      _.times(10, function(commentNo) {
        var commentId = Comments.insert({
          responseId: responseId,
          name: 'comment ' + commentNo
        });
      
        _.times(10, function(helpfulNo) {
          Helpfuls.insert({
            commentId: commentId,
            name: 'helpful ' + helpfulNo
          });
        });
      });
    });
  });
}