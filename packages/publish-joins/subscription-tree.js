// HACK: to gain access to the subscription prototype, see below.
var Subscription;

// Use "psuedo-subscription" objects that represent
//   the document levels. 
//
// The rules are:
//   - an outer sub kills it's children, like computations
//   - each inner sub is attached to a document, when the doc is removed,
//     the sub is stopped
//   - child subs pass added/etc/ready to parent sub
//   - parent sub is only ready when all children + itself are ready.
SubscriptionTree = function(parent, notRoot) {
  var self = this;

  var children = [];
  // is this particular subscription ready?
  var ready = false;
  // is the entire tree of this and it's children ready?
  var treeReady = false;
  var stopCbs = [];
  
  if (! notRoot) {
    Subscription = Subscription || parent.constructor;
  }
  
  // FIXME: does this do the right thing in the case of error / stop?
  self.publish = function(handler) {
    // TODO: should we not be so hacky here?
    self._handler = handler;
    self._params = Array.prototype.slice.call(arguments, 1);
    Subscription.prototype._runHandler.call(self);
  }
  
  self.publishChild = function(handler /*, arguments */) {
    var child = new SubscriptionTree(self, true);
    children.push(child);
    child.publish.apply(child, arguments);
    return child;
  }
  
  self._isTreeReady = function() {
    return treeReady;
  }
  self._checkTreeReady = function() {
    var allChildrenReady = _.all(children, function(child) {
      return child._isTreeReady();
    });
    treeReady = (allChildrenReady && ready);
    if (treeReady) { 
      if (notRoot) {
        parent._checkTreeReady();
      } else {
        parent.ready();
      }
    }
  };
  
  // TODO: could take fields as an argument to allow only responding to changes
  //   to relevant fields
  self.forEach = function(cursor, handler) {
    // : _id => SubscriptionTree
    var forEachChildren = {};
    var addChild = function(id, doc) {
      forEachChildren[id] = self.publishChild(handler, _.extend({_id: id}, doc));
    };

    var handle = cursor.observeChanges({
      added: function(id, doc) {
        addChild(id, doc);
      }, 
      changed: function(id, mod) {
        // if we had fields above, we could short-circuit in some cases here.
        
        // TODO: are there any conditions under which we can re-use the old sub?
        //   - Not in general
        //   - If old + new both returned cursors, could we check if they are
        //       the same? Or is that a pointless optimization?
        var oldChild = forEachChildren[id];
        
        // TODO: there should be an official API to do this?
        var doc = handle._multiplexer._cache.docs.get(id);
        addChild(id, doc);
        
        // We stop the old child after we start the new sub, so if there
        //   are common cursors, we don't teardown and re-establish the
        //   observers -- we just gracefully re-use the old one.
        oldChild.stop();
        self._checkTreeReady();
      },
      removed: function(id) {
        forEachChildren[id].stop();
        delete forEachChildren[id];
        self._checkTreeReady();
      }
    });
  };
  
  self.stop = function() {
    // self._namedSubs[subId]._removeAllDocuments();
    // self._namedSubs[subId]._deactivate();
  };
  
  // proxy these right through to the parent for now
  _.each(['userId', 'connection'], function(prop) {
    self[prop] = parent[prop];
  });
  _.each(['added', 'changed', 'removed', 'error', '_isDeactivated'], function(prop) {
    self[prop] = parent[prop].bind(parent);
  });
  
  self.onStop = function(fn) {
    stopCbs.push(fn);
  }
  self.ready = function() {
    ready = true;
    self._checkTreeReady();
  }
  
  parent.onStop(function() {
    self.stop();
  });
}




// XXX: I think the below is redundant
// // PROBLEM: diamond joins
// //
// // Fix: use a "merge subscriptions" wrapper around a sub, which does it's own
// //   merge box (or something less efficient?)
// //
// // Something like [this is the inefficient version]:
// allowDiamonds: function(sub) {
//   var docCounts = {};
//   return {
//     added: function(id, doc) {
//       if (! docCounts[id]) {
//         docCounts[id] = 0;
//         sub.added(id, doc);
//       } else {
//         // NOTE: the issue here is that we may already know about some of
//         //   these fields of doc (usually all). Still we have an upstream
//         //   mergebox that deals with this.
//         sub.changed(id, {$set: doc});
//       }
//       docCounts[id] += 1;
//     },
//     removed: function(id) {
//       docCounts[id] -= 1;
//       if (docCounts[id] === 0) {
//         sub.removed(id);
//       }
//       // NOTE: the issue here is that we possibly should be removing fields
//       //   from the doc right now (ie issuing a changed) if we haven't removed
//       //   it (in the general case). Still it's probably not a huge issue.
//       //   (to do so we'd have to implement a second merge box which seems
//       //    crazy). Is there some way we can hijack the real mergebox better?
//       // TODO: look into this
//     },
//     changed: sub.changed,
//     ready: sub.ready
//   }
// }
//
// //
// // - how to deal with Egor's circular dependencies issue?
// //   - A -> adds B
// //   - B -> add C
// // TODO: think about this
