var Children = new Mongo.Collection('children');
var Grandchildren = new Mongo.Collection('grandchildren');

if (Meteor.isServer) {
  // prepare some data for our testing
  var parentId = Random.id();
  Children.remove({});
  Grandchildren.remove({});
  var addChild = function() {
    var childId = Children.insert({parentId: parentId});
    _.times(10, function() {
      Grandchildren.insert({childId: childId});
    });
  }
  _.times(10, addChild);
  
  Meteor.publish('children-and-grandchildren', function() {
    var tree = new SubscriptionTree(this);
    
    tree.publish(function() {
      // ordinarily you'd pass parentId in of course.
      var childCursor = Children.find({parentId: parentId});
      
      // create a new child subscription for each child
      this.forEach(childCursor, function(child) {
        return Grandchildren.find({childId: child._id});
      });
      
      // also publish the children at this level
      return childCursor;
    });
  });
  
  Meteor.methods({
    'add-child-and-grandchildren': addChild,
    'remove-child': function(childId) {
      Children.remove(childId);
      // NOTE: don't remove grandchildren
    }
  });

} else {
  var fail = function(test) {
    return function() {
      console.log('here');
      test.isTrue(false);
    }
  }
  
  testAsyncMulti("subscription-tree - basic data", [
    function (test, expect) {
      Meteor.subscribe("children-and-grandchildren", {
        onReady: expect(function () {
          test.equal(Children.find().count(), 10);
          test.equal(Grandchildren.find().count(), 100);
        }),
        onError: fail(test)
      });
    }
  ]);
  
  testAsyncMulti("subscription-tree - add and remove data", [
    function (test, expect) {
      Meteor.subscribe("children-and-grandchildren", {
        onReady: expect(function () {
          test.equal(Children.find().count(), 10);
          test.equal(Grandchildren.find().count(), 100);
        }),
        onError: fail(test)
      });
    },
    function(test, expect) {
      Meteor.call('add-child-and-grandchildren', expect(function(error) {
        test.isUndefined(error);
        test.equal(Children.find().count(), 11);
        test.equal(Grandchildren.find().count(), 110);
      }));
    },
    function(test, expect) {
      var childId = Children.findOne()._id;
      Meteor.call('remove-child', childId, expect(function(error) {
        test.isUndefined(error);
        test.equal(Children.find(childId).count(), 0);
        test.equal(Children.find().count(), 10);
        test.equal(Grandchildren.find().count(), 100);
      }));
    }
  ]);
  
}
