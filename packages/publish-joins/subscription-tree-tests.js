var Children = new Mongo.Collection('children');
var Grandchildren = new Mongo.Collection('grandchildren');

if (Meteor.isServer) {
  // prepare some data for our testing
  var parentId = Random.id();
  Children.remove({});
  Grandchildren.remove({});
  var addChild = function(i) {
    var childId = Children.insert({parentId: parentId, index: i});
    _.times(10, function(j) {
      Grandchildren.insert({childId: childId, index: j});
    });
    return childId;
  }
  _.times(10, addChild);
  
  Meteor.publish('children-and-grandchildren', function() {
    // ordinarily you'd pass parentId in of course.
    var childCursor = Children.find({parentId: parentId});
    
    // create a new child subscription for each child
    subscriptionForEach(this, childCursor, function(child) {
      return Grandchildren.find({childId: child._id});
    });
    
    // also publish the children at this level
    return childCursor;
  });
  
  Meteor.methods({
    'add-child-and-grandchildren': addChild,
    'remove-child': function(childId) {
      Children.remove(childId);
      // NOTE: don't remove grandchildren
    },
    'remove-grandchildren': function(childId) {
      Grandchildren.remove({childId: childId});
    }
  });
  
  Meteor.publish('overlapping-grandchildren', function() {
    this.publishChild(function() {
      return Grandchildren.find({index: 0});
    });

    this.publishChild(function() {
      return Grandchildren.find({index: {$lt: 2}});
    });

    this.ready();
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
      this.handle = Meteor.subscribe("children-and-grandchildren", {
        onReady: expect(function () {
          test.equal(Children.find().count(), 10);
          test.equal(Grandchildren.find().count(), 100);
        }),
        onError: fail(test)
      });
    }, function() {
      this.handle.stop()
    }
  ]);
  
  testAsyncMulti("subscription-tree - add and remove data", [
    function (test, expect) {
      this.handle = Meteor.subscribe("children-and-grandchildren", {
        onReady: expect(function () {
          test.equal(Children.find().count(), 10);
          test.equal(Grandchildren.find().count(), 100);
        }),
        onError: fail(test)
      });
    },
    function(test, expect) {
      var self = this;
      Meteor.call('add-child-and-grandchildren', expect(function(error, childId) {
        test.isUndefined(error);
        test.equal(Children.find().count(), 11);
        test.equal(Grandchildren.find().count(), 110);
        self.childId = childId;
      }));
    },
    function(test, expect) {
      var self = this;
      Meteor.call('remove-child', self.childId, expect(function(error) {
        test.isUndefined(error);
        test.equal(Children.find(self.childId).count(), 0)
        test.equal(Children.find().count(), 10);
        test.equal(Grandchildren.find().count(), 100);
      }));
    }, 
    function(test, expect) {
      Meteor.call('remove-grandchildren', this.childId, expect(function() {}));
    }, 
    function() {
      this.handle.stop()
    }
  ]);

  testAsyncMulti("subscription-tree - overlapping cursors", [
    function (test, expect) {
      this.handle = Meteor.subscribe("overlapping-grandchildren", {
        onReady: expect(function () {
          test.equal(Grandchildren.find().count(), 20);
        }),
        onError: fail(test)
      });
    },
    function(test, expect) {
      var self = this;
      Meteor.call('add-child-and-grandchildren', self.childId, expect(function(error, childId) {
        test.isUndefined(error);
        test.equal(Grandchildren.find().count(), 22);
        self.childId = childId;
      }));
    }, 
    function(test, expect) {
      Meteor.call('remove-child', this.childId, expect(function() {}));
    }, 
    function(test, expect) {
      Meteor.call('remove-grandchildren', this.childId, expect(function() {
        test.equal(Grandchildren.find().count(), 20);
      }));
    }, 
    function() {
      this.handle.stop()
    }
  ]);
  
}
