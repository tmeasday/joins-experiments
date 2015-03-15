// PROBLEM: diamond joins
//
// Fix: use a "merge subscriptions" wrapper around a sub, which does it's own
//   merge box (or something less efficient?)
//
// Something like [this is the inefficient version]:
allowDiamonds: function(sub) {
  var docCounts = {};
  return {
    added: function(id, doc) {
      if (! docCounts[id]) {
        docCounts[id] = 0;
        sub.added(id, doc);
      } else {
        // NOTE: the issue here is that we may already know about some of
        //   these fields of doc (usually all). Still we have an upstream 
        //   mergebox that deals with this.
        sub.changed(id, {$set: doc});
      }
      docCounts[id] += 1;
    },
    removed: function(id) {
      docCounts[id] -= 1;
      if (docCounts[id] === 0) {
        sub.removed(id);
      }
      // NOTE: the issue here is that we possibly should be removing fields
      //   from the doc right now (ie issuing a changed) if we haven't removed
      //   it (in the general case). Still it's probably not a huge issue.
      //   (to do so we'd have to implement a second merge box which seems
      //    crazy). Is there some way we can hijack the real mergebox better?
      // TODO: look into this
    },
    changed: sub.changed,
    ready: sub.ready
  }
}

// 
// - how to deal with Egor's circular dependencies issue?
//   - A -> adds B
//   - B -> add C
// TODO: think about this



// Use "psuedo-subscription" objects that represent
//   the document levels. 
//
// The rules are:
//   - an outer sub kills it's children, like computations
//   - each inner sub is attached to a document, when the doc is removed,
//     the sub is stopped
//   - child subs pass added/etc/ready to parent sub
//   - parent sub is only ready when all children + itself are ready.


var SubscriptionTree = function(parent) {
  var self = this;
  
  // : _id => SubscriptionTree
  var children = {};
  var ready = false;
  var treeReady = false;
  var stopCbs = [];
  
  var addChild = function(id) {
    // FIXME: probably not sub here
    self.children[id] = new SubscriptionTree(self);
    return self.children[id];
  };
  
  self.isTreeReady = function() {
    return treeReady;
  }
  self.checkTreeReady = function() {
    var allChildrenReady = _.all(children, function(child) {
      return child.isReady();
    });
    if (allChildrenReady && ready) {
      treeReady = true;
      if (parent.checkTreeReady) {
        parent.checkTreeReady();
      } else { // parent is a real sub -- FIXME -- this is kind of gross
        parent.ready();
      }
    }
  };
  
// XXX: could take fields as an argument to allow only responding to changes on
//   relevant fields
  self.forEach = function(cursor) {
    var handle = cursor.observeChanges({
      added: function(id, doc) {
        // XXX: could do the mergeboxing at this level?
        //   i.e do something if children[id] already exists.
        var childSub = addChild(id);
        fn.call(childSub, doc);
      }, 
      changed: function(id, mod) {
        // check mod applies
        var childSub = children[id];
        // TODO: shoudl there be an official API to do this?
        var doc = handle._multiplexer._cache.docs.get(id);
        fn.call(childSub, doc);
      },
      removed: function(id) {
        children[id].stop();
        delete children[id];
        self.checkTreeReady();
      }
    });
  };
  
  // proxy these right through to the parent for now
  _.each(['userId', 'added', 'changed', 'removed', 'error', 'stop', 'connection'], function(prop) {
    self[prop] = parent[prop];
  });
  self.onStop = function(fn) {
    stopCbs.push(fn);
  }
  self.ready = function() {
    ready = true;
    self.checkTreeReady();
  }
  
  parent.onStop(function() {
    self.stop();
  });
}

Meteor.publish('flip', function(flipId) {
  var self = this;
  // 1. check the user has the right to view the flip.
  
  // 2. publish:
  //      the flip 
  //        -> class
  //          -> teacher
  //          -> students 
  //        -> responses
  //          -> comments
  //            -> helpfuls
  
  
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


var PublishJoins = function(sub, cursor, joins) {
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


// where I'd like to get to
Meteor.publish('flip', function(flipId) {
  PublishJoins(this, Flips.find(flipId), {
    class: {
      teacher: {},
      students: {}
    },
    responses: {
      comments: {
        helpfuls: {}
      }
    }
  });
});

// which uses the fact that
// flip.class() etc is defined and returns a cursor.